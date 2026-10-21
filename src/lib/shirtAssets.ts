// This file provides clean SVG shirt templates for Black/White and Front/Back views.
// Static files live in /public/shirts so next/image can preload them (LCP / CLS).
// It also includes a built-in high-resolution sample graphic so users can test right away.

import { BRAND_BLUE } from "@/lib/brand";
import { ShirtColor, ShirtView } from "@/types/order";

// Size the interactive stage with comfortable side margins on mobile screens (300x350) so thumbs can scroll easily.
export const STAGE_WIDTH = 300;
export const STAGE_HEIGHT = 350;

// The safe print zone represents the printable chest/back area on the T-shirt.
export const SAFE_PRINT_ZONE = {
  x: 88,
  y: 88,
  width: 124,
  height: 162,
};

/**
 * Public path for the base T-shirt template (matches files under /public/shirts).
 * Used by next/image (priority preload) and by Konva via useHtmlImage for canvas export.
 */
export function getShirtPublicSrc(color: ShirtColor, view: ShirtView): string {
  return `/shirts/${color}-${view}.svg`;
}

/** @deprecated Prefer getShirtPublicSrc — kept for any callers still using inline SVG data URLs. */
export function getShirtSvgDataUrl(color: ShirtColor, view: ShirtView): string {
  return getShirtPublicSrc(color, view);
}

// Front sample graphic (neon LIVE DROP) for quick Front-side testing.
export function getSampleArtworkDataUrl(): string {
  return buildSampleArtworkDataUrl("LIVE DROP", "LIMITED EDITION", "#ec4899", "#8b5cf6", BRAND_BLUE);
}

// Distinct Back sample graphic so Front and Back can be tested independently.
export function getSampleBackArtworkDataUrl(): string {
  return buildSampleArtworkDataUrl("BACK PRINT", "DUAL SIDED", BRAND_BLUE, "#a855f7", "#f472b6");
}

// Shared sample SVG builder with customizable labels and gradient colors.
function buildSampleArtworkDataUrl(
  title: string,
  subtitle: string,
  c1: string,
  c2: string,
  c3: string
): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
    <defs>
      <linearGradient id="neonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${c1}" />
        <stop offset="50%" stop-color="${c2}" />
        <stop offset="100%" stop-color="${c3}" />
      </linearGradient>
    </defs>
    <rect x="30" y="30" width="540" height="540" rx="72" fill="url(#neonGrad)" stroke="#ffffff" stroke-width="14" />
    <circle cx="300" cy="240" r="110" fill="#09090b" opacity="0.25" />
    <path d="M 225 250 L 285 180 L 325 225 L 385 155" fill="none" stroke="#ffffff" stroke-width="22" stroke-linecap="round" stroke-linejoin="round" />
    <text x="300" y="395" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-weight="900" font-size="56" letter-spacing="4">${title}</text>
    <text x="300" y="465" text-anchor="middle" fill="#fef08a" font-family="Arial, sans-serif" font-weight="700" font-size="34" letter-spacing="4">${subtitle}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
