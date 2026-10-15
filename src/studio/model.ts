export type StudioAspectRatio = "16:9" | "9:16" | "1:1";
export type StudioResolution = 720 | 1080;
export type StudioTrackKind = "audio" | "visualizer" | "overlay";

export interface StudioClip {
  id: string;
  track: StudioTrackKind;
  name: string;
  startSec: number;
  durationSec: number;
  enabled: boolean;
  text?: string;
}

export interface StudioProject {
  schemaVersion: 1;
  name: string;
  aspectRatio: StudioAspectRatio;
  resolution: StudioResolution;
  frameRate: 24 | 30 | 60;
  background: "midnight" | "aurora" | "sunset" | "paper";
  showLyrics: boolean;
  showVisualizer: boolean;
  snapEnabled: boolean;
  pixelsPerSecond: number;
  clips: StudioClip[];
}

export const PROJECT_STORAGE_KEY = "wavy.studio-project.v1";
export const SNAP_INTERVAL_SECONDS = 0.25;

export function createDefaultProject(): StudioProject {
  return {
    schemaVersion: 1,
    name: "Untitled Wavy Project",
    aspectRatio: "16:9",
    resolution: 1080,
    frameRate: 30,
    background: "midnight",
    showLyrics: true,
    showVisualizer: true,
    snapEnabled: true,
    pixelsPerSecond: 42,
    clips: [
      { id: "audio-main", track: "audio", name: "Source audio", startSec: 0, durationSec: 0, enabled: true },
      { id: "visualizer-main", track: "visualizer", name: "Audio visualizer", startSec: 0, durationSec: 0, enabled: true },
      { id: "overlay-title", track: "overlay", name: "Title overlay", startSec: 0, durationSec: 5, enabled: true, text: "YOUR TITLE" },
    ],
  };
}

export function getCanvasDimensions(ratio: StudioAspectRatio, resolution: StudioResolution): { width: number; height: number } {
  if (ratio === "9:16") return { width: Math.round(resolution * 9 / 16), height: resolution };
  if (ratio === "1:1") return { width: resolution, height: resolution };
  return { width: resolution, height: Math.round(resolution * 9 / 16) };
}

export function snapSeconds(seconds: number, enabled: boolean, interval = SNAP_INTERVAL_SECONDS): number {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  return enabled ? Math.round(safe / interval) * interval : safe;
}

export function normalizeClip(clip: StudioClip, totalDuration: number, snapEnabled: boolean): StudioClip {
  const limit = Math.max(0, Number.isFinite(totalDuration) ? totalDuration : 0);
  const startSec = Math.min(limit, snapSeconds(clip.startSec, snapEnabled));
  const remaining = Math.max(0, limit - startSec);
  const durationSec = Math.min(remaining, Math.max(0.25, snapSeconds(clip.durationSec, snapEnabled)));
  return { ...clip, startSec, durationSec };
}

export function parseStudioProject(input: string): StudioProject {
  let value: unknown;
  try { value = JSON.parse(input); } catch { throw new Error("Project file is not valid JSON."); }
  if (!value || typeof value !== "object") throw new Error("Project file must be a JSON object.");
  const raw = value as Partial<StudioProject>;
  if (raw.schemaVersion !== 1) throw new Error("Unsupported project version. This file needs Wavy Studio project schema version 1.");
  const defaults = createDefaultProject();
  const validRatio = raw.aspectRatio === "16:9" || raw.aspectRatio === "9:16" || raw.aspectRatio === "1:1";
  const validResolution = raw.resolution === 720 || raw.resolution === 1080;
  const validFrameRate = raw.frameRate === 24 || raw.frameRate === 30 || raw.frameRate === 60;
  const validBackground = raw.background === "midnight" || raw.background === "aurora" || raw.background === "sunset" || raw.background === "paper";
  if (!validRatio || !validResolution || !validFrameRate || !validBackground || !Array.isArray(raw.clips)) {
    throw new Error("Project settings or timeline clips are invalid.");
  }
  if (raw.clips.length > 200) throw new Error("This project contains too many clips (maximum 200).");
  const clips = raw.clips.map((clip): StudioClip => {
    if (!clip || typeof clip !== "object") throw new Error("Project contains an invalid clip.");
    const item = clip as StudioClip;
    if (typeof item.id !== "string" || item.id.length > 120 ||
        (item.track !== "audio" && item.track !== "visualizer" && item.track !== "overlay") ||
        typeof item.name !== "string" || item.name.length > 200 ||
        typeof item.startSec !== "number" || !Number.isFinite(item.startSec) || item.startSec < 0 ||
        typeof item.durationSec !== "number" || !Number.isFinite(item.durationSec) || item.durationSec < 0 ||
        typeof item.enabled !== "boolean" ||
        (item.text !== undefined && (typeof item.text !== "string" || item.text.length > 500))) {
      throw new Error("Project contains a malformed clip.");
    }
    return { ...item };
  });
  return {
    schemaVersion: 1,
    name: typeof raw.name === "string" ? raw.name.slice(0, 120) : defaults.name,
    aspectRatio: raw.aspectRatio,
    resolution: raw.resolution,
    frameRate: raw.frameRate,
    background: raw.background,
    showLyrics: typeof raw.showLyrics === "boolean" ? raw.showLyrics : defaults.showLyrics,
    showVisualizer: typeof raw.showVisualizer === "boolean" ? raw.showVisualizer : defaults.showVisualizer,
    snapEnabled: typeof raw.snapEnabled === "boolean" ? raw.snapEnabled : defaults.snapEnabled,
    pixelsPerSecond: typeof raw.pixelsPerSecond === "number" && Number.isFinite(raw.pixelsPerSecond)
      ? Math.max(18, Math.min(120, raw.pixelsPerSecond)) : defaults.pixelsPerSecond,
    clips,
  };
}
