"use client";

// One Konva Stage for a single shirt side (Front or Back).
// Kept mounted at all times by the parent so iOS Safari never clears canvas buffers on side toggle.

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
import {
  calcPhysicalDimensionsInches,
  formatPhysicalDimensionsDisplay,
  PhysicalDimensionsDisplay,
  withPhysicalDimensions,
} from "@/lib/physicalDimensions";
import { BRAND_BLUE } from "@/lib/brand";
import { placementFittingImageAspect } from "@/lib/dualDesign";
import { HtmlImageStatus, useHtmlImage } from "@/lib/useHtmlImage";
import ShirtTemplateImage from "@/components/ShirtTemplateImage";
import { PlacementData, ShirtColor, ShirtView } from "@/types/order";

export interface ShirtSideStageHandle {
  /** Snapshot shirt + artwork (guides/transformer hidden) as a PNG data URL. */
  exportCompositeProof: () => string;
}

interface ShirtSideStageProps {
  side: ShirtView;
  isActive: boolean;
  shirtColor: ShirtColor;
  originalImageData: string | null;
  placement: PlacementData;
  onPlacementChange: (next: PlacementData) => void;
  onLivePhysicalDimensions?: (dims: PhysicalDimensionsDisplay) => void;
  showGuides: boolean;
  /** Report shirt SVG load status so Submit can wait for both sides. */
  onShirtTemplateStatus: (status: HtmlImageStatus) => void;
}

const ShirtSideStage = forwardRef<ShirtSideStageHandle, ShirtSideStageProps>(function ShirtSideStage(p, ref) {
  const {
    side,
    isActive,
    shirtColor,
    originalImageData,
    placement,
    onPlacementChange,
    onLivePhysicalDimensions,
    showGuides,
    onShirtTemplateStatus,
  } = p;

  const stageRef = useRef<Konva.Stage | null>(null);
  const layerRef = useRef<Konva.Layer | null>(null);
  const designNodeRef = useRef<Konva.Image | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const safeZoneGroupRef = useRef<Konva.Group | null>(null);
  const touchStateRef = useRef<MultiTouchSnapshot | null>(null);
  const isInteractingRef = useRef(false);

  // Each side loads its own shirt SVG — stays painted while the other side is active.
  const { image: shirtImgElement, status: shirtStatus } = useHtmlImage(getShirtPublicSrc(shirtColor, side));
  const { image: designImgElement } = useHtmlImage(originalImageData);
  const [isSelected, setIsSelected] = useState(true);
  // Track which src we already aspect-fitted so Front/Back toggles do not wipe user transforms.
  const fittedSrcRef = useRef<string | null>(null);

  // Bubble shirt template load status to the dual-stage parent (Submit gate).
  useEffect(() => {
    onShirtTemplateStatus(shirtStatus);
  }, [shirtStatus, onShirtTemplateStatus]);

  // When a new upload loads, re-fit from naturalWidth/Height if parent used a placeholder placement.
  useEffect(() => {
    if (!isActive) return;
    if (!designImgElement || !originalImageData) {
      if (!originalImageData) fittedSrcRef.current = null;
      return;
    }
    if (fittedSrcRef.current === originalImageData) return;
    const nw = designImgElement.naturalWidth;
    const nh = designImgElement.naturalHeight;
    if (!(nw > 0 && nh > 0)) return;
    fittedSrcRef.current = originalImageData;
    // Only auto-fit when the current placement still looks like the old fixed default box.
    const defaultLooksWrong =
      Math.abs(placement.width / Math.max(1, placement.height) - nw / nh) > 0.02;
    if (defaultLooksWrong && placement.rotation === 0 && placement.scale === 1) {
      onPlacementChange(placementFittingImageAspect(nw, nh));
    }
  }, [
    isActive,
    designImgElement,
    originalImageData,
    placement.width,
    placement.height,
    placement.rotation,
    placement.scale,
    onPlacementChange,
  ]);

  useEffect(() => {
    if (!isActive) return;
    Konva.hitOnDragEnabled = true;
    if (showGuides && isSelected && transformerRef.current && designNodeRef.current) {
      transformerRef.current.nodes([designNodeRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [isActive, showGuides, isSelected, designImgElement, placement]);

  useImperativeHandle(ref, () => ({
    exportCompositeProof: () => {
      const stage = stageRef.current;
      const layer = layerRef.current;
      if (!stage || !layer) return "";
      try {
        safeZoneGroupRef.current?.visible(false);
        transformerRef.current?.visible(false);
        layer.draw();
        // Both stages stay mounted — toDataURL should include the painted shirt SVG.
        const dataUrl = stage.toDataURL({ pixelRatio: 2, mimeType: "image/png" });
        safeZoneGroupRef.current?.visible(showGuides);
        transformerRef.current?.visible(showGuides && isSelected && isActive);
        layer.batchDraw();
        return typeof dataUrl === "string" && dataUrl.startsWith("data:image/") ? dataUrl : "";
      } catch {
        safeZoneGroupRef.current?.visible(showGuides);
        transformerRef.current?.visible(showGuides && isSelected && isActive);
        layer.batchDraw();
        return "";
      }
    },
  }));

  // Live inches from node.width()*scaleX while Transformer scales.
  const reportLivePhysical = () => {
    const node = designNodeRef.current;
    if (!node || !onLivePhysicalDimensions) return;
    const sx = Math.abs(node.scaleX());
    const sy = Math.abs(node.scaleY());
    onLivePhysicalDimensions(
      formatPhysicalDimensionsDisplay(calcPhysicalDimensionsInches(node.width() * sx, node.height() * sy))
    );
  };

  /**
   * Clamp using the rotated client rect so drag does not snap when the art is spun.
   * dragBoundFunc only runs while Konva is dragging — not during Transformer rotation.
   */
  const dragBoundFunc = (pos: { x: number; y: number }) => {
    const node = designNodeRef.current;
    const stage = stageRef.current;
    if (!node || !stage) return pos;
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

    node.position(prev);
    return { x: nextX, y: nextY };
  };

  const handleStageTouchMove = (e: Konva.KonvaEventObject<TouchEvent>) => {
    if (!isActive) return;
    const touches = e.evt.touches;
    if (!touches) return;
    if ((isInteractingRef.current || touches.length >= 2) && e.evt.cancelable) e.evt.preventDefault();
    if (touches.length < 2 || !designNodeRef.current) return;
    if (designNodeRef.current.isDragging()) designNodeRef.current.stopDrag();
    const p1 = { x: touches[0].clientX, y: touches[0].clientY };
    const p2 = { x: touches[1].clientX, y: touches[1].clientY };
    const { nextSnapshot, nextPlacement } = computeTwoFingerGesture(p1, p2, touchStateRef.current, placement);
    touchStateRef.current = nextSnapshot;
    if (nextPlacement) onPlacementChange(withPhysicalDimensions(clampPlacementInsideSafeZone(nextPlacement)));
  };

  const guideColor = BRAND_BLUE;
  // Transformer + hit listening only on the visible/active side.
  const showTransformer = isActive && showGuides && isSelected && Boolean(designImgElement);
  const nodeCenter = placementToNodeCenter(placement);
  const offsetX = placement.width / 2;
  const offsetY = placement.height / 2;

  return (
    <>
      <ShirtTemplateImage shirtColor={shirtColor} view={side} />
      <Stage
        ref={stageRef}
        width={STAGE_WIDTH}
        height={STAGE_HEIGHT}
        preventDefault={false}
        className="relative z-[1]"
        listening={isActive}
        onMouseDown={(e) => {
          if (!isActive) return;
          if (e.target === e.target.getStage()) setIsSelected(false);
        }}
        onTouchStart={(e) => {
          if (!isActive) return;
          const isMultiTouch = Boolean(e.evt.touches && e.evt.touches.length >= 2);
          const hitGraphicOrHandle = e.target !== e.target.getStage();
          isInteractingRef.current = isMultiTouch || hitGraphicOrHandle;
          if (isInteractingRef.current && e.evt.cancelable) e.evt.preventDefault();
          if (!hitGraphicOrHandle && !isMultiTouch) setIsSelected(false);
        }}
        onTouchMove={handleStageTouchMove}
        onTouchEnd={() => {
          touchStateRef.current = null;
          isInteractingRef.current = false;
        }}
      >
        <Layer ref={layerRef}>
          {shirtImgElement && (
            <KonvaImage
              image={shirtImgElement}
              x={0}
              y={0}
              width={STAGE_WIDTH}
              height={STAGE_HEIGHT}
              listening={false}
              preventDefault={false}
            />
          )}
          <Group ref={safeZoneGroupRef} visible={isActive && showGuides} listening={false}>
            <Rect
              x={SAFE_PRINT_ZONE.x}
              y={SAFE_PRINT_ZONE.y}
              width={SAFE_PRINT_ZONE.width}
              height={SAFE_PRINT_ZONE.height}
              stroke={guideColor}
              strokeWidth={1.5}
              dash={[6, 4]}
              cornerRadius={6}
            />
            <Text
              x={SAFE_PRINT_ZONE.x + 2}
              y={SAFE_PRINT_ZONE.y - 14}
              text={`SAFE PRINT ZONE (${side.toUpperCase()})`}
              fontSize={9}
              fontStyle="bold"
              fill={guideColor}
            />
          </Group>
          {designImgElement && (
            <KonvaImage
              ref={designNodeRef}
              image={designImgElement}
              x={nodeCenter.x}
              y={nodeCenter.y}
              offsetX={offsetX}
              offsetY={offsetY}
              width={placement.width}
              height={placement.height}
              scaleX={placement.scale}
              scaleY={placement.scale}
              rotation={placement.rotation}
              draggable={isActive}
              listening={isActive}
              preventDefault={true}
              dragBoundFunc={dragBoundFunc}
              onClick={() => setIsSelected(true)}
              onTap={() => setIsSelected(true)}
              onDragEnd={(e) => {
                const node = e.target;
                const scale = Math.abs(node.scaleX()) || 1;
                const xy = nodeCenterToPlacementXY(node.x(), node.y(), node.width(), node.height(), scale);
                onPlacementChange(
                  withPhysicalDimensions(
                    clampPlacementInsideSafeZone({
                      ...placement,
                      x: xy.x,
                      y: xy.y,
                      scale: roundCoord(scale),
                      rotation: roundCoord(normalizeRotationDeg(node.rotation())),
                    })
                  )
                );
              }}
              onTransform={() => {
                const node = designNodeRef.current;
                if (!node) return;

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

                const rotation = normalizeRotationDeg(node.rotation());
                node.rotation(rotation);

                const uniformScale = Math.max(0.15, Math.abs(node.scaleX()) || 1);
                node.scaleX(uniformScale);
                node.scaleY(uniformScale);

                const xy = nodeCenterToPlacementXY(node.x(), node.y(), node.width(), node.height(), uniformScale);
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
              centeredScaling
              rotateEnabled
              rotateAnchorAngle={180}
              rotateAnchorOffset={28}
              rotateLineVisible
              preventDefault
              keepRatio
              ignoreStroke
              flipEnabled={false}
              enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
              anchorSize={12}
              anchorCornerRadius={6}
              borderStroke={guideColor}
              anchorStroke={guideColor}
              anchorFill="#ffffff"
              boundBoxFunc={(oldBox, newBox) => {
                const w = Math.abs(newBox.width);
                const h = Math.abs(newBox.height);
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
    </>
  );
});

export default ShirtSideStage;
