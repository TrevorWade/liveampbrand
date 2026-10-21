"use client";

// Dual-sided contest designer: canvas + lead form (no checkout / pricing).

import React, { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import dynamic from "next/dynamic";
import { AlertCircle } from "lucide-react";
import { Toaster, toast } from "sonner";
import ContestEntryForm from "@/components/ContestEntryForm";
import ContestSuccessModal from "@/components/ContestSuccessModal";
import DesignerAppHeader from "@/components/DesignerAppHeader";
import ProductConfigControls from "@/components/ProductConfigControls";
import ShirtStyleHeaderControls from "@/components/ShirtStyleHeaderControls";
import { submitContestEntry } from "@/actions/submitContestEntry";
import { captureBothSideProofs } from "@/lib/captureDesignProofs";
import {
  createEmptySideDesign,
  createSideDesign,
  placementFittingImageAspect,
  getActiveSide,
  toSideDesignPayload,
} from "@/lib/dualDesign";
import { revokeObjectUrlIfNeeded } from "@/lib/objectUrl";
import { PhysicalDimensionsDisplay, physicalDisplayFromPlacement, withPhysicalDimensions } from "@/lib/physicalDimensions";
import { STAGE_HEIGHT } from "@/lib/shirtAssets";
import { clampPlacementInsideSafeZone, straightenPlacementAroundCenter } from "@/lib/touchGestureMath";
import { ContestEntryResult, SideDesign, ShirtCanvasHandle, ShirtColor, ShirtView } from "@/types/order";

const ShirtCanvasEditor = dynamic(() => import("@/components/ShirtCanvasEditor"), {
  ssr: false,
  // Match stage outer card height roughly to avoid CLS while the chunk loads.
  loading: () => (
    <div
      className="w-full rounded-2xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-center text-xs text-zinc-400 pt-9 pb-9 px-3"
      style={{ minHeight: STAGE_HEIGHT + 72 }}
    >
      Loading Interactive 2D Studio...
    </div>
  ),
});

export default function TShirtDesignerApp() {
  const canvasRef = useRef<ShirtCanvasHandle | null>(null);
  // Synchronous double-submit guard — flips before any await / React paint.
  const isSubmittingRef = useRef(false);
  const [shirtColor, setShirtColor] = useState<ShirtColor>("black");
  const [view, setView] = useState<ShirtView>("front");
  const [showGuides, setShowGuides] = useState(true);
  // Production start: empty sides (sample SVG would fail server MIME gates).
  const [frontDesign, setFrontDesign] = useState<SideDesign>(() => createEmptySideDesign());
  const [backDesign, setBackDesign] = useState<SideDesign>(() => createEmptySideDesign());
  const [entrantName, setEntrantName] = useState("");
  const [entrantEmail, setEntrantEmail] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [entryResult, setEntryResult] = useState<ContestEntryResult | null>(null);
  const [livePhysical, setLivePhysical] = useState<PhysicalDimensionsDisplay | null>(null);

  // Keep latest display URLs in refs so unmount cleanup can revoke the current blob: URLs.
  const frontImageRef = useRef<string | null>(null);
  const backImageRef = useRef<string | null>(null);
  frontImageRef.current = frontDesign.originalImage;
  backImageRef.current = backDesign.originalImage;
  useEffect(() => {
    return () => {
      revokeObjectUrlIfNeeded(frontImageRef.current);
      revokeObjectUrlIfNeeded(backImageRef.current);
    };
  }, []);

  const active = getActiveSide(frontDesign, backDesign, view);
  const physicalDimensions = livePhysical
    || (active.originalImage ? physicalDisplayFromPlacement(active.placementData) : { width: "0.0", height: "0.0" });
  const setActive = (updater: (prev: SideDesign) => SideDesign) =>
    view === "front" ? setFrontDesign(updater) : setBackDesign(updater);
  const hasFront = Boolean(frontDesign.originalImage);
  const hasBack = Boolean(backDesign.originalImage);
  const isDesignEmpty = !hasFront && !hasBack;
  const formComplete = Boolean(entrantName.trim() && entrantEmail.trim() && acceptedTerms);
  // Submit is never blocked by out-of-bounds — artwork is hard-clamped inside the print zone.
  const canSubmit = formComplete && !isDesignEmpty && !isSubmitting;

  // Front/Back toggle: update view only — do NOT remount the Stage (avoids memory churn / re-init loops).
  const handleViewChange = (next: ShirtView) => {
    if (next === view) return;
    if (active.originalImage) {
      const proof = canvasRef.current?.exportCompositeProof() || null;
      setActive((prev) => ({ ...prev, compositeProofImage: proof }));
    }
    setLivePhysical(null);
    setView(next);
  };

  /** Replace active side artwork and revoke any previous blob: URL first. */
  const replaceActiveDesign = (
    displaySrc: string,
    fileName: string,
    printDataUrl: string,
    naturalWidth: number,
    naturalHeight: number
  ) => {
    setLivePhysical(null);
    setActive((prev) => {
      revokeObjectUrlIfNeeded(prev.originalImage);
      return createSideDesign(displaySrc, fileName, printDataUrl, naturalWidth, naturalHeight);
    });
  };

  /** Clear Side — revoke blob: object URLs so mobile browsers free decoded image memory. */
  const clearActiveSide = () => {
    setLivePhysical(null);
    setActive((prev) => {
      revokeObjectUrlIfNeeded(prev.originalImage);
      return createEmptySideDesign();
    });
    toast.success(view === "front" ? "Front design cleared" : "Back design cleared");
  };

  const handleContestSubmit = async () => {
    // Same-millisecond guard: ref blocks a second tap before flushSync paints disabled UI.
    if (isSubmittingRef.current) return;
    if (!formComplete) return toast.error("Complete your name, email, and terms checkbox.");
    if (isDesignEmpty) return toast.error("Add a Front or Back design before submitting.");

    isSubmittingRef.current = true;
    // Force the Submit button into the loading/disabled state before any async work.
    flushSync(() => {
      setIsSubmitting(true);
      setErrorMessage(null);
    });

    try {
      const { front, back } = await captureBothSideProofs({ frontDesign, backDesign, view, setView, canvasRef });
      setFrontDesign(front);
      setBackDesign(back);
      const result = await submitContestEntry({
        entrantName: entrantName.trim(),
        entrantEmail: entrantEmail.trim(),
        shirtColor,
        designs: { front: toSideDesignPayload(front), back: toSideDesignPayload(back) },
      });
      if (!result.success) {
        setErrorMessage(result.message);
        toast.error(result.message);
      } else {
        setEntryResult(result);
        toast.success("Design submitted to the contest!");
      }
    } catch (err) {
      console.error("Contest submit failed:", err);
      const msg = err instanceof Error ? err.message : "";
      if (msg.startsWith("PROOF_EXPORT_FAILED:")) {
        const side = msg.split(":")[1] || "design";
        toast.error(`Could not export the ${side} print proof. Please try again.`);
        setErrorMessage(`Could not export the ${side} print proof.`);
      } else {
        setErrorMessage("Unexpected error submitting your entry. Please try again.");
      }
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 pb-14">
      <Toaster position="top-center" richColors />
      <DesignerAppHeader />
      <div className="mx-auto max-w-md px-4 pt-4 space-y-4">
        <ShirtStyleHeaderControls
          shirtColor={shirtColor}
          onShirtColorChange={(color) => {
            setShirtColor(color);
            setFrontDesign((p) => ({ ...p, compositeProofImage: null }));
            setBackDesign((p) => ({ ...p, compositeProofImage: null }));
          }}
          view={view} onViewChange={handleViewChange}
          hasFrontDesign={hasFront} hasBackDesign={hasBack}
        />
        {/* No key={view}: keep one Stage instance across Front/Back to avoid remount leaks. */}
        <ShirtCanvasEditor
          canvasRef={canvasRef} shirtColor={shirtColor} view={view}
          originalImageData={active.originalImage} placement={active.placementData}
          onPlacementChange={(next) => {
            setLivePhysical(null);
            setActive((prev) => ({
              ...prev,
              placementData: withPhysicalDimensions(clampPlacementInsideSafeZone(next)),
              compositeProofImage: null,
            }));
          }}
          onLivePhysicalDimensions={setLivePhysical}
          fileName={active.fileName || null}
          physicalDimensions={physicalDimensions}
          showGuides={showGuides} hasActiveDesign={Boolean(active.originalImage)}
          onToggleGuides={() => setShowGuides((prev) => { toast.message(prev ? "Guides Hidden" : "Guides Shown"); return !prev; })}
          onAutoStraighten={() => {
            if (!active.originalImage) return;
            setActive((prev) => ({
              ...prev,
              placementData: withPhysicalDimensions(
                clampPlacementInsideSafeZone(straightenPlacementAroundCenter(prev.placementData))
              ),
              compositeProofImage: null,
            }));
            toast.success("Image Straightened");
          }}
          onResetPlacement={() => {
            setLivePhysical(null);
            setActive((prev) => {
              // Reset to centered aspect-correct fit (not the old fixed 12"×11.5" box).
              const nextPlacement =
                prev.naturalWidth && prev.naturalHeight
                  ? placementFittingImageAspect(prev.naturalWidth, prev.naturalHeight)
                  : prev.placementData;
              return {
                ...prev,
                placementData: nextPlacement,
                compositeProofImage: null,
              };
            });
            toast.success("Placement reset");
          }}
          onClearSide={clearActiveSide}
        />
        <ProductConfigControls
          activeView={view}
          onImageFileSelected={(objectUrl, dataUrl, fileName, width, height) => {
            replaceActiveDesign(objectUrl, fileName, dataUrl, width, height);
          }}
          onImageUploadRejected={(message) => toast.error(message)}
        />
        {errorMessage && (
          <div className="flex items-center gap-2 rounded-xl bg-red-950/60 border border-red-800 px-3.5 py-2.5 text-xs text-red-200">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0" /><span>{errorMessage}</span>
          </div>
        )}
        <ContestEntryForm
          entrantName={entrantName} entrantEmail={entrantEmail} acceptedTerms={acceptedTerms}
          isSubmitting={isSubmitting} canSubmit={canSubmit}
          onNameChange={setEntrantName} onEmailChange={setEntrantEmail} onTermsChange={setAcceptedTerms}
          onSubmit={handleContestSubmit}
        />
      </div>
      <ContestSuccessModal result={entryResult} onClose={() => setEntryResult(null)} />
    </main>
  );
}
