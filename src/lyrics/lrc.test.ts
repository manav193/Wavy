import { describe, expect, it } from "vitest";
import { activeLyricIndex, formatLrcTimestamp, parseLrc, serializeLrc } from "./lrc";

describe("parseLrc", () => {
  it("parses timestamps and sorts out-of-order lines", () => {
    const result = parseLrc("[00:03.20]third\n[00:01.10]first\n[00:02.00]second");
    expect(result.lines.map((line) => [line.startMs, line.text])).toEqual([
      [1100, "first"], [2000, "second"], [3200, "third"],
    ]);
  });

  it("supports multiple timestamps on a single source line", () => {
    const result = parseLrc("[00:01.00][00:02.50]repeat");
    expect(result.lines.map((line) => line.startMs)).toEqual([1000, 2500]);
    expect(result.lines.every((line) => line.text === "repeat")).toBe(true);
  });

  it("supports BOM, metadata, signed offsets, and fractional timestamps", () => {
    const result = parseLrc("\uFEFF[ti:Demo]\n[ar:Artist]\n[offset:+250]\n[00:01.5]hello\n[00:02.25]world");
    expect(result.metadata).toEqual({ ti: "Demo", ar: "Artist" });
    expect(result.offsetMs).toBe(250);
    expect(result.lines.map((line) => line.startMs)).toEqual([1750, 2500]);
  });

  it("keeps untimed text visible but excludes it from active timing", () => {
    const result = parseLrc("Intro notes\n[00:01.00]Verse");
    expect(result.lines.map((line) => line.startMs)).toEqual([1000, -1]);
    expect(activeLyricIndex(result.lines, 1200)).toBe(0);
  });

  it("rejects invalid seconds and reports unusable input", () => {
    const result = parseLrc("[00:77.00]bad");
    expect(result.lines).toHaveLength(0);
    expect(result.warnings).toContain("No usable lyric lines found.");
  });

  it("reports timestamps without lyric text", () => {
    const result = parseLrc("[00:01.00]");
    expect(result.lines).toHaveLength(0);
    expect(result.warnings.some((warning) => warning.includes("no lyric text"))).toBe(true);
  });
});

describe("LRC serialization and active line", () => {
  it("serializes timestamped lines with centisecond precision", () => {
    const parsed = parseLrc("[00:01.23]Hello\n[01:02.99]World");
    expect(serializeLrc(parsed.lines)).toBe("[00:01.23]Hello\n[01:02.99]World");
    expect(formatLrcTimestamp(1239)).toBe("[00:01.23]");
  });

  it("chooses the last line that has started", () => {
    const lines = parseLrc("[00:01.00]one\n[00:02.00]two").lines;
    expect(activeLyricIndex(lines, 999)).toBe(-1);
    expect(activeLyricIndex(lines, 1000)).toBe(0);
    expect(activeLyricIndex(lines, 2000)).toBe(1);
  });
});
