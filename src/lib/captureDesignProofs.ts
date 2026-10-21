// Capture Front/Back composite proofs via Stage.toDataURL before contest submit.

import { waitMs } from "@/lib/dualDesign";
import type { RefObject } from "react";
import { SideDesign, ShirtCanvasHandle, ShirtView } from "@/types/order";

/** True when a composite proof is a usable base64 image data URL. */
export function isValidProofDataUrl(proof: string | null | undefined): boolean {
  return Boolean(proof && proof.startsWith("data:image/") && proof.length > 64);
}

interface CaptureArgs {
  frontDesign: SideDesign;
  backDesign: SideDesign;
  view: ShirtView;
  setView: (view: ShirtView) => void;
  canvasRef: RefObject<ShirtCanvasHandle | null>;
}

// Export one side via Stage.toDataURL, with retries; fall back to a cached valid proof.
async function exportSideProof(
  args: CaptureArgs,
  side: ShirtView,
  cached: string | null | undefined,
  currentView: { value: ShirtView }
): Promise<string> {
  if (currentView.value !== side) {
    args.setView(side);
    currentView.value = side;
  }
  for (let i = 0; i < 20; i++) {
    await waitMs(100);
    try {
      const proof = args.canvasRef.current?.exportCompositeProof() || "";
      if (isValidProofDataUrl(proof)) return proof;
    } catch {
      // Stage may still be mounting — retry.
    }
  }
  if (isValidProofDataUrl(cached)) return cached as string;
  throw new Error(`PROOF_EXPORT_FAILED:${side === "front" ? "Front" : "Back"}`);
}

// Briefly mount each designed side, export compositeProofImage, then restore the original view.
export async function captureBothSideProofs(args: CaptureArgs): Promise<{ front: SideDesign; back: SideDesign }> {
  let front = { ...args.frontDesign };
  let back = { ...args.backDesign };
  const currentView = { value: args.view };

  if (front.originalImage) {
    const proof = await exportSideProof(args, "front", front.compositeProofImage, currentView);
    front = { ...front, compositeProofImage: proof };
  }
  if (back.originalImage) {
    const proof = await exportSideProof(args, "back", back.compositeProofImage, currentView);
    back = { ...back, compositeProofImage: proof };
  }
  if (currentView.value !== args.view) {
    args.setView(args.view);
    await waitMs(80);
  }
  return { front, back };
}
