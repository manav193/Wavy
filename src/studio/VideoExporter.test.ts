import { describe, expect, it } from "vitest";
import type { LyricLine } from "../lyrics/lrc";
import { activeLineAt } from "./VideoExporter";

const lines: LyricLine[] = [
  { id: "a", startMs: -1, text: "Untimed draft" },
  { id: "b", startMs: 1000, text: "First line" },
  { id: "c", startMs: 2500, text: "Second line" },
  { id: "d", startMs: 5000, text: "Third line" },
];

describe("deterministic export lyric clock", () => {
  it("has no active line before the first timestamp", () => {
    expect(activeLineAt(lines, 0)).toBeNull();
    expect(activeLineAt(lines, 0.999)).toBeNull();
  });

  it("selects the latest cue at exact boundaries and between cues", () => {
    expect(activeLineAt(lines, 1)).toEqual(lines[1]);
    expect(activeLineAt(lines, 2.49)).toEqual(lines[1]);
    expect(activeLineAt(lines, 2.5)).toEqual(lines[2]);
    expect(activeLineAt(lines, 4.99)).toEqual(lines[2]);
    expect(activeLineAt(lines, 5)).toEqual(lines[3]);
  });

  it("ignores untimed lyric drafts", () => {
    expect(activeLineAt([lines[0]], 60)).toBeNull();
  });
});
