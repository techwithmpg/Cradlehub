"use client";

import Image from "next/image";
import { Loader2 } from "lucide-react";

type StaffRoleResolutionSplashProps = {
  statusText?: string;
  fullscreen?: boolean;
};

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
      <div className="relative mb-6 grid h-24 w-24 place-items-center">
        <div
          aria-hidden="true"
          className="absolute inset-0 animate-pulse rounded-full border border-[#C8A96B]/25"
        />

        <div
          aria-hidden="true"
          className="absolute inset-2 rounded-full bg-[#C8A96B]/10 blur-xl"
        />

        <div className="relative grid h-20 w-20 place-items-center overflow-hidden rounded-[24px] border border-[#C8A96B]/25 bg-[#0D241B] shadow-[0_18px_42px_rgba(0,0,0,0.24)]">
          <Image
            src="/images/brand/cradle-logo-mark.png"
            alt="Cradle"
            width={64}
            height={64}
            priority
            className="h-14 w-14 object-contain"
          />
        </div>
      </div>

      <h1 className="font-display text-2xl font-semibold tracking-[-0.025em] text-white">
        Cradle Hub
      </h1>

      <div className="mt-2 inline-flex items-center rounded-full bg-[#0D241B] px-3 py-1 text-[11px] font-semibold tracking-wide text-[#C8A96B] ring-1 ring-[#C8A96B]/20">
        Team Workspace
      </div>

      <div className="mt-8 flex items-center gap-2.5 text-sm font-medium text-[#F7F3EB]/80">
        <Loader2
          className="h-4 w-4 animate-spin text-[#C8A96B]"
          aria-hidden="true"
        />

        <span>{statusText}</span>
      </div>

      <p className="mt-2 max-w-[270px] text-xs leading-5 text-[#F7F3EB]/50">
        Verifying your secure session and opening the
        correct workspace.
      </p>
    </div>
  );
}