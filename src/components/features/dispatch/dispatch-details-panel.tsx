import { Button } from "@/components/ui/button";
import type { DispatchRole } from "./types";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";
import { canManageDispatch } from "./types";

const ACCENT = "#6D28D9";

interface DispatchDetailsPanelProps {
  dispatch: RealDispatchItem | null;
  role: DispatchRole;
  onClose?: () => void;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: "0.625rem" }}>
      <div style={{ fontSize: 10.5, fontWeight: 500, color: "var(--cs-text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--cs-text)" }}>
        {value || "—"}
      </div>
    </div>
  );
}

function PaymentBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    paid:    { label: "Paid",    bg: "#F0FDF4", color: "#166534" },
    pending: { label: "Pending", bg: "#FFFBEB", color: "#B45309" },
    unpaid:  { label: "Unpaid",  bg: "#FEF2F2", color: "#991B1B" },
  };
  const cfg = map[status] ?? { label: status, bg: "#F9FAFB", color: "#374151" };
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

export function DispatchDetailsPanel({ dispatch, role, onClose }: DispatchDetailsPanelProps) {
  const canManage = canManageDispatch(role);

  if (!dispatch) {
    return (
      <div
        style={{
          background:     "var(--cs-surface)",
          border:         "1px solid var(--cs-border-soft)",
          borderRadius:   "var(--cs-r-md)",
          padding:        "1.25rem",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          minHeight:      180,
          color:          "var(--cs-text-subtle)",
          fontSize:       13,
          textAlign:      "center",
        }}
      >
        Select a dispatch to view details
      </div>
    );
  }

  return (
    <div
      style={{
        background:    "var(--cs-surface)",
        border:        "1px solid var(--cs-border-soft)",
        borderRadius:  "var(--cs-r-md)",
        padding:       "1rem 1.125rem",
        display:       "flex",
        flexDirection: "column",
        gap:           0,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.875rem" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: ACCENT }}>
          Dispatch {dispatch.number}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close dispatch details"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--cs-text-muted)", fontSize: 16, padding: 0, lineHeight: 1 }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Fields */}
      <Field label="Customer"  value={dispatch.customerName} />
      <Field label="Service"   value={dispatch.serviceName} />
      <Field label="Area"      value={dispatch.area ?? "Location not confirmed"} />
      {dispatch.formattedAddress && (
        <Field label="Address" value={dispatch.formattedAddress} />
      )}
      {dispatch.etaMinutes !== null && (
        <Field label="ETA" value={`${dispatch.etaMinutes} min`} />
      )}
      <Field label="Driver"    value={dispatch.driverName    ?? "Driver not assigned"} />
      <Field label="Therapist" value={dispatch.therapistName ?? "—"} />
      <Field label="Appt. Time" value={dispatch.startTime} />

      {/* Payment */}
      <div style={{ marginBottom: "0.875rem" }}>
        <div style={{ fontSize: 10.5, fontWeight: 500, color: "var(--cs-text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>
          Payment
        </div>
        <PaymentBadge status={dispatch.paymentStatus} />
      </div>

      {/* Action buttons — role-gated */}
      {canManage && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.25rem" }}>
          <Button
            style={{ background: ACCENT, color: "#fff", border: "none", fontWeight: 600, fontSize: 13, justifyContent: "center" }}
            disabled
            title="Driver assignment coming soon"
          >
            Assign Driver
          </Button>
          <Button
            variant="outline"
            style={{ fontSize: 13, justifyContent: "center" }}
            disabled
            title="Therapist reassignment coming soon"
          >
            Assign Therapist
          </Button>
          <Button
            variant="outline"
            style={{ fontSize: 13, justifyContent: "center" }}
            disabled
            title="Customer notification coming soon"
          >
            Notify Customer
          </Button>
        </div>
      )}

      {role === "owner" && (
        <Button variant="outline" style={{ fontSize: 13, justifyContent: "center", marginTop: "0.25rem" }} disabled>
          View Details
        </Button>
      )}
    </div>
  );
}
