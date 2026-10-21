"use client";

// Shirt Color and Print Side toggles above the live preview.
// Dots on Front/Back indicate which sides currently have artwork.

import React from "react";
import { ShirtColor, ShirtView } from "@/types/order";

interface ShirtStyleHeaderProps {
  shirtColor: ShirtColor;
  onShirtColorChange: (color: ShirtColor) => void;
  view: ShirtView;
  onViewChange: (view: ShirtView) => void;
  hasFrontDesign: boolean;
  hasBackDesign: boolean;
}

export default function ShirtStyleHeaderControls({
  shirtColor,
  onShirtColorChange,
  view,
  onViewChange,
  hasFrontDesign,
  hasBackDesign,
}: ShirtStyleHeaderProps) {
  return (
    <section className="rounded-2xl bg-zinc-900/90 border border-zinc-800 p-3.5 shadow-lg">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">Shirt Color</label>
          <div className="grid grid-cols-2 rounded-xl bg-zinc-950 p-1 border border-zinc-800">
            <button type="button" onClick={() => onShirtColorChange("black")} className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition ${shirtColor === "black" ? "bg-zinc-800 text-white shadow" : "text-zinc-400 hover:text-zinc-200"}`}>
              <span className="h-3 w-3 rounded-full bg-zinc-950 border border-zinc-500" /> Black
            </button>
            <button type="button" onClick={() => onShirtColorChange("white")} className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition ${shirtColor === "white" ? "bg-white text-zinc-950 shadow" : "text-zinc-400 hover:text-zinc-200"}`}>
              <span className="h-3 w-3 rounded-full bg-white border border-zinc-400" /> White
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">Print Side</label>
          <div className="grid grid-cols-2 rounded-xl bg-zinc-950 p-1 border border-zinc-800">
            {/* Selected Print Side uses brand blue + black text (readable on #8AD4E1) */}
            <button type="button" onClick={() => onViewChange("front")} className={`relative py-2 rounded-lg text-xs font-semibold transition ${view === "front" ? "bg-brand-blue text-black shadow" : "text-zinc-400 hover:text-zinc-200"}`}>
              Front
              {/* Dot flips to black when selected so it stays visible on brand-blue fill */}
              {hasFrontDesign && <span className={`absolute top-1 right-1.5 h-1.5 w-1.5 rounded-full ${view === "front" ? "bg-black" : "bg-brand-blue"}`} />}
            </button>
            <button type="button" onClick={() => onViewChange("back")} className={`relative py-2 rounded-lg text-xs font-semibold transition ${view === "back" ? "bg-brand-blue text-black shadow" : "text-zinc-400 hover:text-zinc-200"}`}>
              Back
              {hasBackDesign && <span className={`absolute top-1 right-1.5 h-1.5 w-1.5 rounded-full ${view === "back" ? "bg-black" : "bg-brand-blue"}`} />}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
