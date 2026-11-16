import React from "react";

/** Shared class presets for Emerald Glass public pages. */
export const EG_SURFACE = {
  page: "min-h-full w-full bg-[#071A12] text-[#FAF5E9]",
  pageGradient:
    "w-full bg-[radial-gradient(1200px_520px_at_12%_0%,rgba(28,89,63,0.42),transparent_62%),radial-gradient(900px_480px_at_88%_14%,rgba(212,181,122,0.12),transparent_60%),linear-gradient(180deg,#061810_0%,#0A2319_48%,#071A12_100%)] text-[#FAF5E9]",
  glassCard: "eg-glass-card rounded-2xl",
  glassCardLift: "eg-glass-card eg-glass-lift rounded-2xl",
  glassPill:
    "eg-glass-pill inline-flex items-center gap-2 rounded-full text-xs font-medium text-[#FAF5E9]",
  goldButton:
    "inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#D4B57A] via-[#E4C98E] to-[#D4B57A] font-semibold text-[#071A12] shadow-[0_8px_24px_-8px_rgba(212,181,122,0.55)] transition duration-200 hover:brightness-105 active:scale-[0.985]",
  ghostButton:
    "inline-flex items-center justify-center gap-2 rounded-full border border-[#D4B57A]/40 bg-[#0D2E20]/70 font-semibold text-[#FAF5E9] backdrop-blur-sm transition duration-200 hover:border-[#E8D5A3]/75 hover:bg-[#14402E]/85 active:scale-[0.985]",
  eyebrow: "text-[11px] font-semibold tracking-[0.22em] text-[#E5C98B] uppercase",
  heading: "font-serif font-medium tracking-tight text-[#FAF5E9] [font-family:var(--sp-font-display)] text-balance",
  body: "text-[#CBD6CD] leading-relaxed [text-wrap:pretty]",
  input:
    "w-full rounded-xl border border-[#D4B57A]/30 bg-[#071E15]/85 px-4 py-2.5 text-sm text-[#FAF5E9] placeholder:text-[#96A89D] transition-colors focus:border-[#E8D5A3] focus:outline-none",
} as const;

export function EmeraldSectionEyebrow({
  children,
  centered = false,
}: {
  children: React.ReactNode;
  centered?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 ${centered ? "justify-center" : ""}`}>
      {centered && <span className="h-px w-8 bg-[#D4B57A]/45" aria-hidden="true" />}
      <span className={EG_SURFACE.eyebrow}>{children}</span>
      <span className="h-px w-10 bg-[#D4B57A]/55" aria-hidden="true" />
    </div>
  );
}

/** Restrained decorative botanical silhouette & warm atmospheric glow. */
export function EmeraldAtmosphere({ subtle = false }: { subtle?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden select-none"
    >
      <div
        className={`absolute -top-24 -left-24 h-80 w-80 rounded-full blur-3xl ${
          subtle ? "bg-[#1A583E]/25" : "bg-[#1E6A4B]/32"
        }`}
      />
      <div
        className={`absolute top-1/3 -right-24 h-72 w-72 rounded-full blur-3xl ${
          subtle ? "bg-[#D4B57A]/8" : "bg-[#D4B57A]/12"
        }`}
      />
      <svg
        viewBox="0 0 220 220"
        fill="none"
        className="eg-leaf-parallax absolute -top-6 -right-8 h-52 w-52 text-[#2F7556]/20"
      >
        <path
          d="M196 18C136 22 72 64 46 138c52-8 106-32 136-92 8-14 12-22 14-28Z"
          fill="currentColor"
        />
        <path
          d="M158 58c-34 26-68 62-92 108"
          stroke="rgba(212,181,122,0.18)"
          strokeWidth="1.5"
        />
      </svg>
      <svg
        viewBox="0 0 200 200"
        fill="none"
        className="eg-leaf-parallax absolute -bottom-10 -left-10 h-48 w-48 text-[#245F45]/20"
      >
        <path
          d="M20 184C28 118 68 58 148 34c-8 54-36 108-94 136-14 7-26 11-34 14Z"
          fill="currentColor"
        />
      </svg>
    </div>
  );
}
