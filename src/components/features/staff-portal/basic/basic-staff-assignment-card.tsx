import Link from "next/link";
import { Sparkles } from "lucide-react";
import { formatTime } from "@/lib/utils";
import type { StaffPortalBooking } from "@/components/features/staff-portal/types";

type BasicStaffAssignmentCardProps = {
  bookings: StaffPortalBooking[];
};

function firstRelation<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: "var(--cs-success)",
  pending: "var(--cs-sand)",
  in_progress: "var(--cs-info)",
  completed: "var(--cs-text-muted)",
  cancelled: "var(--cs-text-muted)",
  no_show: "var(--cs-text-muted)",
};

function statusLabel(status: string): string {
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function AssignmentRow({ booking }: { booking: StaffPortalBooking }) {
  const service = firstRelation(booking.services);
  const customer = firstRelation(booking.customers);
  const accentColor = STATUS_COLORS[booking.status] ?? "var(--cs-text-muted)";

  return (
    <div
      style={{
        borderLeft: `3px solid var(--cs-staff-accent)`,
        paddingLeft: "0.75rem",
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--cs-text)", lineHeight: 1.25 }}>
        {service?.name ?? "Assignment"}
      </div>
      {customer && (
        <div style={{ fontSize: 12, color: "var(--cs-text-secondary)", marginTop: 2 }}>
          {customer.full_name}
        </div>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 6,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 12, color: "var(--cs-text-muted)" }}>
          {formatTime(booking.start_time)}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "2px 7px",
            borderRadius: 100,
            backgroundColor: `${accentColor}1A`,
            color: accentColor,
          }}
        >
          {statusLabel(booking.status)}
        </span>
      </div>
    </div>
  );
}

function EmptyAssignment() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        padding: "0.5rem 0 0.75rem",
        gap: "0.375rem",
      }}
    >
      <Sparkles size={26} color="var(--cs-text-muted)" style={{ opacity: 0.35 }} />
      <p
        style={{
          margin: 0,
          fontSize: 13,
          color: "var(--cs-text-muted)",
          lineHeight: 1.5,
        }}
      >
        No tasks or bookings assigned for today.
      </p>
    </div>
  );
}

export function BasicStaffAssignmentCard({ bookings }: BasicStaffAssignmentCardProps) {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const active = bookings.filter(
    (b) => b.status !== "completed" && b.status !== "cancelled"
  );

  const nextBooking =
    active.find((b) => {
      const [h, min] = b.start_time.split(":").map(Number);
      return (h ?? 0) * 60 + (min ?? 0) >= nowMinutes;
    }) ??
    active[0] ??
    null;

  return (
    <div
      style={{
        backgroundColor: "#fff",
        borderRadius: 16,
        border: "1px solid var(--cs-border-soft)",
        padding: "1rem 1.125rem",
        boxShadow: "var(--cs-shadow-xs)",
        display: "flex",
        flexDirection: "column",
        gap: "0.625rem",
      }}
    >
      {/* Card label */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "var(--cs-text-muted)",
        }}
      >
        Next Assignment
      </div>

      {nextBooking ? <AssignmentRow booking={nextBooking} /> : <EmptyAssignment />}

      <Link
        href="/staff-portal/schedule"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "0.5rem 0.875rem",
          borderRadius: 10,
          border: "1px solid var(--cs-border)",
          backgroundColor: "var(--cs-surface-warm)",
          color: "var(--cs-staff-accent)",
          fontSize: 12,
          fontWeight: 600,
          textDecoration: "none",
          alignSelf: "flex-start",
        }}
      >
        View All Assignments
      </Link>
    </div>
  );
}
