// Helpers for blob: object URLs created for Konva previews on mobile.
// Always revoke when a side is cleared or a design is replaced to free memory.

/** True when the string is a browser object URL (blob:...). */
export function isObjectUrl(url: string | null | undefined): boolean {
  return Boolean(url && url.startsWith("blob:"));
}

/** Revoke a blob object URL if present. Safe to call with data URLs or null. */
export function revokeObjectUrlIfNeeded(url: string | null | undefined): void {
  if (!isObjectUrl(url)) return;
  try {
    URL.revokeObjectURL(url as string);
  } catch {
    // Ignore revoke errors from already-freed URLs.
  }
}
