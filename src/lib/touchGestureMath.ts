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
      rotation: roundCoord(nextRotation),
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
