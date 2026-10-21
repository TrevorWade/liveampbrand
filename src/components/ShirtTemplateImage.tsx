"use client";

// Base T-shirt template via next/image — fixed width/height + priority prevent LCP/CLS flash
// while Konva loads the same public asset for canvas export.

import React from "react";
import Image from "next/image";
import { getShirtPublicSrc, STAGE_HEIGHT, STAGE_WIDTH } from "@/lib/shirtAssets";
import { ShirtColor, ShirtView } from "@/types/order";

interface ShirtTemplateImageProps {
  shirtColor: ShirtColor;
  view: ShirtView;
}

export default function ShirtTemplateImage({ shirtColor, view }: ShirtTemplateImageProps) {
  return (
    <Image
      src={getShirtPublicSrc(shirtColor, view)}
      alt=""
      width={STAGE_WIDTH}
      height={STAGE_HEIGHT}
      priority
      // Static SVG templates — skip Vercel optimizer (SVGs are not optimized; avoids limit burn).
      unoptimized
      draggable={false}
      className="absolute inset-0 pointer-events-none select-none"
      aria-hidden
    />
  );
}
