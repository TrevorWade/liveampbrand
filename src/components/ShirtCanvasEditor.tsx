"use client";

// Konva canvas: center-pivoted rotation, rotated-AABB clamp, live print-size inches.

import React, { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { Stage, Layer, Image as KonvaImage, Rect, Text, Group, Transformer } from "react-konva";
import Konva from "konva";
import { SAFE_PRINT_ZONE, STAGE_HEIGHT, STAGE_WIDTH, getShirtPublicSrc } from "@/lib/shirtAssets";
import {
  MultiTouchSnapshot,
  clampPlacementInsideSafeZone,
  computeTwoFingerGesture,
  maxScaleInsideSafeZone,
  nodeCenterToPlacementXY,
  normalizeRotationDeg,
  placementToNodeCenter,
  roundCoord,
} from "@/lib/touchGestureMath";
import { calcPhysicalDimensionsInches, formatPhysicalDimensionsDisplay, PhysicalDimensionsDisplay, withPhysicalDimensions } from "@/lib/physicalDimensions";
import { BRAND_BLUE } from "@/lib/brand";
import { placementFittingImageAspect } from "@/lib/dualDesign";
import { useHtmlImage } from "@/lib/useHtmlImage";
import CanvasUtilityToolbar from "@/components/CanvasUtilityToolbar";
import CanvasInfoOverlays from "@/components/CanvasInfoOverlays";
import ShirtTemplateImage from "@/components/ShirtTemplateImage";
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
  canvasRef?: React.Ref<ShirtCanvasHandle>;
}

const ShirtCanvasEditor = forwardRef<ShirtCanvasHandle, ShirtCanvasEditorProps>(function ShirtCanvasEditor(p, ref) {
  const { shirtColor, view, originalImageData, placement, onPlacementChange, onLivePhysicalDimensions, fileName, physicalDimensions, showGuides, hasActiveDesign, onToggleGuides, onAutoStraighten, onResetPlacement, onClearSide, canvasRef } = p;
  const stageRef = useRef<Konva.Stage | null>(null);
  const layerRef = useRef<Konva.Layer | null>(null);
  const designNodeRef = useRef<Konva.Image | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const safeZoneGroupRef = useRef<Konva.Group | null>(null);
  const touchStateRef = useRef<MultiTouchSnapshot | null>(null);
  const isInteractingRef = useRef(false);
  // Same public path as next/image underlay — browser cache hit after priority preload.
  const shirtImgElement = useHtmlImage(getShirtPublicSrc(shirtColor, view));
  const designImgElement = useHtmlImage(originalImageData);
  const [isSelected, setIsSelected] = useState(true);
  // Track which src we already aspect-fitted so Front/Back toggles do not wipe user transforms.
  const fittedSrcRef = useRef<string | null>(null);

  // When a new upload loads, re-fit from naturalWidth/Height if parent used a placeholder placement.
  useEffect(() => {
    if (!designImgElement || !originalImageData) {
      if (!originalImageData) fittedSrcRef.current = null;
      return;
    }
    if (fittedSrcRef.current === originalImageData) return;
    const nw = designImgElement.naturalWidth;
    const nh = designImgElement.naturalHeight;
    if (!(nw > 0 && nh > 0)) return;
    fittedSrcRef.current = originalImageData;
    // Only auto-fit when the current placement still looks like the old fixed default box
    // (avoids fighting a parent that already set aspect-correct placement at upload).
    const defaultLooksWrong =
      Math.abs(placement.width / Math.max(1, placement.height) - nw / nh) > 0.02;
    if (defaultLooksWrong && placement.rotation === 0 && placement.scale === 1) {
      onPlacementChange(placementFittingImageAspect(nw, nh));
    }
  }, [designImgElement, originalImageData, placement.width, placement.height, placement.rotation, placement.scale, onPlacementChange]);

  useEffect(() => {
    Konva.hitOnDragEnabled = true;
    if (showGuides && isSelected && transformerRef.current && designNodeRef.current) {
      transformerRef.current.nodes([designNodeRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [showGuides, isSelected, designImgElement, placement]);

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
        safeZoneGroupRef.current?.visible(showGuides);
        transformerRef.current?.visible(showGuides && isSelected);
        layer.batchDraw();
        return typeof dataUrl === "string" && dataUrl.startsWith("data:image/") ? dataUrl : "";
      } catch {
        safeZoneGroupRef.current?.visible(showGuides);
        transformerRef.current?.visible(showGuides && isSelected);
        layer.batchDraw();
        return "";
      }
    },
    centerAndResetDesign: () => {
      const img = designImgElement;
      if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
        onPlacementChange(placementFittingImageAspect(img.naturalWidth, img.naturalHeight));
        return;
      }
      onPlacementChange(placementFittingImageAspect(placement.width, placement.height));
    },
  }));

  // Live inches from node.width()*scaleX while Transformer scales.
  const reportLivePhysical = () => {
    const node = designNodeRef.current;
    if (!node || !onLivePhysicalDimensions) return;
    const sx = Math.abs(node.scaleX());
    const sy = Math.abs(node.scaleY());
    onLivePhysicalDimensions(formatPhysicalDimensionsDisplay(
      calcPhysicalDimensionsInches(node.width() * sx, node.height() * sy)
    ));
  };

  /**
   * Clamp using the rotated client rect so drag does not snap when the art is spun.
   * dragBoundFunc only runs while Konva is dragging — not during Transformer rotation.
   */
  const dragBoundFunc = (pos: { x: number; y: number }) => {
    const node = designNodeRef.current;
    const stage = stageRef.current;
    if (!node || !stage) return pos;
    // Extra guard: never clamp while a transform (rotate/scale) is active.
    if (!node.isDragging()) return pos;

    const prev = node.position();
    node.position(pos);
    const box = node.getClientRect({ relativeTo: stage });
    let nextX = pos.x;
    let nextY = pos.y;

    if (box.x < SAFE_PRINT_ZONE.x) nextX += SAFE_PRINT_ZONE.x - box.x;
    if (box.y < SAFE_PRINT_ZONE.y) nextY += SAFE_PRINT_ZONE.y - box.y;
    if (box.x + box.width > SAFE_PRINT_ZONE.x + SAFE_PRINT_ZONE.width) {
      nextX -= box.x + box.width - (SAFE_PRINT_ZONE.x + SAFE_PRINT_ZONE.width);
    }
    if (box.y + box.height > SAFE_PRINT_ZONE.y + SAFE_PRINT_ZONE.height) {
      nextY -= box.y + box.height - (SAFE_PRINT_ZONE.y + SAFE_PRINT_ZONE.height);
    }

    // Restore — Konva applies the returned position as the drag result.
    node.position(prev);
    return { x: nextX, y: nextY };
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
    // Pinch/rotate also stays clamped inside the zone (rotated AABB).
    if (nextPlacement) onPlacementChange(withPhysicalDimensions(clampPlacementInsideSafeZone(nextPlacement)));
  };

  // Brand blue guides/transformer on both shirt colors.
  const guideColor = BRAND_BLUE;
  const showTransformer = showGuides && isSelected && Boolean(designImgElement);
  // Center-pivoted node: x/y is the visual center; offset is half the local (unscaled) size.
  const nodeCenter = placementToNodeCenter(placement);
  const offsetX = placement.width / 2;
  const offsetY = placement.height / 2;

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
          onTouchEnd={() => { touchStateRef.current = null; isInteractingRef.current = false; }}
        >
          <Layer ref={layerRef}>
            {shirtImgElement && (
              <KonvaImage image={shirtImgElement} x={0} y={0} width={STAGE_WIDTH} height={STAGE_HEIGHT} listening={false} preventDefault={false} />
            )}
            <Group ref={safeZoneGroupRef} visible={showGuides} listening={false}>
              <Rect x={SAFE_PRINT_ZONE.x} y={SAFE_PRINT_ZONE.y} width={SAFE_PRINT_ZONE.width} height={SAFE_PRINT_ZONE.height} stroke={guideColor} strokeWidth={1.5} dash={[6, 4]} cornerRadius={6} />
              <Text x={SAFE_PRINT_ZONE.x + 2} y={SAFE_PRINT_ZONE.y - 14} text={`SAFE PRINT ZONE (${view.toUpperCase()})`} fontSize={9} fontStyle="bold" fill={guideColor} />
            </Group>
            {designImgElement && (
              <KonvaImage
                ref={designNodeRef}
                image={designImgElement}
                // Center pivot: place at center, offset by half local size (accounts for scale via Konva).
                x={nodeCenter.x}
                y={nodeCenter.y}
                offsetX={offsetX}
                offsetY={offsetY}
                width={placement.width}
                height={placement.height}
                scaleX={placement.scale}
                scaleY={placement.scale}
                rotation={placement.rotation}
                draggable
                preventDefault={true}
                dragBoundFunc={dragBoundFunc}
                onClick={() => setIsSelected(true)}
                onTap={() => setIsSelected(true)}
                onDragEnd={(e) => {
                  const node = e.target;
                  const scale = Math.abs(node.scaleX()) || 1;
                  const xy = nodeCenterToPlacementXY(node.x(), node.y(), node.width(), node.height(), scale);
                  onPlacementChange(withPhysicalDimensions(clampPlacementInsideSafeZone({
                    ...placement,
                    x: xy.x,
                    y: xy.y,
                    scale: roundCoord(scale),
                    rotation: roundCoord(normalizeRotationDeg(node.rotation())),
                  })));
                }}
                onTransform={() => {
                  const node = designNodeRef.current;
                  if (!node) return;

                  // Live hard-clamp: scale cannot grow past the Safe Print Zone (fills it, never overflows).
                  const rotation = normalizeRotationDeg(node.rotation());
                  const maxScale = maxScaleInsideSafeZone(node.width(), node.height(), rotation);
                  const scale = Math.min(Math.max(0.15, Math.abs(node.scaleX()) || 1), maxScale);
                  node.scaleX(scale);
                  node.scaleY(scale);
                  node.rotation(rotation);

                  const xy = nodeCenterToPlacementXY(node.x(), node.y(), node.width(), node.height(), scale);
                  const clamped = clampPlacementInsideSafeZone({
                    x: xy.x,
                    y: xy.y,
                    width: node.width(),
                    height: node.height(),
                    scale,
                    rotation,
                    physicalWidthInches: 0,
                    physicalHeightInches: 0,
                  });
                  const center = placementToNodeCenter(clamped);
                  node.position(center);
                  node.scaleX(clamped.scale);
                  node.scaleY(clamped.scale);

                  reportLivePhysical();
                }}
                onTransformEnd={() => {
                  const node = designNodeRef.current;
                  if (!node) return;

                  // Ensure rotation stays between 0 and 360 degrees (no wrap snap / flip residue).
                  const rotation = normalizeRotationDeg(node.rotation());
                  node.rotation(rotation);

                  // flipEnabled={false} keeps scales positive; still abs as a safety net.
                  const uniformScale = Math.max(0.15, Math.abs(node.scaleX()) || 1);
                  node.scaleX(uniformScale);
                  node.scaleY(uniformScale);

                  const xy = nodeCenterToPlacementXY(
                    node.x(),
                    node.y(),
                    node.width(),
                    node.height(),
                    uniformScale
                  );
                  const next = clampPlacementInsideSafeZone({
                    x: xy.x,
                    y: xy.y,
                    width: roundCoord(node.width()),
                    height: roundCoord(node.height()),
                    rotation: roundCoord(rotation),
                    scale: roundCoord(uniformScale),
                    physicalWidthInches: 0,
                    physicalHeightInches: 0,
                  });
                  onPlacementChange(withPhysicalDimensions(next));

                  // Sync Konva node to the clamped center-pivoted placement.
                  const clampedCenter = placementToNodeCenter(next);
                  node.position(clampedCenter);
                  node.offsetX(next.width / 2);
                  node.offsetY(next.height / 2);
                  node.scaleX(next.scale);
                  node.scaleY(next.scale);
                  node.rotation(next.rotation);
                }}
              />
            )}
            {showTransformer && (
              <Transformer
                ref={transformerRef}
                // Scale from the centered offset so resize does not walk the pivot.
                centeredScaling
                rotateEnabled
                // Native bottom handle — do NOT manually move the rotater (that caused 180° flips on Konva 9).
                rotateAnchorAngle={180}
                rotateAnchorOffset={28}
                rotateLineVisible
                preventDefault
                keepRatio
                ignoreStroke
                // Prevent mirror/flip when dragging the rotate stem or corners.
                flipEnabled={false}
                // Corner anchors only — no mid-side stretch handles.
                enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
                anchorSize={12}
                anchorCornerRadius={6}
                borderStroke={guideColor}
                anchorStroke={guideColor}
                anchorFill="#ffffff"
                // Reject transform boxes whose rotated AABB would exceed the Safe Print Zone.
                boundBoxFunc={(oldBox, newBox) => {
                  const w = Math.abs(newBox.width);
                  const h = Math.abs(newBox.height);
                  // Konva bound boxes use radians for rotation.
                  const rotationDeg = (newBox.rotation * 180) / Math.PI;
                  const rad = normalizeRotationDeg(rotationDeg) * (Math.PI / 180);
                  const cos = Math.abs(Math.cos(rad));
                  const sin = Math.abs(Math.sin(rad));
                  const aabbW = w * cos + h * sin;
                  const aabbH = w * sin + h * cos;
                  if (aabbW > SAFE_PRINT_ZONE.width + 0.5 || aabbH > SAFE_PRINT_ZONE.height + 0.5) {
                    return oldBox;
                  }
                  return newBox;
                }}
              />
            )}
          </Layer>
        </Stage>
        <CanvasUtilityToolbar showGuides={showGuides} hasActiveDesign={hasActiveDesign} onToggleGuides={onToggleGuides} onAutoStraighten={onAutoStraighten} onResetPlacement={onResetPlacement} onClearSide={onClearSide} />
      </div>
    </div>
  );
});

export default ShirtCanvasEditor;
