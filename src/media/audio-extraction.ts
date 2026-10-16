export const MAX_EXTRACTION_BYTES = 200 * 1024 * 1024;

export type ExtractionFormat = "wav" | "mp3";

const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "m4v", "mkv", "avi"]);

export function getFileExtension(fileName: string): string {
  const match = /\.([^.]+)$/.exec(fileName);
  return match?.[1]?.toLowerCase() ?? "";
}

export function isSupportedVideoFile(file: Pick<File, "name" | "type">): boolean {
  return file.type.startsWith("video/") || VIDEO_EXTENSIONS.has(getFileExtension(file.name));
}

export function getExtractionInputName(fileName: string): string {
  const extension = getFileExtension(fileName);
  return VIDEO_EXTENSIONS.has(extension) ? `source.${extension}` : "source.media";
}

export function getExtractionOutputName(fileName: string, format: ExtractionFormat): string {
  const baseName = fileName.replace(/\.[^.]+$/, "").trim() || "wavy-extracted-audio";
  return `${baseName}.${format}`;
}

export function getExtractionMimeType(format: ExtractionFormat): "audio/wav" | "audio/mpeg" {
  return format === "wav" ? "audio/wav" : "audio/mpeg";
}

export function getErrorMessage(cause: unknown): string {
  if (cause instanceof Error && cause.message) return cause.message;
  if (typeof cause === "string" && cause.trim()) return cause;
  if (cause && typeof cause === "object") {
    const record = cause as Record<string, unknown>;
    if (typeof record.message === "string" && record.message.trim()) return record.message;
    try {
      const serialized = JSON.stringify(cause);
      if (serialized && serialized !== "{}") return serialized;
    } catch {
      // Fall through to a safe generic message for circular error objects.
    }
  }
  return "Unexpected conversion error.";
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "Unknown size";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
