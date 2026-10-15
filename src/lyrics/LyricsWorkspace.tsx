import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileText, Music2, RefreshCw, Sparkles, Timer, Upload, WandSparkles } from "lucide-react";
import { activeLyricIndex, formatLrcTimestamp, parseLrc, serializeLrc, type LyricLine } from "./lrc";
import { assistWithLyrics, NimoClientError } from "../services/nimo-client";

interface LyricsWorkspaceProps {
  currentTime: number;
  duration: number;
  seek: (seconds: number) => void;
}

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `line-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function LyricsWorkspace({ currentTime, duration, seek }: LyricsWorkspaceProps) {
  const [lines, setLines] = useState<LyricLine[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [offsetMs, setOffsetMs] = useState(0);
  const [plainText, setPlainText] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [warning, setWarning] = useState("");
  const [showEditor, setShowEditor] = useState(true);
  const [animationPreset, setAnimationPreset] = useState<"pop" | "bounce" | "fill" | "fade" | "slide">("pop");
  const animationPresets = [
    { id: "pop", label: "Pop + highlight" },
    { id: "bounce", label: "Bounce" },
    { id: "fill", label: "Color fill" },
    { id: "fade", label: "Blur reveal" },
    { id: "slide", label: "Slide reveal" },
  ] as const;
  const activeIndex = useMemo(
    () => activeLyricIndex(lines, Math.max(0, currentTime * 1000 - offsetMs)),
    [lines, currentTime, offsetMs],
  );
  const activeId = activeIndex >= 0 ? lines[activeIndex]?.id : null;
  const previewTimeMs = Math.max(0, currentTime * 1000 - offsetMs);
  const activeLine = activeIndex >= 0 ? lines[activeIndex] : null;
  const nextTimedLine = activeIndex >= 0 ? lines.slice(activeIndex + 1).find((line) => line.startMs >= 0) : null;
  const wordList = activeLine?.text.trim().split(/\s+/).filter(Boolean) ?? [];
  const activeLineStart = activeLine?.startMs ?? 0;
  const lineEnd = nextTimedLine?.startMs ?? Math.max(activeLineStart + 2500, duration * 1000);
  const lineProgress = Math.max(0, Math.min(0.999, (previewTimeMs - activeLineStart) / Math.max(1, lineEnd - activeLineStart)));
  const activeWordIndex = wordList.length ? Math.min(wordList.length - 1, Math.floor(lineProgress * wordList.length)) : -1;
  const selectedLine = lines.find((line) => line.id === selectedId) ?? null;
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeId]);

  const importLrc = async (file?: File) => {
    if (!file) return;
    setMessage("");
    setWarning("");
    if (file.size > 1024 * 1024) {
      setWarning("LRC file is larger than 1 MB. Choose a smaller text file.");
      return;
    }
    try {
      const content = await file.text();
      const parsed = parseLrc(content);
      if (!parsed.lines.length) {
        setWarning(parsed.warnings.join(" ") || "No lyric lines were found.");
        return;
      }
      setLines(parsed.lines);
      setSelectedId(parsed.lines[0].id);
      setOffsetMs(0);
      setPlainText(parsed.lines.map((line) => line.text).join("\n"));
      setDraft("");
      setWarning(parsed.warnings.join(" "));
      setMessage(`Imported ${parsed.lines.length} lyric lines from ${file.name}. Embedded LRC offset was applied.`);
    } catch {
      setWarning("Could not read this file. Try a UTF-8 LRC text file.");
    }
  };

  const usePlainText = () => {
    const next = plainText.split(/\r?\n/).map((text) => text.trim()).filter(Boolean)
      .map((text) => ({ id: makeId(), startMs: -1, text }));
    if (!next.length) {
      setWarning("Paste lyrics first, then select Use text.");
      return;
    }
    setLines(next);
    setSelectedId(next[0].id);
    setOffsetMs(0);
    setDraft("");
    setWarning("");
    setMessage(`Loaded ${next.length} untimed lines. Select a line and use Set current time while the song plays.`);
  };

  const updateLine = (id: string, update: Partial<Pick<LyricLine, "text" | "startMs">>) => {
    setLines((current) => current.map((line) => line.id === id ? { ...line, ...update } : line)
      .sort((a, b) => {
        if (a.startMs < 0) return 1;
        if (b.startMs < 0) return -1;
        return a.startMs - b.startMs;
      }));
  };

  const stampSelected = () => {
    if (!selectedLine) {
      setWarning("Select a lyric line first.");
      return;
    }
    updateLine(selectedLine.id, { startMs: Math.max(0, Math.round(currentTime * 1000)) });
    setWarning("");
    setMessage(`Timestamp set to ${formatLrcTimestamp(currentTime * 1000)}.`);
  };

  const exportLrc = () => {
    const content = serializeLrc(lines);
    if (!content) {
      setWarning("No timestamped lines to export. Set line timestamps first.");
      return;
    }
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "wavy-lyrics.lrc";
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("Exported timestamped lyrics as LRC.");
  };

  const runNimoAssist = async () => {
    setBusy(true);
    setMessage("");
    setWarning("");
    try {
      const input = lines.length ? lines.map((line) => line.text).join("\n") : plainText;
      const result = await assistWithLyrics(input);
      setDraft(result.text);
      setMessage("NIMO returned an unverified formatting draft. Review it before applying.");
    } catch (error) {
      setWarning(error instanceof NimoClientError ? error.message : "NIMO assistance failed. Your lyrics are unchanged.");
    } finally {
      setBusy(false);
    }
  };

  const applyDraft = () => {
    const next = draft.split(/\r?\n/).map((text) => text.trim()).filter(Boolean)
      .map((text) => ({ id: makeId(), startMs: -1, text }));
    setLines(next);
    setPlainText(draft);
    setSelectedId(next[0]?.id ?? null);
    setOffsetMs(0);
    setDraft("");
    setMessage("Draft applied as untimed text. Existing timestamps were not carried over; sync the lines before export.");
    setWarning("");
  };

  const resetTimings = () => {
    setLines((current) => current.map((line) => ({ ...line, startMs: -1 })));
    setOffsetMs(0);
    setMessage("All timestamps cleared. Lyric text was preserved.");
    setWarning("");
  };

  return (
    <div className="info-card lyrics-card lyrics-workspace">
      <div className="card-heading">
        <span><Music2 size={17} /> LYRIC TIMELINE</span>
        <span className="small-status">{lines.length} LINES</span>
      </div>

      <div className="lyrics-toolbar">
        <label className="lyrics-action" htmlFor="lrc-input"><Upload size={14} /> Import LRC</label>
        <input id="lrc-input" className="visually-hidden" type="file" accept=".lrc,.txt,text/plain" onChange={(event) => { void importLrc(event.target.files?.[0]); event.currentTarget.value = ""; }} />
        <button className="lyrics-action" onClick={() => setShowEditor((value) => !value)}><FileText size={14} /> {showEditor ? "Hide text input" : "Paste lyrics"}</button>
        <button className="lyrics-action" onClick={exportLrc}><Download size={14} /> Export LRC</button>
        <button className="lyrics-action nimo-action" onClick={() => void runNimoAssist()} disabled={busy}><Sparkles size={14} /> {busy ? "Asking NIMO…" : "NIMO assist"}</button>
      </div>

      {showEditor && <div className="lyrics-input-area">
        <textarea value={plainText} onChange={(event) => setPlainText(event.target.value)} placeholder={"Paste lyrics here, one line at a time…"} aria-label="Paste lyrics text" />
        <button className="secondary-action" onClick={usePlainText}>Use text as untimed lines</button>
      </div>}

      {draft && <div className="nimo-draft">
        <div className="draft-heading"><span><WandSparkles size={15} /> NIMO DRAFT · UNVERIFIED</span><span>Review before applying</span></div>
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} aria-label="Review NIMO lyric formatting draft" />
        <div className="draft-actions"><button className="secondary-action" onClick={() => setDraft("")}>Discard</button><button className="primary-action" onClick={applyDraft}>Apply draft</button></div>
      </div>}

      {message && <div className="lyrics-notice" role="status">{message}</div>}
      {warning && <div className="lyrics-warning" role="alert">{warning}</div>}

      <div className="offset-control">
        <label htmlFor="lyrics-offset"><Timer size={14} /> Preview offset <strong>{offsetMs > 0 ? "+" : ""}{offsetMs} ms</strong></label>
        <input id="lyrics-offset" type="range" min={-3000} max={3000} step={50} value={offsetMs} onChange={(event) => setOffsetMs(Number(event.target.value))} />
        <button onClick={() => setOffsetMs(0)} aria-label="Reset lyric offset"><RefreshCw size={13} /> Reset</button>
      </div>

      <div className="karaoke-controls" aria-label="Karaoke animation preset">
        <div className="karaoke-controls-heading"><span className="eyebrow">WORD ANIMATION PRESET</span><span className="karaoke-estimate">Estimated word timing</span></div>
        <div className="karaoke-preset-list">
          {animationPresets.map((preset) => <button key={preset.id} className={animationPreset === preset.id ? "karaoke-preset selected" : "karaoke-preset"} aria-pressed={animationPreset === preset.id} onClick={() => setAnimationPreset(preset.id)}>{preset.label}</button>)}
        </div>
      </div>
      <div className="lyric-current-preview">
        <span className="eyebrow">CURRENT LYRIC · {formatLrcTimestamp(currentTime * 1000)}</span>
        <strong className={`karaoke-word-stage preset-${animationPreset}`} aria-live="off">
          {activeLine ? wordList.map((word, index) => <span key={`${activeLine.id}-${index}`} className={index === activeWordIndex ? "karaoke-word is-word-active" : "karaoke-word"}>{word}{index < wordList.length - 1 ? " " : ""}</span>) : "No timed line at this position"}
        </strong>
      </div>

      <div className="lyric-line-list" aria-label="Timestamped lyrics">
        {lines.length === 0 && <div className="lyrics-empty">Import an LRC file or paste lyrics to build a synchronized timeline.</div>}
        {lines.map((line) => {
          const isActive = line.id === activeId;
          const isSelected = line.id === selectedId;
          return <button
            key={line.id}
            ref={isActive ? activeRef : undefined}
            className={`lyric-line ${isActive ? "is-active" : ""} ${isSelected ? "is-selected" : ""}`}
            onClick={() => { setSelectedId(line.id); if (line.startMs >= 0) seek(Math.max(0, line.startMs / 1000 + offsetMs / 1000)); }}
          >
            <span className="lyric-time">{line.startMs >= 0 ? formatLrcTimestamp(line.startMs) : "[--:--.--]"}</span>
            <span className="lyric-line-text">{line.text}</span>
            {isActive && <span className="active-tag">NOW</span>}
          </button>;
        })}
      </div>

      {selectedLine && <div className="line-inspector">
        <div className="inspector-label">SELECTED LINE</div>
        <label className="line-text-field"><span>Text</span><input value={selectedLine.text} onChange={(event) => updateLine(selectedLine.id, { text: event.target.value })} aria-label="Selected lyric text" /></label>
        <label className="line-text-field"><span>Start time (ms)</span><input type="number" min={0} max={Math.max(duration * 1000, 0)} step={10} value={selectedLine.startMs < 0 ? "" : selectedLine.startMs} placeholder="Untimed" onChange={(event) => updateLine(selectedLine.id, { startMs: event.target.value === "" ? -1 : Math.max(0, Math.min(Math.round(Number(event.target.value)), duration > 0 ? duration * 1000 : Number.MAX_SAFE_INTEGER)) })} /></label>
        <div className="line-inspector-actions">
          <button className="secondary-action" onClick={stampSelected}><Timer size={14} /> Set current time</button>
          <button className="secondary-action" onClick={() => updateLine(selectedLine.id, { startMs: -1 })}>Clear time</button>
          <button className="secondary-action" onClick={resetTimings}>Reset all</button>
        </div>
      </div>}

      <div className="lyrics-footer">
        <span>{lines.filter((line) => line.startMs >= 0).length} timed · {lines.filter((line) => line.startMs < 0).length} untimed · playback {formatLrcTimestamp(currentTime * 1000)}</span>
        <span>Audio remains local</span>
      </div>
    </div>
  );
}
