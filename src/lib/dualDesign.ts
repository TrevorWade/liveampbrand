// Helpers for independent Front / Back side design state and the dual-sided checkout payload.

import {
  defaultPrintPxSize,
  fitSizeInsideSafeZone,
  SAFE_ZONE_PX_HEIGHT,
  SAFE_ZONE_PX_WIDTH,
  withPhysicalDimensions,
} from "@/lib/physicalDimensions";
import { roundCoord } from "@/lib/touchGestureMath";
import { PlacementData, SideDesign, SideDesignPayload, ShirtView } from "@/types/order";

// Contained baseline: 0.75 × zone W → 12.0", 0.575 × zone H → 11.5", centered in the Safe Print Zone.
const defaultPx = defaultPrintPxSize();

/** Default placement centered inside the Safe Print Zone (includes baseline print inches). */
export const DEFAULT_PLACEMENT: PlacementData = withPhysicalDimensions({
  x: roundCoord((SAFE_ZONE_PX_WIDTH - defaultPx.width) / 2),
  y: roundCoord((SAFE_ZONE_PX_HEIGHT - defaultPx.height) / 2),
  width: roundCoord(defaultPx.width),
  height: roundCoord(defaultPx.height),
  rotation: 0,
  scale: 1,
  physicalWidthInches: 0,
  physicalHeightInches: 0,
});

/**
 * Build a centered placement that matches the image's natural aspect ratio
 * (no stretch/squash when the upload first appears on the shirt).
 */
export function placementFittingImageAspect(
  naturalWidth: number,
  naturalHeight: number
): PlacementData {
  const { width, height } = fitSizeInsideSafeZone(naturalWidth, naturalHeight);
  return withPhysicalDimensions({
    x: roundCoord((SAFE_ZONE_PX_WIDTH - width) / 2),
    y: roundCoord((SAFE_ZONE_PX_HEIGHT - height) / 2),
    width: roundCoord(width),
    height: roundCoord(height),
    rotation: 0,
    scale: 1,
    physicalWidthInches: 0,
    physicalHeightInches: 0,
  });
}

// Create an empty side (no artwork) for testing 1-sided / blank states.
export function createEmptySideDesign(): SideDesign {
  return {
    originalImage: null,
    originalImageData: null,
    placementData: { ...DEFAULT_PLACEMENT },
    compositeProofImage: null,
    fileName: null,
    naturalWidth: null,
    naturalHeight: null,
  };
}

/**
 * Create a side with artwork.
 * displaySrc is what Konva draws (blob: URL preferred).
 * printDataUrl is the base64 raster payload for Resend (required when displaySrc is blob:).
 * naturalWidth/Height drive the initial aspect-correct fit inside the Safe Print Zone.
 */
export function createSideDesign(
  displaySrc: string,
  fileName: string | null,
  printDataUrl?: string | null,
  naturalWidth?: number | null,
  naturalHeight?: number | null
): SideDesign {
  const hasNatural = Boolean(naturalWidth && naturalHeight && naturalWidth > 0 && naturalHeight > 0);
  return {
    originalImage: displaySrc,
    // Fall back to displaySrc when callers still pass a data URL as the only src.
    originalImageData: printDataUrl ?? (displaySrc.startsWith("data:") ? displaySrc : null),
    placementData: hasNatural
      ? placementFittingImageAspect(naturalWidth as number, naturalHeight as number)
      : { ...DEFAULT_PLACEMENT },
    compositeProofImage: null,
    fileName,
    naturalWidth: hasNatural ? (naturalWidth as number) : null,
    naturalHeight: hasNatural ? (naturalHeight as number) : null,
  };
}

// Map a SideDesign into the exact designs.front / designs.back payload shape.
export function toSideDesignPayload(side: SideDesign): SideDesignPayload {
  const hasDesign = Boolean(side.originalImage);
  // Prefer the dedicated print data URL; never send a blob: URL to the server.
  const printData =
    side.originalImageData && side.originalImageData.startsWith("data:")
      ? side.originalImageData
      : side.originalImage && side.originalImage.startsWith("data:")
        ? side.originalImage
        : null;
  return {
    hasDesign,
    originalImageData: hasDesign ? printData : null,
    placementData: hasDesign ? side.placementData : null,
    compositeProofImage: hasDesign ? (side.compositeProofImage ?? null) : null,
  };
}

// Pick the active side design by current Front/Back view.
export function getActiveSide(front: SideDesign, back: SideDesign, view: ShirtView): SideDesign {
  return view === "front" ? front : back;
}

/** Wait helper used when briefly switching sides to capture composite proofs. */
export function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
