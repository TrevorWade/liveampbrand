// This file contains pure math functions for two-finger mobile touch gestures,
// center-preserving auto-straighten, and Safe Print Zone bounding box checks.

import { SAFE_PRINT_ZONE } from "@/lib/shirtAssets";
import { PlacementData } from "@/types/order";

export interface TouchPoint {
  x: number;
  y: number;
}

export interface MultiTouchSnapshot {
  lastDist: number;
  lastAngle: number;
  lastCenter: TouchPoint;
}

export interface BoundingBoxRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Calculate the Euclidean distance between two touch points on the screen.
export function getTouchDistance(p1: TouchPoint, p2: TouchPoint): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Calculate the center midpoint between two touch points.
export function getTouchCenter(p1: TouchPoint, p2: TouchPoint): TouchPoint {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };
}

// Calculate the angle in degrees between two touch points for two-finger twist rotation.
export function getTouchAngleDeg(p1: TouchPoint, p2: TouchPoint): number {
  const radians = Math.atan2(p2.y - p1.y, p2.x - p1.x);
  return (radians * 180) / Math.PI;
}

// Round a coordinate to two decimal places for clean display and payload tracking.
export function roundCoord(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Keep rotation in [0, 360) so Transformer / touch gestures never accumulate wild angles. */
export function normalizeRotationDeg(rotation: number): number {
  return ((rotation % 360) + 360) % 360;
}

/**
 * Stage coords of the artwork center from zone-relative top-left placement.
 * Used when the Konva Image pivots around offsetX/offsetY = width/2, height/2.
 */
export function placementToNodeCenter(placement: PlacementData): TouchPoint {
  const scale = Math.abs(placement.scale) || 1;
  return {
    x: SAFE_PRINT_ZONE.x + placement.x + (placement.width * scale) / 2,
    y: SAFE_PRINT_ZONE.y + placement.y + (placement.height * scale) / 2,
  };
}

/** Convert a Konva node center (stage) back to zone-relative top-left placement x/y. */
export function nodeCenterToPlacementXY(
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  scale: number
): { x: number; y: number } {
  const s = Math.abs(scale) || 1;
  return {
    x: roundCoord(centerX - SAFE_PRINT_ZONE.x - (width * s) / 2),
    y: roundCoord(centerY - SAFE_PRINT_ZONE.y - (height * s) / 2),
  };
}

// Helper to compute the visual center of a potentially rotated and scaled Konva Image node.
function getVisualCenter(placement: PlacementData): TouchPoint {
  const rad = (placement.rotation * Math.PI) / 180;
  const halfW = (placement.width * placement.scale) / 2;
  const halfH = (placement.height * placement.scale) / 2;
  return {
    x: placement.x + halfW * Math.cos(rad) - halfH * Math.sin(rad),
    y: placement.y + halfW * Math.sin(rad) + halfH * Math.cos(rad),
  };
}

// Compute the updated placement state and next touch snapshot from two active touch points.
// Scales and rotates around the graphic's visual center without clamping so Out of Bounds can trigger naturally.
export function computeTwoFingerGesture(
  p1: TouchPoint,
  p2: TouchPoint,
  prevSnapshot: MultiTouchSnapshot | null,
  currentPlacement: PlacementData
): { nextSnapshot: MultiTouchSnapshot; nextPlacement: PlacementData | null } {
  const dist = getTouchDistance(p1, p2);
  const angle = getTouchAngleDeg(p1, p2);
  const center = getTouchCenter(p1, p2);
  const nextSnapshot: MultiTouchSnapshot = {
    lastDist: dist,
    lastAngle: angle,
    lastCenter: center,
  };

  if (!prevSnapshot) {
    return { nextSnapshot, nextPlacement: null };
  }

  const scaleFactor = dist / Math.max(1, prevSnapshot.lastDist);
  const nextScale = Math.max(0.15, currentPlacement.scale * scaleFactor);
  const nextRotation = currentPlacement.rotation + (angle - prevSnapshot.lastAngle);
  const dx = center.x - prevSnapshot.lastCenter.x;
  const dy = center.y - prevSnapshot.lastCenter.y;

  const visualCenter = getVisualCenter(currentPlacement);
  const nextRad = (nextRotation * Math.PI) / 180;
  const nextHalfW = (currentPlacement.width * nextScale) / 2;
  const nextHalfH = (currentPlacement.height * nextScale) / 2;

  return {
    nextSnapshot,
    nextPlacement: {
      ...currentPlacement,
      x: roundCoord(visualCenter.x + dx - (nextHalfW * Math.cos(nextRad) - nextHalfH * Math.sin(nextRad))),
      y: roundCoord(visualCenter.y + dy - (nextHalfW * Math.sin(nextRad) + nextHalfH * Math.cos(nextRad))),
      scale: roundCoord(nextScale),
      rotation: roundCoord(normalizeRotationDeg(nextRotation)),
    },
  };
}

// Straighten the uploaded graphic to rotation = 0 while preserving its visual center on the shirt.
export function straightenPlacementAroundCenter(placement: PlacementData): PlacementData {
  if (placement.rotation === 0) return placement;
  const visualCenter = getVisualCenter(placement);
  const halfW = (placement.width * placement.scale) / 2;
  const halfH = (placement.height * placement.scale) / 2;
  return {
    ...placement,
    x: roundCoord(visualCenter.x - halfW),
    y: roundCoord(visualCenter.y - halfH),
    rotation: 0,
  };
}

// Compare Konva's node.getClientRect() against SAFE_PRINT_ZONE boundaries (top, bottom, left, right).
export function isRectOutOfSafeZone(rect: BoundingBoxRect): boolean {
  const eps = 0.5;
  const leftOut = rect.x < SAFE_PRINT_ZONE.x - eps;
  const topOut = rect.y < SAFE_PRINT_ZONE.y - eps;
  const rightOut = rect.x + rect.width > SAFE_PRINT_ZONE.x + SAFE_PRINT_ZONE.width + eps;
  const bottomOut = rect.y + rect.height > SAFE_PRINT_ZONE.y + SAFE_PRINT_ZONE.height + eps;
  return leftOut || topOut || rightOut || bottomOut;
}

/**
 * Clamp placement so the rotated artwork's axis-aligned bounding box stays inside SAFE_PRINT_ZONE.
 * Uses the rotated AABB (not an unrotated width/height assumption) to avoid snap/flip when spinning.
 */
export function clampPlacementInsideSafeZone(placement: PlacementData): PlacementData {
  const scale = Math.abs(placement.scale) || 1;
  const w = placement.width * scale;
  const h = placement.height * scale;
  const rad = (normalizeRotationDeg(placement.rotation) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  // Axis-aligned size of the rotated rectangle
  const aabbW = w * cos + h * sin;
  const aabbH = w * sin + h * cos;

  const centerX = SAFE_PRINT_ZONE.x + placement.x + w / 2;
  const centerY = SAFE_PRINT_ZONE.y + placement.y + h / 2;

  const minCX = SAFE_PRINT_ZONE.x + aabbW / 2;
  const maxCX = SAFE_PRINT_ZONE.x + SAFE_PRINT_ZONE.width - aabbW / 2;
  const minCY = SAFE_PRINT_ZONE.y + aabbH / 2;
  const maxCY = SAFE_PRINT_ZONE.y + SAFE_PRINT_ZONE.height - aabbH / 2;

  const clampedCX =
    maxCX < minCX ? SAFE_PRINT_ZONE.x + SAFE_PRINT_ZONE.width / 2 : Math.max(minCX, Math.min(centerX, maxCX));
  const clampedCY =
    maxCY < minCY ? SAFE_PRINT_ZONE.y + SAFE_PRINT_ZONE.height / 2 : Math.max(minCY, Math.min(centerY, maxCY));

  const xy = nodeCenterToPlacementXY(clampedCX, clampedCY, placement.width, placement.height, scale);
  return {
    ...placement,
    x: xy.x,
    y: xy.y,
    scale,
    rotation: roundCoord(normalizeRotationDeg(placement.rotation)),
  };
}
