import { extension } from "../lib/files";
import { cleanSvg } from "../lib/svg";

export interface ImageOptions {
  format: string;
  quality: number;
  maxWidth: number;
  compress: boolean;
  targetKB: number;
  background: string;
}
export async function loadImage(
  file: Blob,
  name = "",
): Promise<HTMLImageElement> {
  let source = file;
  if (["tif", "tiff"].includes(extension(name))) {
    const UTIF = await import("utif");
    const buffer = await file.arrayBuffer();
    const frames = UTIF.decode(buffer);
    if (!frames[0]) throw new Error("No TIFF frame found.");
    UTIF.decodeImage(buffer, frames[0]);
    const frame = frames[0];
    if (frame.width * frame.height > 40_000_000)
      throw new Error("Image exceeds the 40 megapixel safety limit.");
    const canvas = document.createElement("canvas");
    canvas.width = frame.width;
    canvas.height = frame.height;
    canvas
      .getContext("2d")!
      .putImageData(
        new ImageData(
          new Uint8ClampedArray(UTIF.toRGBA8(frame)),
          frame.width,
          frame.height,
        ),
        0,
        0,
      );
    source = await canvasBlob(canvas, "image/png", 1);
  } else if (extension(name) === "svg" || file.type === "image/svg+xml") {
    source = new Blob([cleanSvg(await file.text())], { type: "image/svg+xml" });
  }
  const url = URL.createObjectURL(source);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (img.naturalWidth * img.naturalHeight > 40_000_000)
      throw new Error("Image exceeds the 40 megapixel safety limit.");
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}
function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("Image encoding failed."));
        else if (blob.type !== type)
          reject(
            new Error(
              `This browser cannot encode ${type}. Try PNG, JPEG or WebP.`,
            ),
          );
        else resolve(blob);
      },
      type,
      quality,
    ),
  );
}
function bmpBlob(canvas: HTMLCanvasElement) {
  const { width: w, height: h } = canvas;
  const stride = Math.ceil((w * 3) / 4) * 4;
  const bytes = new Uint8Array(54 + stride * h);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, 0x4d42, true);
  view.setUint32(2, bytes.length, true);
  view.setUint32(10, 54, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, w, true);
  view.setInt32(22, h, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 24, true);
  view.setUint32(34, stride * h, true);
  const data = canvas.getContext("2d")!.getImageData(0, 0, w, h).data;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const from = (y * w + x) * 4,
        to = 54 + (h - 1 - y) * stride + x * 3;
      bytes[to] = data[from + 2];
      bytes[to + 1] = data[from + 1];
      bytes[to + 2] = data[from];
    }
  return new Blob([bytes], { type: "image/bmp" });
}
export async function convertImage(file: File, options: ImageOptions) {
  const img = await loadImage(file, file.name);
  const originalWidth = img.naturalWidth,
    originalHeight = img.naturalHeight;
  let width = Math.min(originalWidth, options.maxWidth || originalWidth);
  if (options.format === "ico") width = Math.min(width, 256);
  const canvas = document.createElement("canvas");
  const mime =
    options.format === "jpg" ? "image/jpeg" : `image/${options.format}`;
  const render = async (quality: number) => {
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(
      1,
      Math.round((originalHeight / originalWidth) * width),
    );
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    if (["jpg", "bmp"].includes(options.format)) {
      ctx.fillStyle = options.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    if (options.format === "bmp") return bmpBlob(canvas);
    if (options.format === "ico") {
      const png = new Uint8Array(
        await (await canvasBlob(canvas, "image/png", 1)).arrayBuffer(),
      );
      const bytes = new Uint8Array(22 + png.length);
      const view = new DataView(bytes.buffer);
      view.setUint16(2, 1, true);
      view.setUint16(4, 1, true);
      bytes[6] = canvas.width === 256 ? 0 : canvas.width;
      bytes[7] = canvas.height >= 256 ? 0 : canvas.height;
      view.setUint16(10, 1, true);
      view.setUint16(12, 32, true);
      view.setUint32(14, png.length, true);
      view.setUint32(18, 22, true);
      bytes.set(png, 22);
      return new Blob([bytes], { type: "image/x-icon" });
    }
    return canvasBlob(canvas, mime, quality);
  };
  if (
    options.format === "ico" &&
    (originalHeight / originalWidth) * width > 256
  )
    width = (256 * originalWidth) / originalHeight;
  let quality = options.quality;
  let blob = await render(quality);
  if (options.compress) {
    const target = options.targetKB * 1024;
    if (!Number.isFinite(target) || target < 1024)
      throw new Error("Target size must be at least 1 KB.");
    for (let attempt = 0; blob.size > target && attempt < 12; attempt++) {
      if (["jpg", "webp", "avif"].includes(options.format)) {
        let low = 0.7,
          high = options.quality,
          candidate: Blob | null = null;
        for (let j = 0; j < 6; j++) {
          const q = (low + high) / 2;
          const result = await render(q);
          if (result.size <= target) {
            candidate = result;
            quality = q;
            low = q;
          } else high = q;
        }
        if (candidate) {
          blob = candidate;
          break;
        }
      }
      width = Math.max(
        1,
        width * Math.min(0.87, Math.sqrt(target / blob.size) * 0.93),
      );
      quality = Math.max(0.7, options.quality);
      blob = await render(quality);
    }
  }
  return {
    blob,
    width: canvas.width,
    height: canvas.height,
    quality,
    targetMet: !options.compress || blob.size <= options.targetKB * 1024,
    originalWidth,
    originalHeight,
  };
}
