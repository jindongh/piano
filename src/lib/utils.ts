import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function formatDate(ts: number) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(ts);
}

export async function compressImage(
  source: Blob | HTMLCanvasElement | HTMLVideoElement,
  opts: { maxW?: number; quality?: number } = {},
): Promise<string> {
  const maxW = opts.maxW ?? 1280;
  const quality = opts.quality ?? 0.72;

  let bitmap: ImageBitmap | HTMLCanvasElement | HTMLVideoElement;
  if (source instanceof Blob) {
    bitmap = await createImageBitmap(source);
  } else {
    bitmap = source;
  }

  const srcW =
    "videoWidth" in bitmap && bitmap.videoWidth
      ? bitmap.videoWidth
      : "width" in bitmap
        ? (bitmap as { width: number }).width
        : 1280;
  const srcH =
    "videoHeight" in bitmap && bitmap.videoHeight
      ? bitmap.videoHeight
      : "height" in bitmap
        ? (bitmap as { height: number }).height
        : 720;

  const scale = Math.min(1, maxW / Math.max(srcW, 1));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(srcW * scale));
  canvas.height = Math.max(1, Math.round(srcH * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法处理图片");
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();
  return canvas.toDataURL("image/jpeg", quality);
}
