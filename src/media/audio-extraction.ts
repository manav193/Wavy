export const MAX_EXTRACTION_BYTES = 200 * 1024 * 1024;

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

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "Unknown size";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
