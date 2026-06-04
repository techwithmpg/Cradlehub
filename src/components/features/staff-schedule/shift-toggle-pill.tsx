"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ShiftKind } from "./schedule-rule-builder-utils";

type ShiftTogglePillProps = {
  label: string;
  kind: ShiftKind | "dayOff";
  active: boolean;
  custom?: boolean;
  disabled?: boolean;
  onToggle?: () => void;
};

const ACTIVE_CLASSES: Record<ShiftKind | "dayOff", string> = {
  opening: "border-emerald-200 bg-emerald-50 text-emerald-900 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.12)]",
  closing: "border-blue-200 bg-blue-50 text-blue-950 shadow-[inset_0_0_0_1px_rgba(37,99,235,0.12)]",
  regular: "border-amber-200 bg-amber-50 text-amber-950 shadow-[inset_0_0_0_1px_rgba(180,83,9,0.10)]",
  dayOff: "border-stone-300 bg-stone-200 text-stone-800 shadow-[inset_0_0_0_1px_rgba(120,113,108,0.12)]",
};

export function ShiftTogglePill({
  label,
  kind,
  active,
  custom = false,
  disabled = false,
  onToggle,
}: ShiftTogglePillProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        "inline-flex h-8 min-w-28 items-center justify-center gap-1 rounded-full border px-4 text-xs font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-70",
        active
          ? ACTIVE_CLASSES[kind]
          : "border-stone-200 bg-white/70 text-stone-500 hover:border-stone-300 hover:bg-stone-50",
        custom && "ring-2 ring-amber-300/70"
      )}
      aria-pressed={active}
    >
      {label}
      {active ? <Check className="size-3.5" /> : null}
      {custom ? <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-800">Custom</span> : null}
    </button>
  );
}
