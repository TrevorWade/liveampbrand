"use client";

// Contest lead form: name, email, rights/terms checkbox, single submit CTA.
// Submit disables + shows a spinner on the same tap that starts the request (parent sets isSubmitting synchronously via ref + state).

import React from "react";
import { Loader2, Trophy } from "lucide-react";

interface ContestEntryFormProps {
  entrantName: string;
  entrantEmail: string;
  acceptedTerms: boolean;
  isSubmitting: boolean;
  canSubmit: boolean;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onTermsChange: (accepted: boolean) => void;
  onSubmit: () => void;
}

export default function ContestEntryForm({
  entrantName,
  entrantEmail,
  acceptedTerms,
  isSubmitting,
  canSubmit,
  onNameChange,
  onEmailChange,
  onTermsChange,
  onSubmit,
}: ContestEntryFormProps) {
  const inputClass =
    "w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[var(--brand-blue)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-blue)]";

  // Locked the instant the parent flips isSubmitting (and while validation fails).
  const submitLocked = !canSubmit || isSubmitting;

  return (
    <section className="rounded-2xl bg-zinc-900/95 border border-zinc-800 p-4 shadow-xl space-y-4">
      <div>
        <h2 className="text-base font-extrabold text-white">
          Enter the Contest
        </h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          Submit your Front and/or Back design. No payment required.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-[11px] font-medium text-zinc-400 mb-1" htmlFor="contest-name">
            Full Name
          </label>
          <input
            id="contest-name"
            type="text"
            autoComplete="name"
            value={entrantName}
            onChange={(e) => onNameChange(e.target.value)}
            className={inputClass}
            placeholder="Alex Rivera"
            disabled={isSubmitting}
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-zinc-400 mb-1" htmlFor="contest-email">
            Email Address
          </label>
          <input
            id="contest-email"
            type="email"
            autoComplete="email"
            value={entrantEmail}
            onChange={(e) => onEmailChange(e.target.value)}
            className={inputClass}
            placeholder="you@example.com"
            disabled={isSubmitting}
          />
        </div>
        <label className="flex items-start gap-2.5 text-xs text-zinc-300 leading-relaxed cursor-pointer">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => onTermsChange(e.target.checked)}
            disabled={isSubmitting}
            className="mt-0.5 h-4 w-4 rounded border-zinc-600 bg-zinc-950 accent-[var(--brand-blue)] focus:ring-[var(--brand-blue)]"
          />
          <span>
            I accept the contest terms and conditions, and I verify that I own the rights to the uploaded
            artwork.
          </span>
        </label>
      </div>

      <button
        type="button"
        disabled={submitLocked}
        aria-busy={isSubmitting}
        aria-disabled={submitLocked}
        // pointerdown fires before click — parent also guards with isSubmittingRef for double-taps.
        onPointerDown={(e) => {
          if (submitLocked) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        onClick={() => {
          if (submitLocked) return;
          onSubmit();
        }}
        className={`w-full flex items-center justify-center gap-2 font-extrabold py-3.5 px-8 text-sm shadow-lg transition touch-manipulation ${
          submitLocked
            ? "rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 cursor-not-allowed pointer-events-none"
            : "rounded-full bg-brand-blue hover:brightness-110 text-black active:scale-[0.99]"
        }`}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-zinc-300" /> Submitting design…
          </>
        ) : (
          <>
            <Trophy className="h-4 w-4 text-black" /> Submit Design to Contest
          </>
        )}
      </button>
    </section>
  );
}
