"use client";

// Konva canvas: OOB checks + live print-size inches; floating utility toolbar overlay.

import React, { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { Stage, Layer, Image as KonvaImage, Rect, Text, Group, Transformer } from "react-konva";
import Konva from "konva";
import { SAFE_PRINT_ZONE, STAGE_HEIGHT, STAGE_WIDTH, getShirtPublicSrc } from "@/lib/shirtAssets";
import { MultiTouchSnapshot, computeTwoFingerGesture, isRectOutOfSafeZone, roundCoord } from "@/lib/touchGestureMath";
import { calcPhysicalDimensionsInches, formatPhysicalDimensionsDisplay, PhysicalDimensionsDisplay, withPhysicalDimensions } from "@/lib/physicalDimensions";
import { BRAND_BLUE } from "@/lib/brand";
import { DEFAULT_PLACEMENT } from "@/lib/dualDesign";
import { useHtmlImage } from "@/lib/useHtmlImage";
import CanvasUtilityToolbar from "@/components/CanvasUtilityToolbar";
import CanvasInfoOverlays from "@/components/CanvasInfoOverlays";
import ShirtTemplateImage from "@/components/ShirtTemplateImage";
import RotateAnchorStem, { placeRotateAnchorBelow } from "@/components/RotateAnchorStem";
import { PlacementData, ShirtCanvasHandle, ShirtColor, ShirtView } from "@/types/order";

interface ShirtCanvasEditorProps {
  shirtColor: ShirtColor; view: ShirtView; originalImageData: string | null; placement: PlacementData;
  onPlacementChange: (next: PlacementData) => void;
  onLivePhysicalDimensions?: (dims: PhysicalDimensionsDisplay) => void;
  fileName: string | null;
  physicalDimensions: PhysicalDimensionsDisplay;
  showGuides: boolean; hasActiveDesign: boolean;
  onToggleGuides: () => void; onAutoStraighten: () => void;
  onResetPlacement: () => void; onClearSide: () => void;
  isOutOfBounds: boolean; onOutOfBoundsChange: (outOfBounds: boolean) => void;
  canvasRef?: React.Ref<ShirtCanvasHandle>;
}

const ShirtCanvasEditor = forwardRef<ShirtCanvasHandle, ShirtCanvasEditorProps>(function ShirtCanvasEditor(p, ref) {
  const { shirtColor, view, originalImageData, placement, onPlacementChange, onLivePhysicalDimensions, fileName, physicalDimensions, showGuides, hasActiveDesign, onToggleGuides, onAutoStraighten, onResetPlacement, onClearSide, isOutOfBounds, onOutOfBoundsChange, canvasRef } = p;
  const stageRef = useRef<Konva.Stage | null>(null);
  const layerRef = useRef<Konva.Layer | null>(null);
  const designNodeRef = useRef<Konva.Image | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const safeZoneGroupRef = useRef<Konva.Group | null>(null);
  const touchStateRef = useRef<MultiTouchSnapshot | null>(null);
  const isInteractingRef = useRef(false);
  const lastOutOfBoundsRef = useRef<boolean | null>(null);
  // Same public path as next/image underlay — browser cache hit after priority preload.
  const shirtImgElement = useHtmlImage(getShirtPublicSrc(shirtColor, view));
  const designImgElement = useHtmlImage(originalImageData);
  const [isSelected, setIsSelected] = useState(true);

  // Skip redundant OOB setState when the boolean has not changed.
  const checkNodeBounds = useCallback(() => {
    const node = designNodeRef.current;
    const stage = stageRef.current;
    const nextOut = !node || !stage || !originalImageData ? false : isRectOutOfSafeZone(node.getClientRect({ relativeTo: stage }));
    if (lastOutOfBoundsRef.current === nextOut) return;
    lastOutOfBoundsRef.current = nextOut;
    onOutOfBoundsChange(nextOut);
  }, [onOutOfBoundsChange, originalImageData]);

  useEffect(() => {
    Konva.hitOnDragEnabled = true;
    if (showGuides && isSelected && transformerRef.current && designNodeRef.current) {
      transformerRef.current.nodes([designNodeRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
    checkNodeBounds();
  }, [showGuides, isSelected, designImgElement, placement, checkNodeBounds]);

  useImperativeHandle(canvasRef || ref, () => ({
    // Snapshot the shirt + artwork (guides/transformer hidden) as a PNG data URL for checkout.
    exportCompositeProof: () => {
      const stage = stageRef.current;
      const layer = layerRef.current;
      if (!stage || !layer) return "";
      try {
        safeZoneGroupRef.current?.visible(false);
        transformerRef.current?.visible(false);
        layer.draw();
        const dataUrl = stage.toDataURL({ pixelRatio: 2, mimeType: "image/png" });
        safeZoneGroupRef.current?.visible(showGuides || isOutOfBounds);
        transformerRef.current?.visible(showGuides && isSelected);
        layer.batchDraw();
        return typeof dataUrl === "string" && dataUrl.startsWith("data:image/") ? dataUrl : "";
      } catch {
        safeZoneGroupRef.current?.visible(showGuides || isOutOfBounds);
        transformerRef.current?.visible(showGuides && isSelected);
        layer.batchDraw();
        return "";
      }
    },
    centerAndResetDesign: () => onPlacementChange({ ...DEFAULT_PLACEMENT }),
  }));

  // Live inches from node.width()*scaleX while Transformer scales.
  const reportLivePhysical = () => {
    const node = designNodeRef.current;
    if (!node || !onLivePhysicalDimensions) return;
    onLivePhysicalDimensions(formatPhysicalDimensionsDisplay(
      calcPhysicalDimensionsInches(node.width() * node.scaleX(), node.height() * node.scaleY())
    ));
  };

  const handleStageTouchMove = (e: Konva.KonvaEventObject<TouchEvent>) => {
    const touches = e.evt.touches;
    if (!touches) return;
    if ((isInteractingRef.current || touches.length >= 2) && e.evt.cancelable) e.evt.preventDefault();
    if (touches.length < 2 || !designNodeRef.current) return;
    if (designNodeRef.current.isDragging()) designNodeRef.current.stopDrag();
    const p1 = { x: touches[0].clientX, y: touches[0].clientY };
    const p2 = { x: touches[1].clientX, y: touches[1].clientY };
    const { nextSnapshot, nextPlacement } = computeTwoFingerGesture(p1, p2, touchStateRef.current, placement);
    touchStateRef.current = nextSnapshot;
    if (nextPlacement) onPlacementChange(withPhysicalDimensions(nextPlacement));
  };

  // Brand blue on black shirts; magenta accent on white; red when out of bounds.
  const guideColor = isOutOfBounds ? "#ef4444" : shirtColor === "black" ? BRAND_BLUE : "#db2777";
  const showTransformer = showGuides && isSelected && Boolean(designImgElement);

  return (
    // Outer preview card — extra top/bottom padding keeps chips in the frame gutters, off the shirt.
    <div className="relative w-full pt-9 pb-9 px-3 rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 shadow-2xl flex flex-col items-center touch-pan-y">
      <CanvasInfoOverlays view={view} fileName={fileName} hasActiveDesign={hasActiveDesign} physicalDimensions={physicalDimensions} />
      {/* Fixed stage box reserves layout space (CLS). next/image underlay paints until Konva shirt loads. */}
      <div className="relative overflow-hidden rounded-xl touch-pan-y" style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT }}>
        <ShirtTemplateImage shirtColor={shirtColor} view={view} />
        <Stage
          ref={stageRef} width={STAGE_WIDTH} height={STAGE_HEIGHT} preventDefault={false}
          className="relative z-[1]"
          onMouseDown={(e) => e.target === e.target.getStage() && setIsSelected(false)}
          onTouchStart={(e) => {
            const isMultiTouch = Boolean(e.evt.touches && e.evt.touches.length >= 2);
            const hitGraphicOrHandle = e.target !== e.target.getStage();
            isInteractingRef.current = isMultiTouch || hitGraphicOrHandle;
            if (isInteractingRef.current && e.evt.cancelable) e.evt.preventDefault();
            if (!hitGraphicOrHandle && !isMultiTouch) setIsSelected(false);
          }}
          onTouchMove={handleStageTouchMove}
          onTouchEnd={() => { touchStateRef.current = null; isInteractingRef.current = false; checkNodeBounds(); }}
        >
          <Layer ref={layerRef}>
            {shirtImgElement && (
              <KonvaImage image={shirtImgElement} x={0} y={0} width={STAGE_WIDTH} height={STAGE_HEIGHT} listening={false} preventDefault={false} />
            )}
            <Group ref={safeZoneGroupRef} visible={showGuides || isOutOfBounds} listening={false}>
              <Rect x={SAFE_PRINT_ZONE.x} y={SAFE_PRINT_ZONE.y} width={SAFE_PRINT_ZONE.width} height={SAFE_PRINT_ZONE.height} stroke={guideColor} strokeWidth={isOutOfBounds ? 2.5 : 1.5} dash={[6, 4]} cornerRadius={6} />
              <Text x={SAFE_PRINT_ZONE.x + 2} y={SAFE_PRINT_ZONE.y - 14} text={isOutOfBounds ? "OUT OF PRINT ZONE" : `SAFE PRINT ZONE (${view.toUpperCase()})`} fontSize={9} fontStyle="bold" fill={guideColor} />
            </Group>
            {designImgElement && (
              <KonvaImage
                ref={designNodeRef} image={designImgElement}
                x={SAFE_PRINT_ZONE.x + placement.x} y={SAFE_PRINT_ZONE.y + placement.y}
                width={placement.width} height={placement.height}
                scaleX={placement.scale} scaleY={placement.scale} rotation={placement.rotation}
                draggable preventDefault={true}
                onClick={() => setIsSelected(true)} onTap={() => setIsSelected(true)}
                onDragMove={checkNodeBounds}
                onDragEnd={(e) => {
                  checkNodeBounds();
                  onPlacementChange(withPhysicalDimensions({
                    ...placement,
                    x: roundCoord(e.target.x() - SAFE_PRINT_ZONE.x),
                    y: roundCoord(e.target.y() - SAFE_PRINT_ZONE.y),
                  }));
                }}
                onTransform={() => { checkNodeBounds(); reportLivePhysical(); }}
                onTransformEnd={() => {
                  const node = designNodeRef.current;
                  if (!node) return;
                  checkNodeBounds();
                  onPlacementChange(withPhysicalDimensions({
                    x: roundCoord(node.x() - SAFE_PRINT_ZONE.x), y: roundCoord(node.y() - SAFE_PRINT_ZONE.y),
                    width: roundCoord(node.width()), height: roundCoord(node.height()),
                    rotation: roundCoord(node.rotation()), scale: roundCoord(node.scaleX()),
                    physicalWidthInches: 0, physicalHeightInches: 0,
                  }));
                }}
              />
            )}
            {showTransformer && (
              <>
                {/* Stem under the transformer so the white rotater circle paints on top of the line */}
                <RotateAnchorStem transformerRef={transformerRef} stageRef={stageRef} stroke={guideColor} enabled={showTransformer}
                  syncKey={`${placement.x},${placement.y},${placement.scale},${placement.rotation}`} />
                <Transformer ref={transformerRef} rotateEnabled rotateLineVisible={false} rotateAnchorOffset={28} preventDefault
                  enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
                  anchorSize={12} anchorCornerRadius={6}
                  borderStroke={guideColor} anchorStroke={guideColor} anchorFill="#ffffff"
                  anchorStyleFunc={placeRotateAnchorBelow} />
              </>
            )}
          </Layer>
        </Stage>
        <CanvasUtilityToolbar showGuides={showGuides} hasActiveDesign={hasActiveDesign} onToggleGuides={onToggleGuides} onAutoStraighten={onAutoStraighten} onResetPlacement={onResetPlacement} onClearSide={onClearSide} />
      </div>
    </div>
  );
});

export default ShirtCanvasEditor;
