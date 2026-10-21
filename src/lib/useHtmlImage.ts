"use client";

// This custom React hook loads a URL or base64 data URL into a browser HTMLImageElement.
// Konva's <Image /> component requires an HTMLImageElement instance to draw onto the 2D canvas.
// Cleanup cancels in-flight loads so Front/Back toggles do not leak Image decoders.
// Returns status so Submit can wait until shirt templates are fully painted.

import { useEffect, useState } from "react";

export type HtmlImageStatus = "idle" | "loading" | "loaded" | "failed";

export interface HtmlImageResult {
  image: HTMLImageElement | null;
  status: HtmlImageStatus;
}

export function useHtmlImage(src: string | null): HtmlImageResult {
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [status, setStatus] = useState<HtmlImageStatus>(src ? "loading" : "idle");

  useEffect(() => {
    if (!src) {
      setImageElement(null);
      setStatus("idle");
      return;
    }

    let cancelled = false;
    setStatus("loading");
    setImageElement(null);
    // Create a new browser Image object and set crossOrigin to anonymous for clean canvas exports.
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      setImageElement(img);
      setStatus("loaded");
    };
    img.onerror = () => {
      if (cancelled) return;
      setImageElement(null);
      setStatus("failed");
    };
    img.src = src;

    return () => {
      // Abort the load callback chain when src changes (color/side toggle) or the Stage unmounts.
      cancelled = true;
      img.onload = null;
      img.onerror = null;
      // Drop the decoder reference; do NOT revoke blob: here — that is owned by SideDesign state.
      img.src = "";
    };
  }, [src]);

  return { image: imageElement, status };
}
