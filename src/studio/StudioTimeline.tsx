import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Download, Film, Grid2X2, MoveHorizontal, Music2, Plus, RotateCcw, SkipBack, Settings2, Sparkles, Type, Upload, Waves } from "lucide-react";
import type { LyricLine } from "../lyrics/lrc";
import {
  createDefaultProject,
  getCanvasDimensions,
  normalizeClip,
  parseStudioProject,
  PROJECT_STORAGE_KEY,
  snapSeconds,
  type StudioClip,
  type StudioProject,
  type StudioTrackKind,
} from "./model";

interface StudioTimelineProps {
  currentTime: number;
  duration: number;
  seek: (seconds: number) => void;
  trackName: string;
  lyricLines: LyricLine[];
  onMoveLyric: (id: string, startMs: number) => void;
}

type DragMode = "move" | "resize";
interface DragState {
  clipId: string;
  mode: DragMode;
  startX: number;
  initialStart: number;
  initialDuration: number;
}

const TRACKS: { id: StudioTrackKind | "lyrics"; label: string; icon: typeof Music2; hint: string }[] = [
  { id: "audio", label: "Audio", icon: Music2, hint: "Source media" },
  { id: "visualizer", label: "Visualizer", icon: Waves, hint: "Reactive layer" },
  { id: "lyrics", label: "Lyrics", icon: Type, hint: "LRC cue points" },
  { id: "overlay", label: "Overlays", icon: Film, hint: "Move / resize clips" },
];

function readSavedProject(): StudioProject {
  if (typeof window === "undefined") return createDefaultProject();
  try {
    const saved = window.localStorage.getItem(PROJECT_STORAGE_KEY);
    return saved ? parseStudioProject(saved) : createDefaultProject();
  } catch {
    return createDefaultProject();
  }
}

function timeLabel(seconds: number): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const minutes = Math.floor(safe / 60);
  const rest = (safe % 60).toFixed(1).padStart(4, "0");
  return `${String(minutes).padStart(2, "0")}:${rest}`;
}

function makeId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `clip-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function StudioTimeline({ currentTime, duration, seek, trackName, lyricLines, onMoveLyric }: StudioTimelineProps) {
  const [project, setProject] = useState<StudioProject>(readSavedProject);
  const [selectedClipId, setSelectedClipId] = useState<string | null>("overlay-title");
  const [notice, setNotice] = useState("");
  const [warning, setWarning] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [showSettings, setShowSettings] = useState(true);
  const dragRef = useRef<DragState | null>(null);
  const laneRefs = useRef<Partial<Record<StudioTrackKind, HTMLDivElement | null>>>({});
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try { window.localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project)); }
    catch { setWarning("Autosave is unavailable in this browser storage context. Export a project JSON backup."); }
  }, [project]);

  useEffect(() => {
    if (selectedClipId && project.clips.some((clip) => clip.id === selectedClipId)) return;
    setSelectedClipId(project.clips.find((clip) => clip.track === "overlay")?.id ?? null);
  }, [project.clips, selectedClipId]);

  useEffect(() => {
    if (duration <= 0) return;
    setProject((current) => {
      let changed = false;
      const clips = current.clips.map((clip) => {
        const normalized = normalizeClip(clip, duration, current.snapEnabled);
        if (normalized.startSec !== clip.startSec || normalized.durationSec !== clip.durationSec) changed = true;
        return normalized;
      });
      return changed ? { ...current, clips } : current;
    });
  }, [duration]);

  const safeDuration = Math.max(1, duration || 60);
  const timelineWidth = Math.max(720, safeDuration * project.pixelsPerSecond);
  const timelineLaneWidth = Math.max(616, timelineWidth - 104);
  const selectedClip = project.clips.find((clip) => clip.id === selectedClipId) ?? null;
  const activeLyric = useMemo(() => {
    let active: LyricLine | null = null;
    for (const line of lyricLines) {
      if (line.startMs < 0) continue;
      if (line.startMs <= currentTime * 1000) active = line;
      else break;
    }
    return active;
  }, [lyricLines, currentTime]);
  const visualizerIsActive = project.showVisualizer && project.clips.some((clip) => clip.track === "visualizer" && clip.enabled && currentTime >= clip.startSec && currentTime <= clip.startSec + clip.durationSec);
  const activeOverlay = project.clips.find((clip) =>
    clip.track === "overlay" && clip.enabled && currentTime >= clip.startSec && currentTime <= clip.startSec + clip.durationSec && clip.text?.trim(),
  );
  const dimensions = getCanvasDimensions(project.aspectRatio, project.resolution);
  const previewClass = `studio-preview background-${project.background}`;

  const updateProject = (patch: Partial<StudioProject>) => setProject((current) => ({ ...current, ...patch }));
  const updateClip = (id: string, patch: Partial<StudioClip>) => setProject((current) => ({
    ...current,
    clips: current.clips.map((clip) => clip.id === id
      ? normalizeClip({ ...clip, ...patch }, safeDuration, current.snapEnabled)
      : clip),
  }));

  const beginDrag = (event: ReactPointerEvent<HTMLElement>, clip: StudioClip, mode: DragMode = "move") => {
    if (event.button !== 0 || clip.track === "audio") return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { clipId: clip.id, mode, startX: event.clientX, initialStart: clip.startSec, initialDuration: clip.durationSec };
    setSelectedClipId(clip.id);
    setIsDragging(true);
  };

  const moveDrag = (event: React.PointerEvent<HTMLButtonElement>, track: StudioTrackKind) => {
    const drag = dragRef.current;
    const lane = laneRefs.current[track];
    if (!drag || !lane) return;
    const width = lane.getBoundingClientRect().width;
    if (width <= 0) return;
    const deltaSeconds = (event.clientX - drag.startX) / width * safeDuration;
    const nextStart = drag.mode === "move" ? drag.initialStart + deltaSeconds : drag.initialStart;
    const nextDuration = drag.mode === "resize" ? drag.initialDuration + deltaSeconds : drag.initialDuration;
    updateClip(drag.clipId, { startSec: nextStart, durationSec: nextDuration });
  };

  const endDrag = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setIsDragging(false);
  };

  const addOverlay = () => {
    const clip: StudioClip = {
      id: makeId(), track: "overlay", name: "Text overlay",
      startSec: Math.min(currentTime, Math.max(0, safeDuration - 1)), durationSec: Math.min(5, safeDuration),
      enabled: true, text: "YOUR TEXT",
    };
    setProject((current) => ({ ...current, clips: [...current.clips, clip] }));
    setSelectedClipId(clip.id);
    setNotice("Added a text overlay. Select it to edit the copy and timing.");
    setWarning("");
  };

  const exportProject = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${project.name.trim().replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "") || "wavy-project"}.wavy.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Project JSON exported. This saves settings and timeline metadata, not the source media or a rendered video.");
    setWarning("");
  };

  const importProject = async (file?: File) => {
    if (!file) return;
    if (file.size > 1024 * 1024) {
      setWarning("Project JSON is larger than 1 MB.");
      return;
    }
    try {
      const parsed = parseStudioProject(await file.text());
      const imported = { ...parsed, clips: parsed.clips.map((clip) => normalizeClip(clip, safeDuration, parsed.snapEnabled)) };
      setProject(imported);
      setSelectedClipId(imported.clips.find((clip) => clip.track === "overlay")?.id ?? null);
      setNotice("Project settings and timeline imported. Re-import the source media separately; media bytes are not embedded in the project file.");
      setWarning("");
    } catch (error) {
      setWarning(error instanceof Error ? error.message : "Could not import this project.");
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  };

  const resetProject = () => {
    if (!window.confirm("Reset Studio settings and timeline to defaults? This does not delete your media or lyric source.")) return;
    setProject(createDefaultProject());
    setSelectedClipId("overlay-title");
    setNotice("Studio project reset.");
    setWarning("");
  };

  const trackClips = (track: StudioTrackKind) => project.clips.filter((clip) => clip.track === track);

  return (
    <section className="info-card studio-workspace" aria-labelledby="studio-heading">
      <div className="card-heading">
        <span><Film size={17} /> STUDIO TIMELINE</span>
        <span className="small-status">PHASE 3 · PROJECT EDITOR</span>
      </div>
      <div className="studio-header">
        <div>
          <div className="eyebrow">PROJECT WORKSPACE</div>
          <h2 id="studio-heading">Build your lyric video.</h2>
          <p>Arrange visual layers and lyric cues on a shared timeline. Preview and project metadata are local to this browser.</p>
        </div>
        <div className="studio-project-actions">
          <button className="secondary-action" onClick={exportProject}><Download size={14} /> Export project</button>
          <button className="secondary-action" onClick={() => importRef.current?.click()}><Upload size={14} /> Import project</button>
          <input ref={importRef} type="file" accept=".json,.wavy.json,application/json" className="visually-hidden" onChange={(event) => void importProject(event.target.files?.[0])} />
        </div>
      </div>

      <div className="studio-layout">
        <div className="studio-preview-column">
          <div className="studio-preview-top">
            <span className="eyebrow">LIVE COMPOSITION PREVIEW</span>
            <span className="studio-dimensions">{dimensions.width} × {dimensions.height} · {project.frameRate} FPS</span>
          </div>
          <div className={previewClass} style={{ aspectRatio: project.aspectRatio.replace(":", " / ") }}>
            <div className="studio-preview-grid" />
            {visualizerIsActive && <div className="studio-preview-visualizer" aria-hidden="true">
              {Array.from({ length: 32 }, (_, index) => <span key={index} style={{ height: `${10 + ((index * 17 + Math.floor(currentTime * 13)) % 75)}%` }} />)}
            </div>}
            {project.showLyrics && <div className="studio-preview-lyrics">{activeLyric?.text ?? "Your lyrics appear here"}</div>}
            {activeOverlay?.text && <div className="studio-preview-overlay">{activeOverlay.text}</div>}
            <span className="studio-preview-time">{timeLabel(currentTime)}</span>
          </div>
          <div className="studio-preview-note">Preview only · final MP4 rendering is a later phase</div>
        </div>

        <div className="studio-settings">
          <div className="studio-settings-heading">
            <span><Settings2 size={15} /> PROJECT SETTINGS</span>
            <button className="studio-icon-action" aria-label={showSettings ? "Collapse project settings" : "Expand project settings"} onClick={() => setShowSettings((value) => !value)}><Grid2X2 size={15} /></button>
          </div>
          {showSettings && <>
            <label className="studio-field"><span>Project name</span><input maxLength={120} value={project.name} onChange={(event) => updateProject({ name: event.target.value })} /></label>
            <label className="studio-field"><span>Canvas ratio</span><select value={project.aspectRatio} onChange={(event) => updateProject({ aspectRatio: event.target.value as StudioProject["aspectRatio"] })}><option value="16:9">16:9 · YouTube</option><option value="9:16">9:16 · Shorts / Reels</option><option value="1:1">1:1 · Square</option></select></label>
            <label className="studio-field"><span>Output height</span><select value={project.resolution} onChange={(event) => updateProject({ resolution: Number(event.target.value) as StudioProject["resolution"] })}><option value={720}>720p</option><option value={1080}>1080p</option></select></label>
            <label className="studio-field"><span>Frame rate</span><select value={project.frameRate} onChange={(event) => updateProject({ frameRate: Number(event.target.value) as StudioProject["frameRate"] })}><option value={24}>24 FPS</option><option value={30}>30 FPS</option><option value={60}>60 FPS</option></select></label>
            <label className="studio-field"><span>Background</span><select value={project.background} onChange={(event) => updateProject({ background: event.target.value as StudioProject["background"] })}><option value="midnight">Midnight reactor</option><option value="aurora">Aurora green</option><option value="sunset">Sunset glow</option><option value="paper">Warm paper</option></select></label>
            <label className="studio-toggle"><input type="checkbox" checked={project.showVisualizer} onChange={(event) => updateProject({ showVisualizer: event.target.checked })} /> Show visualizer layer</label>
            <label className="studio-toggle"><input type="checkbox" checked={project.showLyrics} onChange={(event) => updateProject({ showLyrics: event.target.checked })} /> Show lyric layer</label>
            <label className="studio-toggle"><input type="checkbox" checked={project.snapEnabled} onChange={(event) => updateProject({ snapEnabled: event.target.checked })} /> Snap edits to 250 ms</label>
            <label className="studio-field"><span>Timeline zoom · {project.pixelsPerSecond} px/s</span><input type="range" min={18} max={120} step={3} value={project.pixelsPerSecond} onChange={(event) => updateProject({ pixelsPerSecond: Number(event.target.value) })} /></label>
          </>}
          <div className="studio-settings-footer"><span><span className="status-light" /> AUTO-SAVED LOCALLY</span><button onClick={resetProject}><RotateCcw size={12} /> Reset</button></div>
        </div>
      </div>

      <div className="studio-timeline-toolbar">
        <div className="studio-timeline-title"><span><MoveHorizontal size={15} /> MULTI-TRACK TIMELINE</span><span>{timeLabel(currentTime)} / {timeLabel(duration)}</span></div>
        <div className="studio-toolbar-actions">
          <button className="secondary-action" onClick={addOverlay}><Plus size={13} /> Add text overlay</button>
          <button className="secondary-action" onClick={() => seek(0)}><SkipBack size={13} /> Go to start</button>
        </div>
      </div>

      <div className="studio-timeline-scroll" aria-label="Editable studio timeline">
        <div className="studio-ruler" style={{ width: timelineLaneWidth, marginLeft: 104 }}>
          {Array.from({ length: Math.max(2, Math.ceil(safeDuration / 5) + 1) }, (_, index) => index * 5).filter((time) => time <= safeDuration).map((time) => <button key={time} style={{ left: `${time / safeDuration * 100}%` }} onClick={() => seek(Math.min(time, duration || time))}>{timeLabel(time)}</button>)}
        </div>
        <div className="studio-track-list" style={{ width: timelineWidth }}>
          {TRACKS.map((track) => {
            const Icon = track.icon;
            return <div className="studio-track-row" key={track.id}>
              <div className="studio-track-label"><Icon size={14} /><span>{track.label}</span><small>{track.hint}</small></div>
              {track.id === "lyrics" ? <div className="studio-track-lane studio-lyric-lane">
                {lyricLines.filter((line) => line.startMs >= 0 && line.startMs <= safeDuration * 1000).map((line) => {
                  const left = line.startMs / 1000 / safeDuration * 100;
                  const nextLine = lyricLines.find((item) => item.startMs > line.startMs);
                  const width = Math.max(1.2, Math.min(100 - left, ((nextLine?.startMs ?? (line.startMs + 2000)) - line.startMs) / 1000 / safeDuration * 100));
                  return <button key={line.id} className="studio-lyric-cue" title={`${timeLabel(line.startMs / 1000)} · ${line.text}`} style={{ left: `${left}%`, width: `${width}%` }} onClick={() => seek(line.startMs / 1000)} onDoubleClick={() => {
                    const next = window.prompt("Set lyric start time (seconds)", String((line.startMs / 1000).toFixed(2)));
                    if (next !== null && next.trim() && Number.isFinite(Number(next))) onMoveLyric(line.id, snapSeconds(Math.max(0, Math.min(duration || Number(next), Number(next))), project.snapEnabled) * 1000);
                  }}>{line.text}</button>;
                })}
                {lyricLines.every((line) => line.startMs < 0) && <span className="studio-empty-lane">Import or timestamp lyrics to see cue points</span>}
              </div> : <div className="studio-track-lane" ref={(node) => { laneRefs.current[track.id as StudioTrackKind] = node; }}>
                {track.id === "audio" && <div className="studio-audio-clip" style={{ left: 0, width: `${Math.min(100, (duration || 1) / safeDuration * 100)}%` }}><Music2 size={12} /><span>{trackName !== "Choose a track to begin" ? trackName : "No source media"}</span></div>}
                {trackClips(track.id).map((clip) => {
                  const left = clip.startSec / safeDuration * 100;
                  const width = Math.max(1, Math.min(100 - left, clip.durationSec / safeDuration * 100));
                  return <button key={clip.id} className={`studio-clip studio-clip-${clip.track} ${selectedClipId === clip.id ? "selected" : ""} ${clip.enabled ? "" : "disabled"}`} style={{ left: `${left}%`, width: `${width}%` }} onClick={() => setSelectedClipId(clip.id)} onPointerDown={(event) => beginDrag(event, clip)} onPointerMove={(event) => moveDrag(event, track.id as StudioTrackKind)} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag} title={`${clip.name} · ${timeLabel(clip.startSec)}`}>
                    <span className="studio-clip-title">{track.id === "visualizer" ? <Waves size={12} /> : <Type size={12} />}{clip.name}</span>
                    <span className="studio-clip-resize" role="presentation" onPointerDown={(event) => beginDrag(event, clip, "resize")} />
                  </button>;
                })}
                {track.id === "visualizer" && !trackClips("visualizer").length && <span className="studio-empty-lane">Enable or add a visualizer layer</span>}
              </div>}
            </div>;
          })}
          <div className="studio-playhead" style={{ left: `${104 + Math.max(0, Math.min(1, currentTime / safeDuration)) * timelineLaneWidth}px` }}><span /></div>
        </div>
      </div>
      {selectedClip && selectedClip.track === "overlay" && <div className="studio-clip-inspector">
        <div className="studio-inspector-title"><span><Type size={14} /> SELECTED OVERLAY</span><button onClick={() => setProject((current) => ({ ...current, clips: current.clips.filter((clip) => clip.id !== selectedClip.id) }))}>Delete clip</button></div>
        <div className="studio-inspector-fields">
          <label className="studio-field"><span>Layer name</span><input maxLength={200} value={selectedClip.name} onChange={(event) => updateClip(selectedClip.id, { name: event.target.value })} /></label>
          <label className="studio-field"><span>Text</span><input maxLength={500} value={selectedClip.text ?? ""} onChange={(event) => updateClip(selectedClip.id, { text: event.target.value })} /></label>
          <label className="studio-field"><span>Start · seconds</span><input type="number" min={0} max={safeDuration} step={project.snapEnabled ? 0.25 : 0.05} value={selectedClip.startSec} onChange={(event) => updateClip(selectedClip.id, { startSec: Number(event.target.value) })} /></label>
          <label className="studio-field"><span>Duration · seconds</span><input type="number" min={0.25} max={safeDuration} step={project.snapEnabled ? 0.25 : 0.05} value={selectedClip.durationSec} onChange={(event) => updateClip(selectedClip.id, { durationSec: Number(event.target.value) })} /></label>
          <label className="studio-toggle"><input type="checkbox" checked={selectedClip.enabled} onChange={(event) => updateClip(selectedClip.id, { enabled: event.target.checked })} /> Layer visible</label>
        </div>
        <p className="studio-inspector-help">Drag a clip to move it; drag its right handle to change its duration. Double-click a lyric cue to adjust its start time.</p>
      </div>}
      {isDragging && <div className="studio-drag-hint">Release to finish editing clip timing</div>}
      {notice && <div className="lyrics-notice" role="status">{notice}</div>}
      {warning && <div className="lyrics-warning" role="alert">{warning}</div>}
      <div className="studio-footnote"><Sparkles size={13} /> Project settings auto-save in this browser. Exported .wavy.json files contain timeline metadata only — source media is never embedded. Final video rendering is not included in Phase 3.</div>
    </section>
  );
}
