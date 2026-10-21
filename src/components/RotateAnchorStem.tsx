"use client";

// Stem from transformer bottom-center down to the below-box rotater (Konva 9 line only draws upward).
// Updated imperatively so it stays glued during Konva drag/transform (React setState lags behind).

import React, { useEffect, useRef } from "react";
import { Line } from "react-konva";
import Konva from "konva";

/** Restyle Konva's top rotater so it sits below the selection box. */
export function placeRotateAnchorBelow(anchor: Konva.Node) {
  if (!anchor.hasName("rotater")) return;
  const tr = anchor.getParent() as Konva.Transformer | null;
  if (!tr) return;
  const back = tr.findOne(".back") as Konva.Shape | null;
  const boxHeight = back?.height() ?? 0;
  const offset = Math.abs(tr.rotateAnchorOffset());
  anchor.y(boxHeight + offset);
}

interface RotateAnchorStemProps {
  transformerRef: React.RefObject<Konva.Transformer | null>;
  stageRef: React.RefObject<Konva.Stage | null>;
  stroke: string;
  enabled: boolean;
  /** Bump when placement/selection changes so the stem re-syncs. */
  syncKey: string | number | boolean;
}

export default function RotateAnchorStem({
  transformerRef,
  stageRef,
  stroke,
  enabled,
  syncKey,
}: RotateAnchorStemProps) {
  const lineRef = useRef<Konva.Line | null>(null);

  useEffect(() => {
    const sync = () => {
      const line = lineRef.current;
      const tr = transformerRef.current;
      const stage = stageRef.current;
      if (!line) return;

      if (!enabled || !tr || !stage) {
        line.visible(false);
        return;
      }

      const rotater = tr.findOne(".rotater");
      const back = tr.findOne(".back") as Konva.Shape | null;
      if (!rotater || !back || !rotater.visible()) {
        line.visible(false);
        return;
      }

      // Oriented bottom-center → rotater, converted into stage space.
      const abs = tr.getAbsoluteTransform();
      const toStage = stage.getAbsoluteTransform().copy().invert();
      const p1 = toStage.point(abs.point({ x: back.width() / 2, y: back.height() }));
      const p2 = toStage.point(abs.point({ x: rotater.x(), y: rotater.y() }));

      line.visible(true);
      line.points([p1.x, p1.y, p2.x, p2.y]);
      line.getLayer()?.batchDraw();
    };

    // Stage bubbling catches design-image dragmove even before transformer.nodes() is wired.
    const stage = stageRef.current;
    const tr = transformerRef.current;
    stage?.on("dragmove.rotateStem dragend.rotateStem", sync);
    tr?.on("transform.rotateStem transformend.rotateStem", sync);

    // Parent attaches transformer nodes in a later effect — re-sync on the next frames.
    sync();
    const raf1 = requestAnimationFrame(() => {
      sync();
      requestAnimationFrame(sync);
    });
    const timeoutId = window.setTimeout(sync, 0);

    return () => {
      cancelAnimationFrame(raf1);
      window.clearTimeout(timeoutId);
      stage?.off(".rotateStem");
      tr?.off(".rotateStem");
    };
  }, [enabled, syncKey, transformerRef, stageRef]);

  // Always mount the Line so the ref exists for imperative updates; start hidden.
  return (
    <Line
      ref={lineRef}
      points={[0, 0, 0, 0]}
      stroke={stroke}
      strokeWidth={1.25}
      visible={false}
      listening={false}
      perfectDrawEnabled={false}
      hitStrokeWidth={0}
    />
  );
}
