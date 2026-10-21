"use client";

// Filename + print-size chips on the outer preview card corners (not over the shirt).

import React from "react";
import { PhysicalDimensionsDisplay } from "@/lib/physicalDimensions";
import { ShirtView } from "@/types/order";

interface CanvasInfoOverlaysProps {
  view: ShirtView;
  fileName: string | null;
  hasActiveDesign: boolean;
  physicalDimensions: PhysicalDimensionsDisplay;
}

export default function CanvasInfoOverlays({
  view,
  fileName,
  hasActiveDesign,
  physicalDimensions,
}: CanvasInfoOverlaysProps) {
  const sideLabel = view === "front" ? "Front" : "Back";
  const nameChip = hasActiveDesign
    ? `${sideLabel}: ${fileName || "Custom artwork"}`
    : `${sideLabel}: No design`;

  return (
    <>
      {/* Outer-card top-left — sits in the frame gutter, clear of the shirt */}
      <div className="absolute left-2 top-2 z-10 pointer-events-none max-w-[58%]">
        <p className="truncate rounded-md bg-black/75 backdrop-blur-sm px-2 py-1 text-[11px] font-medium text-zinc-100 border border-white/10 shadow">
          {nameChip}
        </p>
      </div>

      {/* Outer-card bottom-left — live inches while scaling */}
      {hasActiveDesign && (
        <div className="absolute left-2 bottom-2 z-10 pointer-events-none max-w-[70%]">
          <p className="font-mono text-sm text-brand-blue rounded-md bg-black/75 backdrop-blur-sm px-2 py-1 border border-brand-blue/40 shadow">
            Print Size: {physicalDimensions.width}&quot; W x {physicalDimensions.height}&quot; H
          </p>
        </div>
      )}
    </>
  );
}
