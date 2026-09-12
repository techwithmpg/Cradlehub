"use client";

import { Loader2 } from "lucide-react";

type StaffRoleResolutionSplashProps = {
  /** Optional custom status message if stage changes during load */
  statusText?: string;
  /** Fullscreen overlay or embedded card */
  fullscreen?: boolean;
};

/**
 * Neutral Staff launch & role-resolution splash screen.
 * Displays while secure session validation and operational-role resolution take place.
 * 
 * Strict rule: Does not guess, expose private operational data, or silently
 * default unresolved users to Therapist, Driver, CRM, Utility, or any role.
 */
export function StaffRoleResolutionSplash({
  statusText = "Opening your workspace…",
  fullscreen = true,
}: StaffRoleResolutionSplashProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`flex flex-col items-center justify-center p-6 text-center ${
        fullscreen
          ? "fixed inset-0 z-50 bg-[#163A2B] text-[#F7F3EB]"
          : "min-h-[360px] w-full rounded-2xl bg-[#163A2B] p-8 text-[#F7F3EB]"
      }`}
    >
      {/* Brand Icon / Monogram Treatment */}
      <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-[#0D241B] shadow-lg ring-1 ring-[#C8A96B]/30">
        <div className="flex h-12 w-12 items-center justify-center">
          <svg
            width="48"
            height="48"
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M 28 8 C 36 8 40 14 40 20 C 40 28 34 33 26 33 C 16 33 10 27 10 18 C 10 9 17 4 25 4"
              stroke="#C8A96B"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <path
              d="M 21 21 C 18 15 23 9 27 9 C 27 14 24 19 21 21 Z"
              fill="#F7F3EB"
              opacity="0.9"
            />
          </svg>
        </div>
        {/* Subtle rotating glow ring */}
        <div className="absolute inset-0 animate-spin-slow rounded-3xl border border-[#C8A96B]/20 pointer-events-none" />
      </div>

      {/* Required primary wording:
          CradleHub Staff
          Team Workspace
          Opening your workspace…
      */}
      <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl font-display">
        CradleHub Staff
      </h1>

      <div className="mt-1.5 inline-flex items-center rounded-full bg-[#0D241B] px-3 py-1 text-xs font-medium tracking-wide text-[#C8A96B] ring-1 ring-[#C8A96B]/20">
        Team Workspace
      </div>

      <div className="mt-8 flex items-center gap-2.5 text-sm font-medium text-[#F7F3EB]/80">
        <Loader2 className="h-4 w-4 animate-spin text-[#C8A96B]" aria-hidden="true" />
        <span>{statusText}</span>
      </div>

      <p className="mt-2 text-xs text-[#F7F3EB]/50 max-w-[260px]">
        Verifying secure session and resolving operational permissions…
      </p>
    </div>
  );
}
