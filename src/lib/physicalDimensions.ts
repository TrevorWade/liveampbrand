// Convert Konva pixel size inside the Safe Print Zone to real-world inches
// using the Kornit Avalanche HD6 standard pallet (16" × 20").

import { SAFE_PRINT_ZONE } from "@/lib/shirtAssets";
import { PlacementData } from "@/types/order";

/** Kornit Avalanche HD6 standard pallet width in inches. */
export const PHYSICAL_PALLET_WIDTH_INCHES = 16;

/** Kornit Avalanche HD6 standard pallet height in inches. */
export const PHYSICAL_PALLET_HEIGHT_INCHES = 20;

/** Safe Print Zone pixel size (matches SAFE_PRINT_ZONE on the Konva stage). */
export const SAFE_ZONE_PX_WIDTH = SAFE_PRINT_ZONE.width;
export const SAFE_ZONE_PX_HEIGHT = SAFE_PRINT_ZONE.height;

/**
 * Baseline sample/upload fit: 75% of zone width → 12.0" and 57.5% of zone height → 11.5"
 * (Kornit 16"×20" pallet mapping).
 */
export const DEFAULT_PRINT_WIDTH_ZONE_FRAC = 0.75;
export const DEFAULT_PRINT_HEIGHT_ZONE_FRAC = 0.575;

/** Pixel size for the default contained placement (hits 12.0" W × 11.5" H at scale 1). */
export function defaultPrintPxSize(): { width: number; height: number } {
  return {
    width: SAFE_ZONE_PX_WIDTH * DEFAULT_PRINT_WIDTH_ZONE_FRAC,
    height: SAFE_ZONE_PX_HEIGHT * DEFAULT_PRINT_HEIGHT_ZONE_FRAC,
  };
}

/**
 * Fit an image inside the Safe Print Zone without distorting its natural aspect ratio.
 * Uses the same max box as the old default placement (75% zone W × 57.5% zone H).
 */
export function fitSizeInsideSafeZone(
  naturalWidth: number,
  naturalHeight: number
): { width: number; height: number } {
  const maxAllowedWidth = SAFE_ZONE_PX_WIDTH * DEFAULT_PRINT_WIDTH_ZONE_FRAC;
  const maxAllowedHeight = SAFE_ZONE_PX_HEIGHT * DEFAULT_PRINT_HEIGHT_ZONE_FRAC;
  const aspect = naturalWidth / Math.max(1, naturalHeight);
  const boxAspect = maxAllowedWidth / maxAllowedHeight;

  let width: number;
  let height: number;

  // Wider than the allowed box → lock width; taller → lock height (preserves aspect).
  if (aspect > boxAspect) {
    width = maxAllowedWidth;
    height = maxAllowedWidth / aspect;
  } else {
    height = maxAllowedHeight;
    width = maxAllowedHeight * aspect;
  }

  return { width, height };
}

export interface PhysicalDimensionsInches {
  widthInches: number;
  heightInches: number;
}

/** Display strings formatted to one decimal place for the Print Size UI. */
export interface PhysicalDimensionsDisplay {
  width: string;
  height: string;
}

// Map current artwork pixel size to pallet inches.
export function calcPhysicalDimensionsInches(
  currentPxWidth: number,
  currentPxHeight: number
): PhysicalDimensionsInches {
  const widthInches = (currentPxWidth / SAFE_ZONE_PX_WIDTH) * PHYSICAL_PALLET_WIDTH_INCHES;
  const heightInches = (currentPxHeight / SAFE_ZONE_PX_HEIGHT) * PHYSICAL_PALLET_HEIGHT_INCHES;
  return {
    widthInches: Math.round(widthInches * 10) / 10,
    heightInches: Math.round(heightInches * 10) / 10,
  };
}

// Format numeric inches as stable one-decimal display strings.
export function formatPhysicalDimensionsDisplay(
  dims: PhysicalDimensionsInches
): PhysicalDimensionsDisplay {
  return {
    width: dims.widthInches.toFixed(1),
    height: dims.heightInches.toFixed(1),
  };
}

// Derive display strings directly from placement (width × scale).
export function physicalDisplayFromPlacement(placement: PlacementData): PhysicalDimensionsDisplay {
  return formatPhysicalDimensionsDisplay(
    calcPhysicalDimensionsInches(placement.width * placement.scale, placement.height * placement.scale)
  );
}

// Attach numeric physical inches onto placementData for the contest email payload.
export function withPhysicalDimensions(placement: PlacementData): PlacementData {
  const { widthInches, heightInches } = calcPhysicalDimensionsInches(
    placement.width * placement.scale,
    placement.height * placement.scale
  );
  return {
    ...placement,
    physicalWidthInches: widthInches,
    physicalHeightInches: heightInches,
  };
}
