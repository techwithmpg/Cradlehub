"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkInStaffForShiftAction, checkOutStaffForShiftAction } from "@/lib/actions/staff-checkins";
import type { CheckinRecord } from "@/lib/actions/staff-checkins";

type Props = {
  staffId: string;
  branchId: string;
  shiftDate: string;
  checkin: CheckinRecord | null;
};

function formatCheckinTime(isoString: string): string {
  const d = new Date(isoString);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

export function StaffCheckinWidget({ staffId, branchId, shiftDate, checkin }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const isCheckedIn  = checkin?.status === "checked_in";
  const isCheckedOut = checkin?.status === "checked_out";

  return (
    <div
      style={{
        background: "var(--cs-surface-raised)",
        border: `1px solid ${isCheckedIn ? "var(--cs-success)" : isCheckedOut ? "var(--cs-border-soft)" : "var(--cs-border-soft)"}`,
        borderRadius: "var(--cs-r-md)",
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      {/* Status */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--cs-text)", marginBottom: 4 }}>
          My Shift Today
        </div>
        {!checkin && (
          <div style={{ fontSize: 12, color: "var(--cs-text-muted)" }}>
            Not yet checked in
          </div>
        )}
        {isCheckedIn && checkin && (
          <div style={{ fontSize: 12, color: "var(--cs-success)", fontWeight: 500 }}>
            ✓ Checked in at {formatCheckinTime(checkin.checked_in_at)}
          </div>
        )}
        {isCheckedOut && checkin && (
          <div style={{ fontSize: 12, color: "var(--cs-text-muted)" }}>
            Checked out{checkin.checked_out_at ? ` at ${formatCheckinTime(checkin.checked_out_at)}` : ""}
          </div>
        )}
      </div>

      {/* Action button */}
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        {!checkin && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                await checkInStaffForShiftAction({
                  staffId,
                  branchId,
                  shiftDate,
                  shiftType: "single",
                });
                router.refresh();
              });
            }}
            style={{
              padding: "7px 16px", fontSize: 12, fontWeight: 600,
              background: "var(--cs-success)", color: "#fff",
              border: "none", borderRadius: "var(--cs-r-sm)",
              cursor: isPending ? "wait" : "pointer",
              opacity: isPending ? 0.6 : 1,
            }}
          >
            {isPending ? "Checking in…" : "Check In"}
          </button>
        )}

        {isCheckedIn && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                await checkOutStaffForShiftAction({
                  staffId,
                  shiftDate,
                  shiftType: (checkin?.shift_type ?? "single") as "single" | "opening" | "closing",
                });
                router.refresh();
              });
            }}
            style={{
              padding: "7px 16px", fontSize: 12, fontWeight: 500,
              background: "transparent", color: "var(--cs-text-muted)",
              border: "1px solid var(--cs-border-soft)", borderRadius: "var(--cs-r-sm)",
              cursor: isPending ? "wait" : "pointer",
              opacity: isPending ? 0.6 : 1,
            }}
          >
            {isPending ? "Checking out…" : "Check Out"}
          </button>
        )}

        {isCheckedOut && (
          <span style={{ fontSize: 12, color: "var(--cs-text-muted)", fontStyle: "italic" }}>
            Shift complete
          </span>
        )}
      </div>
    </div>
  );
}
