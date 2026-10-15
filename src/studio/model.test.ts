import { describe, expect, it } from "vitest";
import {
  createDefaultProject,
  getCanvasDimensions,
  normalizeClip,
  parseStudioProject,
  snapSeconds,
} from "./model";

describe("Wavy Studio project model", () => {
  it("creates a versioned default project with editing tracks", () => {
    const project = createDefaultProject();
    expect(project.schemaVersion).toBe(1);
    expect(project.clips.map((clip) => clip.track)).toEqual(["audio", "visualizer", "overlay"]);
  });

  it("maps aspect ratios to expected 1080 output dimensions", () => {
    expect(getCanvasDimensions("16:9", 1080)).toEqual({ width: 1920, height: 1080 });
    expect(getCanvasDimensions("9:16", 1080)).toEqual({ width: 1080, height: 1920 });
    expect(getCanvasDimensions("1:1", 720)).toEqual({ width: 720, height: 720 });
  });

  it("snaps time only when enabled and avoids invalid negative values", () => {
    expect(snapSeconds(1.13, true)).toBe(1.25);
    expect(snapSeconds(1.13, false)).toBe(1.13);
    expect(snapSeconds(-4, true)).toBe(0);
  });

  it("keeps clip position and duration within project duration", () => {
    const clip = normalizeClip({ id: "x", track: "overlay", name: "Title", startSec: 19.9, durationSec: 12, enabled: true }, 20, false);
    expect(clip.startSec).toBe(19.9);
    expect(clip.durationSec).toBeCloseTo(0.1);
  });

  it("round-trips valid project JSON", () => {
    const project = createDefaultProject();
    expect(parseStudioProject(JSON.stringify(project))).toEqual(project);
  });

  it("rejects duplicate clip IDs in imported projects", () => {
    const project = createDefaultProject();
    project.clips.push({ ...project.clips[0], name: "Duplicate ID" });
    expect(() => parseStudioProject(JSON.stringify(project))).toThrow(/duplicate clip IDs/);
  });

  it("rejects unknown schema versions, malformed settings, and excessive clips", () => {
    expect(() => parseStudioProject(JSON.stringify({ schemaVersion: 9 }))).toThrow(/Unsupported project version/);
    expect(() => parseStudioProject("{oops")).toThrow(/valid JSON/);
    const project = createDefaultProject();
    project.clips = Array.from({ length: 201 }, (_, index) => ({ ...project.clips[0], id: String(index) }));
    expect(() => parseStudioProject(JSON.stringify(project))).toThrow(/maximum 200/);
  });
});
