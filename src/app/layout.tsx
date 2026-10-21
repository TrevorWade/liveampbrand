// This root layout configures metadata and mobile viewport settings for our Next.js App Router app.

import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Custom Tee Contest Studio",
  description:
    "Interactive mobile-first T-Shirt designer for contest entries with dual-sided Konva proofs.",
  // Browser tab / PWA icons use the logo added under public/
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    apple: [{ url: "/favicon.png", type: "image/png" }],
    shortcut: "/favicon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased selection:bg-[var(--brand-blue)] selection:text-black">
        {children}
      </body>
    </html>
  );
}
