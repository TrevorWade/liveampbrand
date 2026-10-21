"use client";

// Success confirmation after a contest entry is accepted by the server action.
// Locks background scroll (including iOS rubber-band) while the dialog is open.

import React, { useEffect } from "react";
import { CheckCircle2, X } from "lucide-react";
import { ContestEntryResult } from "@/types/order";

interface ContestSuccessModalProps {
  result: ContestEntryResult | null;
  onClose: () => void;
}

export default function ContestSuccessModal({ result, onClose }: ContestSuccessModalProps) {
  const isOpen = Boolean(result?.success);

  // Freeze the page behind the modal so mobile users cannot scroll the designer underneath.
  useEffect(() => {
    if (!isOpen) return;

    const scrollY = window.scrollY;
    const { body, documentElement } = document;
    const prevBody = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      overflow: body.style.overflow,
      width: body.style.width,
    };
    const prevHtmlOverflow = documentElement.style.overflow;

    // position:fixed is the reliable lock on iOS Safari (overflow:hidden alone is not enough).
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";

    return () => {
      body.style.position = prevBody.position;
      body.style.top = prevBody.top;
      body.style.left = prevBody.left;
      body.style.right = prevBody.right;
      body.style.overflow = prevBody.overflow;
      body.style.width = prevBody.width;
      documentElement.style.overflow = prevHtmlOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  if (!isOpen || !result) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overscroll-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contest-success-title"
      // Block touch scroll on the dimmed backdrop from reaching the page underneath.
      onTouchMove={(e) => e.preventDefault()}
      onWheel={(e) => e.preventDefault()}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-700 p-5 shadow-2xl space-y-3"
        // Allow interactions inside the card without bubbling scroll locks oddly.
        onTouchMove={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0" />
            <h3 id="contest-success-title" className="text-base font-extrabold text-white">
              Entry Submitted!
            </h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        {/* Winner messaging only — no entry ID or delivery mode shown to the entrant */}
        <p className="text-sm text-zinc-300 leading-relaxed">
          Keep watching the live to see if you win! We will email the winner as well.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl bg-brand-blue hover:brightness-110 py-2.5 text-sm font-semibold text-black transition"
        >
          Done
        </button>
      </div>
    </div>
  );
}
