"use server";

// Server action: validate contest payload, require proofs, email contact@ampbrand.com.

import { isAllowedImageDataUrl } from "@/lib/imageUploadGuards";
import { friendlyEmailDeliveryError, sendContestEntryEmail } from "@/lib/sendContestEmail";
import { ContestEntryPayload, ContestEntryResult, SideDesignPayload } from "@/types/order";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sideReady(side: SideDesignPayload | undefined): boolean {
  if (!side?.hasDesign) return true;
  return Boolean(
    side.originalImageData &&
      side.placementData &&
      side.compositeProofImage &&
      side.compositeProofImage.startsWith("data:image/")
  );
}

/**
 * Reject SVG, executables, and any non-raster payloads before Resend.
 * Only image/png, image/jpeg, and image/webp are accepted.
 */
function sideImagesAllowed(side: SideDesignPayload | undefined, label: string): string | null {
  if (!side?.hasDesign) return null;
  if (!side.originalImageData || !isAllowedImageDataUrl(side.originalImageData)) {
    return `${label} artwork must be PNG, JPEG, or WebP (SVG and other formats are not allowed).`;
  }
  if (!side.compositeProofImage || !isAllowedImageDataUrl(side.compositeProofImage)) {
    return `${label} proof must be PNG, JPEG, or WebP. Please try submitting again.`;
  }
  return null;
}

export async function submitContestEntry(payload: ContestEntryPayload): Promise<ContestEntryResult> {
  const name = (payload.entrantName || "").trim();
  const email = (payload.entrantEmail || "").trim().toLowerCase();
  const front = payload.designs?.front;
  const back = payload.designs?.back;
  const hasAny = Boolean(front?.hasDesign || back?.hasDesign);

  if (!name) {
    return fail("Please enter your full name.");
  }
  if (!isValidEmail(email)) {
    return fail("Please enter a valid email address.");
  }
  if (!hasAny) {
    return fail("Add a Front or Back design before submitting.");
  }
  if (!sideReady(front)) {
    return fail("Front design proof is missing. Please try again.");
  }
  if (!sideReady(back)) {
    return fail("Back design proof is missing. Please try again.");
  }

  // Strict MIME gate — blocks image/svg+xml and any non-allowed type before Resend.
  const frontMimeError = sideImagesAllowed(front, "Front");
  if (frontMimeError) return fail(frontMimeError);
  const backMimeError = sideImagesAllowed(back, "Back");
  if (backMimeError) return fail(backMimeError);

  const entryId = `CE-${Date.now().toString(36).toUpperCase()}`;
  const delivery = await sendContestEntryEmail(payload, entryId);

  // Resend / SMTP failures (incl. attachment size limits) — never report success.
  if (!delivery.ok) {
    return {
      success: false,
      entryId,
      deliveryMode: "failed",
      message: friendlyEmailDeliveryError(delivery.error),
    };
  }

  const modeNote =
    delivery.mode === "sandbox"
      ? " (sandbox — email logged locally; set RESEND_API_KEY or SMTP to send)"
      : "";

  return {
    success: true,
    entryId,
    deliveryMode: delivery.mode,
    message: `Design submitted! Entry ${entryId} was sent to the contest team.${modeNote}`,
  };
}

function fail(message: string): ContestEntryResult {
  return { success: false, entryId: "", deliveryMode: "failed", message };
}
