"use client";

import Link from "next/link";
import { useState } from "react";
import { WalletButton } from "./WalletButton";

const LINKS = [
  { href: "/", label: "Bounty Board" },
  { href: "/create", label: "Create" },
  { href: "/dashboard/creator", label: "Creator" },
  { href: "/dashboard/developer", label: "Developer" },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-bf-border bg-bf-black/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight text-bf-green">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-bf-green shadow-glow" />
          BountyFlow<span className="text-bf-green-muted">Pro</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm md:flex">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="text-bf-green-muted/80 transition hover:text-bf-green">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:block">
          <WalletButton />
        </div>

        <button
          className="rounded-md border border-bf-border p-2 text-bf-green md:hidden"
          aria-label="Toggle menu"
          onClick={() => setMobileOpen((v) => !v)}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-bf-border bg-bf-black-soft px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-3 text-sm">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-bf-green-muted/90 hover:text-bf-green"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4">
            <WalletButton />
          </div>
        </div>
      )}
    </header>
  );
}
