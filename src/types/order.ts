// Shared TypeScript types for the dual-sided T-shirt designer and contest entry flow.

export type ShirtColor = "black" | "white";
export type ShirtView = "front" | "back";

// Placement is measured relative to the top-left of the Safe Print Zone.
// physicalWidthInches / physicalHeightInches map Konva size to the 16"×20" Kornit pallet.
export interface PlacementData {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scale: number;
  physicalWidthInches: number;
  physicalHeightInches: number;
}

/** Independent Front or Back design state stored in the designer UI. */
export interface SideDesign {
  /**
   * Konva display src. Prefer a blob: object URL (revoked on Clear Side / replace)
   * so mobile browsers can free decoded image memory.
   */
  originalImage: string | null;
  /**
   * Base64 data URL (PNG/JPEG/WebP) sent to the contest server action / Resend.
   * Kept separate from originalImage when that field is a blob: URL.
   */
  originalImageData?: string | null;
  placementData: PlacementData;
  compositeProofImage?: string | null;
  fileName?: string | null;
  /** Natural pixel size of the uploaded artwork — used to reset without distorting aspect. */
  naturalWidth?: number | null;
  naturalHeight?: number | null;
}

/** Exact designs.front / designs.back shape sent with a contest entry. */
export interface SideDesignPayload {
  hasDesign: boolean;
  originalImageData: string | null;
  placementData: PlacementData | null;
  compositeProofImage: string | null;
}

/** Contest lead-gen payload (no payment / shipping). */
export interface ContestEntryPayload {
  entrantName: string;
  entrantEmail: string;
  shirtColor: ShirtColor;
  designs: {
    front: SideDesignPayload;
    back: SideDesignPayload;
  };
}

export interface ContestEntryResult {
  success: boolean;
  entryId: string;
  message: string;
  deliveryMode: "resend" | "smtp" | "sandbox" | "failed";
}

export interface ShirtCanvasHandle {
  exportCompositeProof: () => string;
  centerAndResetDesign: () => void;
}
