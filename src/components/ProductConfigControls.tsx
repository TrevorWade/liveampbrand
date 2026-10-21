"use client";

// Upload CTA below the live preview (pricing removed — contest entry form handles submit).

import React, { useRef } from "react";
import { Upload } from "lucide-react";
import { ALLOWED_IMAGE_ACCEPT, processImageUploadFile } from "@/lib/imageUploadGuards";
import { ShirtView } from "@/types/order";

interface ProductConfigControlsProps {
  activeView: ShirtView;
  /** objectUrl for Konva, dataUrl for Resend, file name, and natural pixel size for aspect fit. */
  onImageFileSelected: (
    objectUrl: string,
    dataUrl: string,
    fileName: string,
    width: number,
    height: number
  ) => void;
  onImageUploadRejected: (message: string) => void;
}

export default function ProductConfigControls({
  activeView,
  onImageFileSelected,
  onImageUploadRejected,
}: ProductConfigControlsProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sideLabel = activeView === "front" ? "Front" : "Back";

  // Accept phone photos; compress/resize client-side before loading into Konva.
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const result = await processImageUploadFile(file);
    if (!result.ok) {
      onImageUploadRejected(result.errorMessage);
      return;
    }
    // objectUrl → Konva display (revoked on Clear Side); dataUrl → server action attachments.
    onImageFileSelected(result.objectUrl, result.dataUrl, result.fileName, result.width, result.height);
  };

  return (
    <section className="rounded-2xl bg-zinc-900/90 border border-zinc-800 p-4 shadow-lg">
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_IMAGE_ACCEPT}
        onChange={handleFileChange}
        className="hidden"
        aria-label="Upload Image"
      />
      {/* Primary CTA: brand blue, slightly rounded square corners, black bold label + icon */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-blue hover:brightness-110 px-8 py-3.5 text-sm font-bold text-black shadow-md active:scale-[0.99] transition"
      >
        <Upload className="h-4 w-4 text-black" strokeWidth={2.5} /> Upload {sideLabel} Image
      </button>
    </section>
  );
}
