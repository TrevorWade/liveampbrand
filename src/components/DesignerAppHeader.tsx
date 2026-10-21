"use client";

// Sticky brand header for the dual-sided T-shirt designer.
// Hamburger menu links out to the main AMP Brand site.

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Menu, X } from "lucide-react";

// External AMP Brand site destinations (opens in a new tab).
const NAV_LINKS = [
  { label: "Home", href: "https://ampbrand.com" },
  { label: "Products", href: "https://ampbrand.com/products" },
  { label: "Blog", href: "https://ampbrand.com/blog" },
  { label: "Contact Us", href: "https://ampbrand.com/contact" },
] as const;

export default function DesignerAppHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the dropdown when the user clicks outside of it.
  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-zinc-950/85 border-b border-zinc-800/80 px-4 py-3">
      <div className="mx-auto max-w-md flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {/* Logo — next/image with explicit size + priority to avoid header CLS / LCP delay */}
          <Image
            src="/favicon.png"
            alt="Contest studio logo"
            width={32}
            height={32}
            priority
            className="h-8 w-8 rounded-full object-contain shrink-0"
          />
          <div>
            <h1 className="text-sm font-extrabold tracking-tight text-white">Custom Tee Contest Studio</h1>
            <p className="text-[11px] text-zinc-400">Front + Back Designs · Enter to Win</p>
          </div>
        </div>

        {/* Site nav — replaces the old CONTEST badge */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="amp-site-menu"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-700/80 bg-zinc-900 text-zinc-200 transition hover:border-zinc-500 hover:text-white"
          >
            {menuOpen ? <X size={18} strokeWidth={2.25} /> : <Menu size={18} strokeWidth={2.25} />}
          </button>

          {menuOpen && (
            <nav
              id="amp-site-menu"
              aria-label="AMP Brand site"
              className="absolute right-0 top-full mt-2 min-w-[10.5rem] overflow-hidden rounded-xl border border-zinc-700/80 bg-zinc-900 shadow-xl shadow-black/40"
            >
              <ul className="py-1">
                {NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setMenuOpen(false)}
                      className="block px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800 hover:text-white"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}
