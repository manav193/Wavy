import { describe, expect, it } from "vitest";
import {
  formatBytes,
  getExtractionInputName,
  getExtractionMimeType,
  getExtractionOutputName,
  getFileExtension,
  isSupportedVideoFile,
  MAX_EXTRACTION_BYTES,
} from "./audio-extraction";

describe("media file helpers", () => {
  it("normalizes file extensions and handles extensionless names", () => {
    expect(getFileExtension("CLIP.MP4")).toBe("mp4");
    expect(getFileExtension("audio")).toBe("");
  });

  it("recognizes video files by MIME type or supported extension", () => {
    expect(isSupportedVideoFile({ name: "clip.mp4", type: "" })).toBe(true);
    expect(isSupportedVideoFile({ name: "clip.unknown", type: "video/example" })).toBe(true);
    expect(isSupportedVideoFile({ name: "song.mp3", type: "audio/mpeg" })).toBe(false);
  });

  it("uses a safe deterministic input name for FFmpeg", () => {
    expect(getExtractionInputName("../../my clip.MOV")).toBe("source.mov");
    expect(getExtractionInputName("odd-name.unknown")).toBe("source.media");
  });

  it("creates matching download names and MIME types for both formats", () => {
    expect(getExtractionOutputName("concert.final.mp4", "wav")).toBe("concert.final.wav");
    expect(getExtractionOutputName("concert.final.mp4", "mp3")).toBe("concert.final.mp3");
    expect(getExtractionOutputName(".mp4", "wav")).toBe("wavy-extracted-audio.wav");
    expect(getExtractionMimeType("wav")).toBe("audio/wav");
    expect(getExtractionMimeType("mp3")).toBe("audio/mpeg");
  });

  it("formats sizes and defines a 200 MB safety cap", () => {
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.0 MB");
    expect(MAX_EXTRACTION_BYTES).toBe(200 * 1024 * 1024);
    expect(formatBytes(Number.NaN)).toBe("Unknown size");
  });
});
