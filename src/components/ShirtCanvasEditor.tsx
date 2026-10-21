"use client";

// Dual Konva stages: Front and Back stay mounted at all times.
// Visibility uses CSS opacity (never display:none) so iOS Safari keeps canvas buffers.
// Submit snapshots both stage refs via toDataURL without remounting or view-swapping.

import React, { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { STAGE_HEIGHT, STAGE_WIDTH } from "@/lib/shirtAssets";
import { HtmlImageStatus } from "@/lib/useHtmlImage";
import { placementFittingImageAspect } from "@/lib/dualDesign";
import { PhysicalDimensionsDisplay } from "@/lib/physicalDimensions";
import CanvasUtilityToolbar from "@/components/CanvasUtilityToolbar";
import CanvasInfoOverlays from "@/components/CanvasInfoOverlays";
import ShirtSideStage, { ShirtSideStageHandle } from "@/components/ShirtSideStage";
import { PlacementData, ShirtCanvasHandle, ShirtColor, ShirtView, SideDesign } from "@/types/order";

interface ShirtCanvasEditorProps {
  shirtColor: ShirtColor;
  view: ShirtView;
  frontDesign: SideDesign;
  backDesign: SideDesign;
  onPlacementChange: (side: ShirtView, next: PlacementData) => void;
  onLivePhysicalDimensions?: (dims: PhysicalDimensionsDisplay) => void;
  physicalDimensions: PhysicalDimensionsDisplay;
  showGuides: boolean;
  onToggleGuides: () => void;
  onAutoStraighten: () => void;
  onResetPlacement: () => void;
  onClearSide: () => void;
  /** True when both Front and Back shirt SVG templates report status === "loaded". */
  onShirtTemplatesLoadedChange?: (loaded: boolean) => void;
  canvasRef?: React.Ref<ShirtCanvasHandle>;
}

const ShirtCanvasEditor = forwardRef<ShirtCanvasHandle, ShirtCanvasEditorProps>(function ShirtCanvasEditor(p, ref) {
  const {
    shirtColor,
    view,
    frontDesign,
    backDesign,
    onPlacementChange,
    onLivePhysicalDimensions,
    physicalDimensions,
    showGuides,
    onToggleGuides,
    onAutoStraighten,
    onResetPlacement,
    onClearSide,
    onShirtTemplatesLoadedChange,
    canvasRef,
  } = p;

  // Separate stage handles — Submit calls toDataURL on both without view switching.
  const frontStageRef = useRef<ShirtSideStageHandle | null>(null);
  const backStageRef = useRef<ShirtSideStageHandle | null>(null);

  const [frontShirtStatus, setFrontShirtStatus] = useState<HtmlImageStatus>("loading");
  const [backShirtStatus, setBackShirtStatus] = useState<HtmlImageStatus>("loading");

  // Derive Submit gate from both side statuses (avoids stale closures when one side finishes first).
  useEffect(() => {
    onShirtTemplatesLoadedChange?.(frontShirtStatus === "loaded" && backShirtStatus === "loaded");
  }, [frontShirtStatus, backShirtStatus, onShirtTemplatesLoadedChange]);

  const active = view === "front" ? frontDesign : backDesign;
  const hasActiveDesign = Boolean(active.originalImage);

  useImperativeHandle(canvasRef || ref, () => ({
    // Export one side from its continuously mounted stage ref.
    exportCompositeProof: (side?: ShirtView) => {
      const target = side ?? view;
      const handle = target === "front" ? frontStageRef.current : backStageRef.current;
      return handle?.exportCompositeProof() || "";
    },
    // Capture both sides in one shot — no setView / remount required.
    exportBothCompositeProofs: () => ({
      front: frontStageRef.current?.exportCompositeProof() || "",
      back: backStageRef.current?.exportCompositeProof() || "",
    }),
    centerAndResetDesign: () => {
      const imgSrc = active.originalImage;
      if (active.naturalWidth && active.naturalHeight) {
        onPlacementChange(view, placementFittingImageAspect(active.naturalWidth, active.naturalHeight));
        return;
      }
      if (imgSrc) {
        onPlacementChange(view, placementFittingImageAspect(active.placementData.width, active.placementData.height));
      }
    },
    areShirtTemplatesLoaded: () => frontShirtStatus === "loaded" && backShirtStatus === "loaded",
  }));

  // Active: relative + opaque. Inactive: absolute + opacity-0 (NOT display:none — preserves canvas on iOS).
  const frontWrapClass =
    view === "front"
      ? "relative z-10 opacity-100"
      : "absolute top-0 left-0 -z-10 opacity-0 pointer-events-none";
  const backWrapClass =
    view === "back"
      ? "relative z-10 opacity-100"
      : "absolute top-0 left-0 -z-10 opacity-0 pointer-events-none";

  return (
    <div className="relative w-full pt-9 pb-9 px-3 rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 shadow-2xl flex flex-col items-center touch-pan-y">
      <CanvasInfoOverlays
        view={view}
        fileName={active.fileName || null}
        hasActiveDesign={hasActiveDesign}
        physicalDimensions={physicalDimensions}
      />
      {/* Fixed stage box reserves layout space. Both stages stay in the DOM. */}
      <div className="relative overflow-hidden rounded-xl touch-pan-y" style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT }}>
        {/* Explicit size on both wraps so the absolute (inactive) side keeps a full canvas box. */}
        <div className={frontWrapClass} style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT }}>
          <ShirtSideStage
            ref={frontStageRef}
            side="front"
            isActive={view === "front"}
            shirtColor={shirtColor}
            originalImageData={frontDesign.originalImage}
            placement={frontDesign.placementData}
            onPlacementChange={(next) => onPlacementChange("front", next)}
            onLivePhysicalDimensions={view === "front" ? onLivePhysicalDimensions : undefined}
            showGuides={showGuides}
            onShirtTemplateStatus={setFrontShirtStatus}
          />
        </div>
        <div className={backWrapClass} style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT }}>
          <ShirtSideStage
            ref={backStageRef}
            side="back"
            isActive={view === "back"}
            shirtColor={shirtColor}
            originalImageData={backDesign.originalImage}
            placement={backDesign.placementData}
            onPlacementChange={(next) => onPlacementChange("back", next)}
            onLivePhysicalDimensions={view === "back" ? onLivePhysicalDimensions : undefined}
            showGuides={showGuides}
            onShirtTemplateStatus={setBackShirtStatus}
          />
        </div>
        <CanvasUtilityToolbar
          showGuides={showGuides}
          hasActiveDesign={hasActiveDesign}
          onToggleGuides={onToggleGuides}
          onAutoStraighten={onAutoStraighten}
          onResetPlacement={onResetPlacement}
          onClearSide={onClearSide}
        />
      </div>
    </div>
  );
});

export default ShirtCanvasEditor;
