import { FFmpeg } from "@ffmpeg/ffmpeg";
import { extension } from "../lib/files";
export interface MediaOptions {
  format: string;
  resolution: number;
  bitrate: number;
  compress: boolean;
}
export const audioFormats = [
  "mp3",
  "wav",
  "flac",
  "aac",
  "m4a",
  "ogg",
  "opus",
  "aiff",
];
export function mediaArguments(input: string, output: string, o: MediaOptions) {
  const args = ["-i", input];
  if (audioFormats.includes(o.format)) {
    args.push("-vn");
    const codec: Record<string, string> = {
      mp3: "libmp3lame",
      wav: "pcm_s16le",
      flac: "flac",
      aac: "aac",
      m4a: "aac",
      ogg: "libvorbis",
      opus: "libopus",
      aiff: "pcm_s16be",
    };
    args.push("-c:a", codec[o.format]);
    if (!["wav", "flac", "aiff"].includes(o.format))
      args.push("-b:a", `${o.bitrate}k`);
  } else if (o.format === "gif") {
    args.push(
      "-an",
      "-vf",
      `fps=12,scale=${o.resolution ? `min(${o.resolution}\\,iw)` : "min(720\\,iw)"}:-1:flags=lanczos`,
    );
  } else {
    const codecs: Record<string, string> = {
      mp4: "libx264",
      mov: "libx264",
      mkv: "libx264",
      avi: "mpeg4",
      webm: "libvpx-vp9",
      ts: "libx264",
    };
    args.push("-c:v", codecs[o.format] || "libx264");
    if (o.resolution) args.push("-vf", `scale=-2:min(${o.resolution}\\,ih)`);
    if (o.format === "webm")
      args.push(
        "-crf",
        o.compress ? "38" : "30",
        "-b:v",
        "0",
        "-c:a",
        "libopus",
      );
    else if (o.format === "avi")
      args.push("-q:v", o.compress ? "8" : "4", "-c:a", "libmp3lame");
    else
      args.push(
        "-preset",
        "ultrafast",
        "-crf",
        o.compress ? "28" : "21",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
      );
    args.push("-b:a", `${o.bitrate}k`);
    if (o.format === "mp4" || o.format === "mov")
      args.push("-movflags", "+faststart");
  }
  return [...args, "-y", output];
}
export class MediaEngine {
  private ffmpeg = new FFmpeg();
  private stopped = false;
  cancel() {
    this.stopped = true;
    this.ffmpeg.terminate();
  }
  async run(
    file: File,
    options: MediaOptions,
    onProgress: (value: number) => void,
  ) {
    this.stopped = false;
    const logs: string[] = [];
    this.ffmpeg.on("log", ({ message }) => {
      logs.push(message);
      if (logs.length > 12) logs.shift();
    });
    this.ffmpeg.on("progress", ({ progress }) =>
      onProgress(5 + Math.max(0, Math.min(1, progress)) * 90),
    );
    const base = new URL(import.meta.env.BASE_URL, document.baseURI);
    await this.ffmpeg.load({
      coreURL: new URL("engines/ffmpeg-core.js", base).href,
      wasmURL: new URL("engines/ffmpeg-core.wasm", base).href,
    });
    if (this.stopped) throw new Error("Cancelled");
    const input = `source.${extension(file.name).replace(/[^a-z0-9]/g, "") || "bin"}`,
      output = `result.${options.format}`;
    try {
      await this.ffmpeg.writeFile(
        input,
        new Uint8Array(await file.arrayBuffer()),
      );
      onProgress(5);
      const status = await this.ffmpeg.exec(
        mediaArguments(input, output, options),
        600_000,
      );
      if (status !== 0)
        throw new Error(`FFmpeg (${status}): ${logs.slice(-4).join(" · ")}`);
      const data = await this.ffmpeg.readFile(output);
      if (typeof data === "string" || !data.length)
        throw new Error("No output generated.");
      const mimes: Record<string, string> = {
        mp4: "video/mp4",
        mov: "video/quicktime",
        webm: "video/webm",
        mkv: "video/x-matroska",
        avi: "video/x-msvideo",
        ts: "video/mp2t",
        gif: "image/gif",
        mp3: "audio/mpeg",
        m4a: "audio/mp4",
        wav: "audio/wav",
        flac: "audio/flac",
        aac: "audio/aac",
        ogg: "audio/ogg",
        opus: "audio/ogg",
        aiff: "audio/aiff",
      };
      onProgress(100);
      return new Blob([new Uint8Array(data)], {
        type: mimes[options.format] || "application/octet-stream",
      });
    } finally {
      if (!this.stopped) {
        await this.ffmpeg.deleteFile(input).catch(() => {});
        await this.ffmpeg.deleteFile(output).catch(() => {});
      }
      this.ffmpeg.terminate();
    }
  }
}
