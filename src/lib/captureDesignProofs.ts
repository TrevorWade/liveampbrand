// Capture Front/Back composite proofs via Stage.toDataURL before contest submit.
// Both stages stay mounted — we call toDataURL on each ref directly (no setView / remount).

import type { RefObject } from "react";
import { SideDesign, ShirtCanvasHandle } from "@/types/order";

/** True when a composite proof is a usable base64 image data URL. */
export function isValidProofDataUrl(proof: string | null | undefined): boolean {
  return Boolean(proof && proof.startsWith("data:image/") && proof.length > 64);
}

interface CaptureArgs {
  frontDesign: SideDesign;
  backDesign: SideDesign;
  canvasRef: RefObject<ShirtCanvasHandle | null>;
}

/**
 * Pick a valid proof for one side: prefer a fresh stage snapshot, else a cached proof.
 * Throws PROOF_EXPORT_FAILED when neither is usable.
 */
function resolveSideProof(
  fresh: string,
  cached: string | null | undefined,
  sideLabel: "Front" | "Back"
): string {
  if (isValidProofDataUrl(fresh)) return fresh;
  if (isValidProofDataUrl(cached)) return cached as string;
  throw new Error(`PROOF_EXPORT_FAILED:${sideLabel}`);
}

/**
 * Export both designed sides from continuously mounted Front/Back stage refs.
 * No view switching — both canvases are already painted in the DOM.
 */
export async function captureBothSideProofs(args: CaptureArgs): Promise<{ front: SideDesign; back: SideDesign }> {
  let front = { ...args.frontDesign };
  let back = { ...args.backDesign };

  const snapshots = args.canvasRef.current?.exportBothCompositeProofs() || { front: "", back: "" };

  if (front.originalImage) {
    const proof = resolveSideProof(snapshots.front, front.compositeProofImage, "Front");
    front = { ...front, compositeProofImage: proof };
  }
  if (back.originalImage) {
    const proof = resolveSideProof(snapshots.back, back.compositeProofImage, "Back");
    back = { ...back, compositeProofImage: proof };
  }

  return { front, back };
}
