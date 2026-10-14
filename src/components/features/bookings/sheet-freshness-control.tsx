"use client";

import type { SheetNativeReferencesState } from "@/lib/integrations/google-sheets/sheet-native-types";

export function SheetFreshnessControl({
  state,
  refreshing,
  onRefresh,
}: {
  state?: SheetNativeReferencesState;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const checked = state?.observedAt
    ? new Intl.DateTimeFormat("en-PH", {
        timeZone: "Asia/Manila",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date(state.observedAt))
    : null;
  return (
    <div
      className="inline-flex items-center gap-2 text-xs text-muted-foreground"
      aria-live="polite"
    >
      <span>Master Sheet · {checked ? `checked ${checked} PHT` : "checking…"}</span>
      <button
        type="button"
        className="underline underline-offset-2"
        onClick={onRefresh}
        disabled={refreshing || !onRefresh}
      >
        {refreshing ? "Refreshing…" : "Refresh"}
      </button>
    </div>
  );
}
