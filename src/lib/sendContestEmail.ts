// Dispatch contest entry email to contact@ampbrand.com (Resend → SMTP → sandbox log).

import nodemailer from "nodemailer";
import {
  getDataUrlMimeType,
  isAllowedImageDataUrl,
  stripDataUrlBase64Prefix,
} from "@/lib/imageUploadGuards";
import { ContestEntryPayload } from "@/types/order";

const CONTEST_INBOX = "contact@ampbrand.com";

/** Soft ceiling for combined attachment bytes (~Resend practical limit with headroom). */
const MAX_TOTAL_ATTACHMENT_BYTES = 35 * 1024 * 1024;

export type DeliveryMode = "resend" | "smtp" | "sandbox";

interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

function extensionForMime(contentType: string): string {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/webp") return "webp";
  return "png";
}

/**
 * Parse allowed raster data URLs into Buffers for Resend / Nodemailer.
 * Prefix strip is MIME-agnostic (png / jpeg / webp) via stripDataUrlBase64Prefix.
 * Returns null for SVG, utf8 payloads, or any MIME outside png/jpeg/webp.
 */
function dataUrlToAttachment(dataUrl: string, baseName: string): EmailAttachment | null {
  // Defense in depth — never attach SVG or other disallowed formats.
  if (!isAllowedImageDataUrl(dataUrl)) return null;

  const contentType = getDataUrlMimeType(dataUrl);
  if (!contentType) return null;

  const base64 = stripDataUrlBase64Prefix(dataUrl);
  if (!base64) return null;

  return {
    filename: `${baseName}.${extensionForMime(contentType)}`,
    contentType,
    content: Buffer.from(base64, "base64"),
  };
}

function collectAttachments(payload: ContestEntryPayload): EmailAttachment[] {
  const out: EmailAttachment[] = [];
  for (const side of ["front", "back"] as const) {
    const design = payload.designs[side];
    if (!design.hasDesign) continue;
    if (design.originalImageData) {
      const att = dataUrlToAttachment(design.originalImageData, `${side}-original`);
      if (att) out.push(att);
    }
    if (design.compositeProofImage) {
      const att = dataUrlToAttachment(design.compositeProofImage, `${side}-proof`);
      if (att) out.push(att);
    }
  }
  return out;
}

function totalAttachmentBytes(attachments: EmailAttachment[]): number {
  return attachments.reduce((sum, a) => sum + a.content.length, 0);
}

/** Map provider errors into a short, user-safe message (no secrets). */
export function friendlyEmailDeliveryError(raw: string | undefined): string {
  const detail = (raw || "").toLowerCase();
  if (
    detail.includes("payload too large") ||
    detail.includes("request entity too large") ||
    (detail.includes("attachment") && detail.includes("size")) ||
    detail.includes("file too large") ||
    detail.includes("413") ||
    detail.includes("maximum size")
  ) {
    return "Your design images are too large to email. Please upload a smaller photo and try again.";
  }
  // Resend test domain can only mail the account owner — missing CONTEST_FROM_EMAIL causes this live.
  if (
    detail.includes("only send testing emails") ||
    detail.includes("verify a domain") ||
    detail.includes("domain is not verified") ||
    detail.includes("not verified")
  ) {
    return "Email delivery is misconfigured (sender domain). Please contact the contest host.";
  }
  if (detail.includes("rate limit") || detail.includes("429")) {
    return "The contest inbox is busy right now. Please wait a moment and try again.";
  }
  if (detail.includes("invalid api key") || detail.includes("unauthorized") || detail.includes("401")) {
    return "Email delivery is misconfigured (API key). Please contact the contest host.";
  }
  return "Could not send the contest entry email. Please try again later.";
}

// Email-only: show inches plus auto-converted millimeters (1" = 25.4 mm). Site UI stays inches-only.
const MM_PER_INCH = 25.4;

function inchesToMm(inches: number): number {
  return inches * MM_PER_INCH;
}

function formatPrintSizeForEmail(side: "front" | "back", payload: ContestEntryPayload): string {
  const p = payload.designs[side].placementData;
  if (!p) return "n/a";
  const wIn = p.physicalWidthInches;
  const hIn = p.physicalHeightInches;
  const wMm = Math.round(inchesToMm(wIn));
  const hMm = Math.round(inchesToMm(hIn));
  return `${wIn.toFixed(1)}" x ${hIn.toFixed(1)}" (${wMm} × ${hMm} mm)`;
}

function buildEmailBody(payload: ContestEntryPayload, entryId: string): { subject: string; text: string; html: string } {
  const sides = (["front", "back"] as const)
    .filter((s) => payload.designs[s].hasDesign)
    .map((s) => `${s}: ${formatPrintSizeForEmail(s, payload)}`)
    .join("; ");
  // Subject stays human-readable — entry ID lives in the email body only.
  const subject = `Contest Entry — ${payload.entrantName}`;
  const text = [
    `Contest entry ${entryId}`,
    `Name: ${payload.entrantName}`,
    `Email: ${payload.entrantEmail}`,
    `Shirt color: ${payload.shirtColor}`,
    `Print sizes: ${sides || "none"}`,
    "",
    "Attachments: original artwork + composite proofs for designed sides (Kornit RIP).",
  ].join("\n");
  const html = `<p><strong>Contest entry ${entryId}</strong></p>
<ul>
<li><strong>Name:</strong> ${payload.entrantName}</li>
<li><strong>Email:</strong> ${payload.entrantEmail}</li>
<li><strong>Shirt color:</strong> ${payload.shirtColor}</li>
<li><strong>Print sizes:</strong> ${sides || "none"}</li>
</ul>
<p>Attachments include high-res originals and composite proofs for production.</p>`;
  return { subject, text, html };
}

// Prefer Resend, then SMTP, else sandbox log (still success for local UI testing).
export async function sendContestEntryEmail(
  payload: ContestEntryPayload,
  entryId: string
): Promise<{ ok: boolean; mode: DeliveryMode; error?: string }> {
  const { subject, text, html } = buildEmailBody(payload, entryId);
  const attachments = collectAttachments(payload);
  const resendKey = process.env.RESEND_API_KEY;
  // Production must set CONTEST_FROM_EMAIL to a verified domain (e.g. Contest <no-reply@ampbrand.com>).
  // The resend.dev fallback can only deliver to the Resend account owner — not contact@ampbrand.com.
  const fromAddress = (process.env.CONTEST_FROM_EMAIL || "").trim();

  // Fail fast when designed sides produced zero attachable rasters (MIME strip / reject).
  const expectedMin = (["front", "back"] as const).reduce((n, side) => {
    return n + (payload.designs[side].hasDesign ? 1 : 0);
  }, 0);
  if (expectedMin > 0 && attachments.length === 0) {
    return {
      ok: false,
      mode: resendKey ? "resend" : "smtp",
      error: "No valid PNG/JPEG/WebP attachments could be built from the submission.",
    };
  }

  if (totalAttachmentBytes(attachments) > MAX_TOTAL_ATTACHMENT_BYTES) {
    return {
      ok: false,
      mode: resendKey ? "resend" : "smtp",
      error: "Attachment size limit exceeded before send.",
    };
  }

  if (resendKey) {
    if (!fromAddress || fromAddress.toLowerCase().includes("onboarding@resend.dev")) {
      console.error(
        "[contest-email] CONTEST_FROM_EMAIL missing or still on resend.dev — cannot mail contact@ampbrand.com"
      );
      return {
        ok: false,
        mode: "resend",
        error: "The ampbrand.com domain is not verified / CONTEST_FROM_EMAIL is not set for production.",
      };
    }

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [CONTEST_INBOX],
          reply_to: payload.entrantEmail,
          subject,
          html,
          text,
          attachments: attachments.map((a) => ({
            filename: a.filename,
            content: a.content.toString("base64"),
            content_type: a.contentType,
          })),
        }),
      });
      if (!res.ok) {
        const detail = await res.text();
        console.error("[contest-email] Resend error:", detail);
        return { ok: false, mode: "resend", error: detail || `HTTP ${res.status}` };
      }
      return { ok: true, mode: "resend" };
    } catch (err) {
      console.error("[contest-email] Resend network error:", err);
      return { ok: false, mode: "resend", error: String(err) };
    }
  }

  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (smtpHost && smtpUser && smtpPass) {
    const smtpFrom = fromAddress || smtpUser;
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: { user: smtpUser, pass: smtpPass },
      });
      await transporter.sendMail({
        from: smtpFrom,
        to: CONTEST_INBOX,
        replyTo: payload.entrantEmail,
        subject,
        text,
        html,
        attachments: attachments.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
      });
      return { ok: true, mode: "smtp" };
    } catch (err) {
      console.error("[contest-email] SMTP error:", err);
      return { ok: false, mode: "smtp", error: String(err) };
    }
  }

  // Dev sandbox: no keys configured — log for local verification.
  console.log("=== CONTEST ENTRY SANDBOX (no email keys) ===", {
    entryId,
    to: CONTEST_INBOX,
    entrantName: payload.entrantName,
    entrantEmail: payload.entrantEmail,
    shirtColor: payload.shirtColor,
    frontInches: formatPrintSizeForEmail("front", payload),
    backInches: formatPrintSizeForEmail("back", payload),
    attachmentNames: attachments.map((a) => a.filename),
    attachmentBytes: attachments.map((a) => a.content.length),
  });
  return { ok: true, mode: "sandbox" };
}
