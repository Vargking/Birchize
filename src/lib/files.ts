export const MAX_FILE_SIZE = 512 * 1024 * 1024;
export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 3);
  return `${(bytes / 1024 ** index).toFixed(index === 1 ? 0 : 1)} ${["B", "KB", "MB", "GB"][index]}`;
}
export function extension(name: string) {
  return name.split(".").pop()?.toLowerCase() || "";
}
export function stem(name: string) {
  return name.replace(/\.[^.]+$/, "") || "birchize";
}
export function mergeFiles(existing: File[], incoming: File[], limit = 50) {
  const map = new Map(
    existing.map((file) => [
      `${file.name}:${file.size}:${file.lastModified}`,
      file,
    ]),
  );
  for (const file of incoming) {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (!map.has(key)) map.set(key, file);
  }
  return [...map.values()].slice(0, limit);
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
export function readableError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
export function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 32768)
    binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(binary);
}
export function base64ToBytes(text: string) {
  const binary = atob(text.replace(/^data:[^,]*,/, "").replace(/\s/g, ""));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
export function safePath(name: string) {
  return (
    !name.startsWith("/") &&
    !name.startsWith("\\") &&
    !/^[a-z]:/i.test(name) &&
    !name.split(/[\\/]/).includes("..")
  );
}
export function inferTool(file: File) {
  const ext = extension(file.name);
  if (ext === "svg") return "svg";
  if (
    file.type.startsWith("image/") ||
    ["tif", "tiff", "bmp", "ico"].includes(ext)
  )
    return "images";
  if (
    file.type.startsWith("video/") ||
    file.type.startsWith("audio/") ||
    ["mkv", "avi", "flac", "m4a", "mov", "ts", "opus", "aiff", "wmv"].includes(
      ext,
    )
  )
    return "media";
  if (
    [
      "zip",
      "7z",
      "rar",
      "tar",
      "gz",
      "bz2",
      "xz",
      "tgz",
      "zst",
      "iso",
      "cab",
    ].includes(ext)
  )
    return "archives";
  if (ext === "birch") return "crypto";
  return "documents";
}
