// Image upload helpers: MIME checks, phone-friendly soft size limit, and client-side compress/resize.
// We never block typical camera photos with a tiny hard MB cap — we accept first, then compress for Konva/print.
// Transparent PNG/WebP stay PNG/WebP — never flatten alpha into a black JPEG background.

/** Soft raw-input ceiling so extreme multi-dozen-MB dumps are rejected before decode. Phone photos are fine. */
export const MAX_RAW_INPUT_BYTES = 20 * 1024 * 1024;

/** Longest edge for the print-ready image stored as originalImage (keeps RIP quality without huge payloads). */
export const MAX_PRINT_DIMENSION = 2048;

/** JPEG quality for the compressed print-ready data URL (JPEG only). */
export const PRINT_JPEG_QUALITY = 0.92;

/** Quality hint for WebP re-encode after resize. */
export const PRINT_WEBP_QUALITY = 0.95;

/** Raster MIME types accepted from the file picker and contest server action (SVGs remain rejected). */
export const ALLOWED_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

/** HTML file-input accept list — extensions only so pickers stay strict. */
export const ALLOWED_IMAGE_ACCEPT = ".png,.jpg,.jpeg,.webp";

/** True when the MIME is an allowed raster type (rejects image/svg+xml and everything else). */
export function isAllowedImageMime(mime: string): boolean {
  const normalized = (mime || "").toLowerCase().trim();
  return (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(normalized);
}

/** Read the MIME from a data URL header, e.g. data:image/png;base64,... */
export function getDataUrlMimeType(dataUrl: string): string | null {
  const match = /^data:([^;,]+)/i.exec(dataUrl || "");
  return match ? match[1].toLowerCase().trim() : null;
}

/** Strict data-URL gate used by the contest server action before Resend attachments. */
export function isAllowedImageDataUrl(dataUrl: string): boolean {
  const mime = getDataUrlMimeType(dataUrl);
  if (!mime) return false;
  // Explicit reject for SVG (and any non-raster) even if somehow listed later.
  if (mime === "image/svg+xml" || mime.includes("svg")) return false;
  // Reject executables / scripts disguised as images.
  if (
    mime.startsWith("application/") ||
    mime.startsWith("text/") ||
    mime.includes("javascript") ||
    mime.includes("ecmascript")
  ) {
    return false;
  }
  // Must be base64-encoded raster — utf8 / raw SVG payloads are rejected.
  if (!/;base64,/i.test(dataUrl)) return false;
  return isAllowedImageMime(mime);
}

export interface ImageUploadValidationResult {
  ok: boolean;
  errorMessage?: string;
}

export interface ProcessedImageUpload {
  ok: true;
  /** Base64 data URL for the contest server action / Resend attachments. */
  dataUrl: string;
  /**
   * blob: object URL for Konva display. Caller must revoke with
   * URL.revokeObjectURL (see revokeObjectUrlIfNeeded) on Clear Side / replace.
   */
  objectUrl: string;
  fileName: string;
  /** Pixel size after compress/resize — used for aspect-correct Konva placement. */
  width: number;
  height: number;
}

export interface FailedImageUpload {
  ok: false;
  errorMessage: string;
}

// Validate MIME + soft raw-size only. No hard 1MB reject — compression happens after accept.
export function validateImageUploadFile(file: File): ImageUploadValidationResult {
  const mime = (file.type || "").toLowerCase();
  // Some Android cameras report empty type; infer from extension when needed.
  const inferred = mime || inferMimeFromName(file.name);
  if (!(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(inferred)) {
    return {
      ok: false,
      errorMessage: "Please upload a PNG, JPEG, or WebP image (SVGs and other formats are not supported).",
    };
  }
  if (file.size > MAX_RAW_INPUT_BYTES) {
    return {
      ok: false,
      errorMessage: "Image is too large to process (over 20MB). Please choose a smaller photo.",
    };
  }
  return { ok: true };
}

// Accept the file, then resize/compress while preserving the native format (PNG keeps transparency).
export async function processImageUploadFile(file: File): Promise<ProcessedImageUpload | FailedImageUpload> {
  const validation = validateImageUploadFile(file);
  if (!validation.ok) {
    return { ok: false, errorMessage: validation.errorMessage || "Upload rejected." };
  }
  try {
    const sourceMime = resolveUploadMime(file);
    const { dataUrl, objectUrl, width, height, mime } = await compressImageFileToUrls(file, sourceMime);
    const baseName = file.name.replace(/\.[^.]+$/, "") || "phone-photo";
    return {
      ok: true,
      dataUrl,
      objectUrl,
      fileName: `${baseName}.${extensionForMime(mime)}`,
      width,
      height,
    };
  } catch (err) {
    console.error("Failed to compress uploaded image:", err);
    return { ok: false, errorMessage: "Could not process that image. Please try another photo." };
  }
}

/** Strip a data-URL header so only raw base64 remains. Works for png/jpeg/webp. */
export function stripDataUrlBase64Prefix(dataUrl: string): string | null {
  const match = /^data:[^;]+;base64,([\s\S]+)$/i.exec(dataUrl || "");
  return match ? match[1] : null;
}

/**
 * Decode the File, downscale when needed, and keep the native MIME.
 * - No resize → original bytes via FileReader (PNG/WebP alpha untouched).
 * - Resize → canvas export as JPEG only for JPEGs; PNG/WebP stay alpha-capable.
 */
async function compressImageFileToUrls(
  file: File,
  sourceMime: string
): Promise<{ dataUrl: string; objectUrl: string; width: number; height: number; mime: string }> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_PRINT_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    // Already within print size — keep original bytes (no canvas re-encode / no black fill).
    if (scale >= 1) {
      const dataUrl = await readFileAsDataUrl(file);
      const objectUrl = URL.createObjectURL(file);
      return { dataUrl, objectUrl, width: bitmap.width, height: bitmap.height, mime: sourceMime };
    }

    // Offscreen resize — export format preserves transparency for non-JPEG uploads.
    const outMime = exportMimeForUpload(sourceMime);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: outMime !== "image/jpeg" });
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    // Do not fill a background — leave the canvas transparent for PNG/WebP.
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    const quality = outMime === "image/jpeg" ? PRINT_JPEG_QUALITY : PRINT_WEBP_QUALITY;
    const blob = await canvasToBlob(canvas, outMime, quality);
    const objectUrl = URL.createObjectURL(blob);
    const dataUrl = await readFileAsDataUrl(blob);
    return { dataUrl, objectUrl, width, height, mime: outMime };
  } finally {
    bitmap.close();
  }
}

/** JPEG stays JPEG; everything else that can carry alpha exports as PNG (or WebP when source was WebP). */
function exportMimeForUpload(sourceMime: string): string {
  if (sourceMime === "image/jpeg") return "image/jpeg";
  if (sourceMime === "image/webp") return "image/webp";
  // Default for PNG and unknown — never force JPEG (that flattens transparency to black).
  return "image/png";
}

function resolveUploadMime(file: File): string {
  const mime = (file.type || "").toLowerCase().trim();
  if (isAllowedImageMime(mime)) return mime;
  return inferMimeFromName(file.name) || "image/png";
}

function extensionForMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  return "png";
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) {
          resolve(result);
          return;
        }
        // Some browsers reject image/webp on toBlob — fall back to PNG to keep alpha.
        if (mime === "image/webp") {
          canvas.toBlob(
            (png) => (png ? resolve(png) : reject(new Error("toBlob failed"))),
            "image/png"
          );
          return;
        }
        reject(new Error("toBlob failed"));
      },
      mime,
      quality
    );
  });
}

/** FileReader path — preserves the file's native MIME in the data URL header. */
function readFileAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
}

function inferMimeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  return "";
}
