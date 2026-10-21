"use client";

// Floating vertical icon toolbar overlaid on the Konva canvas.
// Order: Hide Guides → Auto Straighten → Reset → Clear.
// Touch/pointer events are stopped so taps never start a drag on the Stage beneath.

import React from "react";
import { Eye, EyeOff, Ruler, RotateCcw, Trash2 } from "lucide-react";

interface CanvasUtilityToolbarProps {
  showGuides: boolean;
  hasActiveDesign: boolean;
  onToggleGuides: () => void;
  onAutoStraighten: () => void;
  onResetPlacement: () => void;
  onClearSide: () => void;
}

const btnClass =
  "w-10 h-10 rounded-full bg-gray-800/90 backdrop-blur text-gray-200 flex items-center justify-center border border-gray-700 shadow-lg active:scale-95 transition-all pointer-events-auto disabled:opacity-40 touch-manipulation";

/** Stop the event so the floating toolbar never forwards touches into the Konva Stage. */
function stopCanvasBleed(event: React.SyntheticEvent) {
  event.stopPropagation();
  // preventDefault on pointerdown blocks the gesture from becoming a Stage drag underneath.
  if ("cancelable" in event && (event as React.PointerEvent).cancelable) {
    event.preventDefault();
  }
}

export default function CanvasUtilityToolbar({
  showGuides,
  hasActiveDesign,
  onToggleGuides,
  onAutoStraighten,
  onResetPlacement,
  onClearSide,
}: CanvasUtilityToolbarProps) {
  return (
    <div
      className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-20 pointer-events-none"
      onPointerDown={stopCanvasBleed}
      onTouchStart={stopCanvasBleed}
    >
      <button
        type="button"
        onClick={onToggleGuides}
        onPointerDown={stopCanvasBleed}
        onTouchStart={stopCanvasBleed}
        className={btnClass}
        aria-label={showGuides ? "Hide guides" : "Show guides"}
        title={showGuides ? "Hide Guides" : "Show Guides"}
      >
        {showGuides ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
      {/* Ruler reads as straighten/level better than a magic wand */}
      <button
        type="button"
        onClick={onAutoStraighten}
        onPointerDown={stopCanvasBleed}
        onTouchStart={stopCanvasBleed}
        disabled={!hasActiveDesign}
        className={btnClass}
        aria-label="Auto straighten image"
        title="Auto Straighten"
      >
        <Ruler className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onResetPlacement}
        onPointerDown={stopCanvasBleed}
        onTouchStart={stopCanvasBleed}
        disabled={!hasActiveDesign}
        className={btnClass}
        aria-label="Reset placement"
        title="Reset"
      >
        <RotateCcw className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onClearSide}
        onPointerDown={stopCanvasBleed}
        onTouchStart={stopCanvasBleed}
        disabled={!hasActiveDesign}
        className={btnClass}
        aria-label="Clear side design"
        title="Clear Side"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
