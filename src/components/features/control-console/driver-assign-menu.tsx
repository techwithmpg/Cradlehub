"use client";

import { useState, useTransition } from "react";

export type AvailableDriver = { id: string; full_name: string };

type Props = {
  bookingId: string;
  currentDriverId: string | null | undefined;
  currentDriverName: string | null | undefined;
  availableDrivers: AvailableDriver[];
  assignDriverAction: (input: unknown) => Promise<{ success: boolean; error?: string }>;
};

export function DriverAssignMenu({
  bookingId,
  currentDriverId,
  currentDriverName,
  availableDrivers,
  assignDriverAction,
}: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(currentDriverId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAssign() {
    startTransition(async () => {
      setError(null);
      const driverId = selected === "" ? null : selected;
      const result = await assignDriverAction({ bookingId, driverId });
      if (result.success) {
        setOpen(false);
      } else {
        setError(result.error ?? "Failed to assign driver");
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "4px 10px",
          borderRadius: 6,
          border: "1px solid",
          borderColor: currentDriverId ? "var(--cs-border)" : "#B45309",
          backgroundColor: currentDriverId ? "transparent" : "#FFFBEB",
          color: currentDriverId ? "var(--cs-text-muted)" : "#B45309",
          fontSize: "0.75rem",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {currentDriverId
          ? `🚗 ${currentDriverName ?? "Driver assigned"}`
          : "⚠️ Assign driver"}
      </button>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.375rem",
        padding: "0.5rem 0.625rem",
        backgroundColor: "var(--cs-surface-warm)",
        border: "1px solid var(--cs-border)",
        borderRadius: 8,
      }}
    >
      <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--cs-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Assign Driver
      </div>

      {availableDrivers.length === 0 ? (
        <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
          No drivers available in this branch.
        </div>
      ) : (
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={isPending}
          style={{
            height: 32,
            borderRadius: 6,
            border: "1px solid var(--cs-border)",
            padding: "0 0.5rem",
            fontSize: "0.8125rem",
            backgroundColor: "var(--cs-surface)",
            color: "var(--cs-text)",
            width: "100%",
          }}
        >
          <option value="">— No driver —</option>
          {availableDrivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.full_name}
            </option>
          ))}
        </select>
      )}

      {error && (
        <div style={{ fontSize: "0.75rem", color: "#991B1B" }}>{error}</div>
      )}

      <div style={{ display: "flex", gap: "0.375rem" }}>
        <button
          onClick={handleAssign}
          disabled={isPending || availableDrivers.length === 0}
          style={{
            flex: 1,
            padding: "4px 10px",
            borderRadius: 6,
            border: "none",
            backgroundColor: "var(--cs-sand)",
            color: "#fff",
            fontSize: "0.75rem",
            fontWeight: 600,
            cursor: isPending ? "not-allowed" : "pointer",
            opacity: isPending ? 0.7 : 1,
          }}
        >
          {isPending ? "Saving…" : "Confirm"}
        </button>
        <button
          onClick={() => { setOpen(false); setError(null); setSelected(currentDriverId ?? ""); }}
          disabled={isPending}
          style={{
            padding: "4px 10px",
            borderRadius: 6,
            border: "1px solid var(--cs-border)",
            backgroundColor: "transparent",
            color: "var(--cs-text-muted)",
            fontSize: "0.75rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
