import { safePath } from "../lib/files";

export const archiveFormats = ["zip", "7z", "tar", "tar.gz", "tar.bz2", "tar.xz"] as const;
export type ArchiveFormat = (typeof archiveFormats)[number];
export const MAX_ARCHIVE_SIZE = 256 * 1024 * 1024;

/** Keep every input, even when files from different folders share a name. */
export function archiveEntries(files: File[]) {
  const used = new Set<string>();
  return files.map((file) => {
    const original = file.name;
    if (!original || !safePath(original) || /[\\/\x00-\x1f]/.test(original))
      throw new Error("Unsafe archive filename rejected.");
    const dot = original.lastIndexOf(".");
    const base = dot > 0 ? original.slice(0, dot) : original;
    const ext = dot > 0 ? original.slice(dot) : "";
    let pathname = original;
    let suffix = 2;
    const key = (name: string) => name.normalize("NFC").toLowerCase();
    while (used.has(key(pathname))) pathname = `${base} (${suffix++})${ext}`;
    used.add(key(pathname));
    return { file, pathname };
  });
}

export async function createArchive(files: File[], format: ArchiveFormat, password = "") {
  if (!files.length) throw new Error("Choose at least one file.");
  if (!archiveFormats.includes(format)) throw new Error("Unsupported archive output format.");
  if (files.length > 50) throw new Error("50 files maximum per archive.");
  if (files.reduce((total, file) => total + file.size, 0) > MAX_ARCHIVE_SIZE)
    throw new Error("256 MB total archive creation limit.");
  if (password && format !== "zip") throw new Error("Password encryption is supported for ZIP output only.");
  const entries = archiveEntries(files);
  const name = `birchize-archive.${format}`;
  let blob: Blob;
  if (format === "zip") {
    const { ZipWriter, BlobReader, BlobWriter } = await import("@zip.js/zip.js");
    const writer = new ZipWriter(new BlobWriter("application/zip"), {
      useWebWorkers: false,
      password: password || undefined,
      encryptionStrength: 3,
    });
    try {
      for (const { file, pathname } of entries)
        await writer.add(pathname, new BlobReader(file));
      blob = await writer.close();
    } catch (error) {
      await writer.close().catch(() => {});
      throw error;
    }
  } else {
    const { Archive } = await import("libarchive.js");
    const workerUrl = new URL(
      "engines/archive/worker-bundle.js",
      new URL(import.meta.env.BASE_URL, document.baseURI),
    ).href;
    const worker = new Worker(workerUrl, { type: "module" });
    Archive.init({ workerUrl, getWorker: () => worker });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const compression = {
        "7z": "gzip", tar: "gzip", "tar.gz": "gzip", "tar.bz2": "bzip2", "tar.xz": "xz",
      }[format];
      const write = async () => {
        if (format === "7z") {
          // The writer does not initialize the WASM C locale, so UTF-8 names
          // otherwise become replacement characters in 7Z's UTF-16 header.
          // The reader's open routine does initialize it. Prime this same
          // worker with a valid empty TAR before writing; finally terminates
          // the shared worker (do not close the temporary reader early).
          const locale = await Archive.open(new File([new Uint8Array(1024)], "empty.tar"));
          await locale.getFilesArray();
        }
        return Archive.write({
          files: entries, outputFileName: name, compression,
          format: format === "7z" ? "7zip" : "paxr", passphrase: null,
        });
      };
      blob = await Promise.race([
        write(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Archive creation timed out. Try a smaller batch.")), 120_000);
          worker.addEventListener("error", () => reject(new Error("The local archive engine could not start. Reload the page and try again.")), { once: true });
          worker.addEventListener("messageerror", () => reject(new Error("The local archive engine could not read this batch.")), { once: true });
        }),
      ]);
      // libarchive.js 2.0.2's `none` filter silently produces empty output.
      // Write through its working gzip filter, then remove ONLY that outer
      // wrapper locally. The result is a real TAR/7Z, not a renamed gzip file;
      // the 7Z container retains its internal compression.
      if (format === "tar" || format === "7z")
        blob = await new Response(blob.stream().pipeThrough(new DecompressionStream("gzip"))).blob();
    } finally {
      clearTimeout(timer);
      worker.terminate();
    }
  }
  if (!blob.size) throw new Error("Archive engine returned an empty file. No download was created.");
  return { name, blob };
}
