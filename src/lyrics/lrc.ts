export interface LyricLine {
  id: string;
  startMs: number;
  text: string;
}

export interface ParsedLrc {
  lines: LyricLine[];
  offsetMs: number;
  metadata: Record<string, string>;
  warnings: string[];
}

const TIMESTAMP = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
const METADATA = /^\[([a-zA-Z]+):([^\]]*)\]$/;

function fractionToMs(value = ""): number {
  if (!value) return 0;
  if (value.length === 1) return Number(value) * 100;
  if (value.length === 2) return Number(value) * 10;
  return Math.round(Number(value) / 10);
}

function makeId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `lyric-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function formatLrcTimestamp(ms: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(ms) ? ms : 0));
  const minutes = Math.floor(safe / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1000);
  const centiseconds = Math.floor((safe % 1000) / 10);
  return `[${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}]`;
}

export function parseLrc(input: string): ParsedLrc {
  const lines: LyricLine[] = [];
  const metadata: Record<string, string> = {};
  const warnings: string[] = [];
  let offsetMs = 0;
  const sourceLines = input.replace(/^\uFEFF/, "").split(/\r?\n/);

  for (let lineIndex = 0; lineIndex < sourceLines.length; lineIndex++) {
    const source = sourceLines[lineIndex].trim();
    if (!source) continue;

    const offsetMatch = source.match(/^\[offset:([+-]?\d+)\]$/i);
    if (offsetMatch) {
      offsetMs = Number(offsetMatch[1]);
      continue;
    }

    TIMESTAMP.lastIndex = 0;
    const metaMatch = source.match(METADATA);
    if (metaMatch && !TIMESTAMP.test(source)) {
      metadata[metaMatch[1].toLowerCase()] = metaMatch[2].trim();
      TIMESTAMP.lastIndex = 0;
      continue;
    }
    TIMESTAMP.lastIndex = 0;

    const timestamps: number[] = [];
    let match: RegExpExecArray | null;
    while ((match = TIMESTAMP.exec(source)) !== null) {
      const minutes = Number(match[1]);
      const seconds = Number(match[2]);
      if (seconds > 59) continue;
      timestamps.push(minutes * 60_000 + seconds * 1000 + fractionToMs(match[3]));
    }
    TIMESTAMP.lastIndex = 0;

    if (timestamps.length === 0) {
      if (/^\[/.test(source)) warnings.push(`Line ${lineIndex + 1}: unrecognized timestamp or metadata.`);
      else lines.push({ id: makeId(), startMs: -1, text: source });
      continue;
    }

    const text = source.replace(TIMESTAMP, "").trim();
    TIMESTAMP.lastIndex = 0;
    if (!text) {
      warnings.push(`Line ${lineIndex + 1}: timestamp has no lyric text.`);
      continue;
    }

    for (const timestamp of timestamps) {
      // Apply the standard LRC [offset:] tag exactly once. The UI preview offset
      // remains a separate, temporary adjustment.
      lines.push({ id: makeId(), startMs: Math.max(0, timestamp + offsetMs), text });
    }
  }

  lines.sort((a, b) => {
    if (a.startMs < 0) return 1;
    if (b.startMs < 0) return -1;
    return a.startMs - b.startMs;
  });

  if (lines.length === 0) warnings.push("No usable lyric lines found.");
  return { lines, offsetMs, metadata, warnings };
}

export function serializeLrc(lines: LyricLine[]): string {
  return [...lines]
    .filter((line) => line.startMs >= 0 && line.text.trim())
    .sort((a, b) => a.startMs - b.startMs)
    .map((line) => `${formatLrcTimestamp(line.startMs)}${line.text.trim()}`)
    .join("\n");
}

export function activeLyricIndex(lines: LyricLine[], playbackMs: number): number {
  let active = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startMs < 0) continue;
    if (lines[i].startMs <= playbackMs) active = i;
    else break;
  }
  return active;
}
