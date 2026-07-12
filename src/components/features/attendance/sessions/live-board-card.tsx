"use client";

import { CheckCircle2 } from "lucide-react";
import type { AttendanceTab } from "@/lib/attendance/types";

export function LiveBoardCard({
  onTabChange,
}: {
  onTabChange?: (tab: AttendanceTab) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onTabChange?.("overview")}
      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-primary bg-card px-4 text-sm font-bold text-primary transition hover:bg-primary/10"
    >
      <CheckCircle2 className="size-4" />
      Go to Live Board
    </button>
  );
}
