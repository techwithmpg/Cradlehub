"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ClipboardCheck,
  Building2,
  Package,
  Footprints,
  ListChecks,
} from "lucide-react";
import type { TodayBooking } from "@/components/features/manager-today/manager-today-utils";
import type { StaffMember } from "@/components/features/staff/staff-management-utils";
import { getStaffInternalName } from "@/components/features/staff/staff-management-utils";
import {
  readRelation,
  getUrgencyScore,
  formatTime12,
} from "@/components/features/manager-today/manager-today-utils";

type Props = {
  bookings: TodayBooking[];
  pendingStaff: StaffMember[];
  userRole: string;
};

export function ManagerApprovalsScreen({ bookings, pendingStaff }: Props) {
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes();

  const bookingIssues = useMemo(() => {
    const active = bookings.filter((b) => b.status !== "cancelled" && b.status !== "no_show");
    return active
      .filter((b) => getUrgencyScore(b, nowMins) > 0)
      .sort((a, b) => getUrgencyScore(b, nowMins) - getUrgencyScore(a, nowMins));
  }, [bookings, nowMins]);

  const urgentCount = bookingIssues.filter((b) => getUrgencyScore(b, nowMins) >= 85).length;
  const waitingCount = pendingStaff.length + bookingIssues.filter((b) => getUrgencyScore(b, nowMins) < 85).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* Header */}
      <div>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "var(--cs-text)",
            fontFamily: "var(--font-display)",
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          Approvals
        </h1>
        <p style={{ fontSize: 13, color: "var(--cs-text-muted)", margin: "4px 0 0" }}>
          What needs your decision
        </p>
      </div>

      {/* Summary Strip */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <SummaryTile value={urgentCount} label="Urgent" color="var(--cs-error)" bg="var(--cs-error-bg)" />
        <SummaryTile value={waitingCount} label="Waiting" color="var(--cs-warning)" bg="var(--cs-warning-bg)" />
        <SummaryTile value={0} label="Done Today" color="var(--cs-success)" bg="var(--cs-success-bg)" />
      </div>

      {/* Approval Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {pendingStaff.length > 0 && (
          <ApprovalCard
            title="New Staff Approval"
            description={`${pendingStaff[0] ? getStaffInternalName(pendingStaff[0]) : "Someone"} is awaiting activation`}
            count={pendingStaff.length}
            priority="high"
            actions={[
              { label: "Review", href: "/manager/staff?tab=pending" },
            ]}
          />
        )}

        {bookingIssues.slice(0, 5).map((b) => {
          const customer = readRelation(b.customers);
          const service = readRelation(b.services);
          const score = getUrgencyScore(b, nowMins);
          return (
            <ApprovalCard
              key={b.id}
              title={b.status === "pending" ? "Booking Confirmation" : "Booking Exception"}
              description={`${customer?.full_name ?? "Guest"} · ${service?.name ?? "Service"} · ${formatTime12(b.start_time)}`}
              count={1}
              priority={score >= 85 ? "high" : "medium"}
              actions={[{ label: "Review", href: "/manager/bookings" }]}
            />
          );
        })}

        {pendingStaff.length === 0 && bookingIssues.length === 0 && (
          <EmptyState message="No approvals waiting" />
        )}
      </div>

      {/* Operations Quick Tiles */}
      <section>
        <h2
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "var(--cs-text)",
            fontFamily: "var(--font-display)",
            margin: "8px 0 10px",
          }}
        >
          Operations
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <QuickTile icon={Building2} label="Rooms" href="/manager/spaces-rules" />
          <QuickTile icon={Package} label="Resources" href="/manager/resources" />
          <QuickTile icon={Footprints} label="Walk-ins" onClick={() => {}} />
          <QuickTile icon={ListChecks} label="Checklist" href="/manager/operations" />
        </div>
      </section>
    </div>
  );
}

function SummaryTile({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: string;
  bg: string;
}) {
  return (
    <div
      style={{
        background: "var(--cs-surface)",
        border: "1px solid var(--cs-border-soft)",
        borderRadius: "var(--cs-r-lg)",
        padding: "10px",
        textAlign: "center",
        boxShadow: "var(--cs-shadow-xs)",
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--cs-text-muted)", fontWeight: 500 }}>{label}</div>
    </div>
  );
}

function ApprovalCard({
  title,
  description,
  priority,
  actions,
}: {
  title: string;
  description: string;
  count: number;
  priority: "high" | "medium" | "low";
  actions: { label: string; href?: string; onClick?: () => void }[];
}) {
  const priorityColors = {
    high: { bg: "var(--cs-error-bg)", color: "var(--cs-error-text)", label: "Urgent" },
    medium: { bg: "var(--cs-warning-bg)", color: "var(--cs-warning-text)", label: "Review" },
    low: { bg: "var(--cs-info-bg)", color: "var(--cs-info-text)", label: "FYI" },
  };
  const p = priorityColors[priority];

  return (
    <div
      style={{
        background: "var(--cs-surface)",
        border: "1px solid var(--cs-border-soft)",
        borderRadius: "var(--cs-r-lg)",
        padding: "12px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        boxShadow: "var(--cs-shadow-xs)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--cs-text)" }}>{title}</div>
          <div style={{ fontSize: 12, color: "var(--cs-text-muted)", marginTop: 2, lineHeight: 1.4 }}>{description}</div>
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: "3px 8px",
            borderRadius: "var(--cs-r-pill)",
            background: p.bg,
            color: p.color,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {p.label}
        </span>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {actions.map((a, i) =>
          a.href ? (
            <Link
              key={i}
              href={a.href}
              style={{
                flex: 1,
                padding: "8px 0",
                borderRadius: "var(--cs-r-md)",
                background: i === 0 ? "var(--cs-sand-tint)" : "var(--cs-surface)",
                color: i === 0 ? "var(--cs-sand-dark)" : "var(--cs-text-secondary)",
                border: i === 0 ? "none" : "1px solid var(--cs-border-soft)",
                textAlign: "center",
                textDecoration: "none",
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {a.label}
            </Link>
          ) : (
            <button
              key={i}
              type="button"
              onClick={a.onClick}
              disabled
              style={{
                flex: 1,
                padding: "8px 0",
                borderRadius: "var(--cs-r-md)",
                background: i === 0 ? "var(--cs-sand-tint)" : "var(--cs-surface)",
                color: i === 0 ? "var(--cs-sand-dark)" : "var(--cs-text-secondary)",
                border: i === 0 ? "none" : "1px solid var(--cs-border-soft)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "not-allowed",
                opacity: 0.6,
              }}
            >
              {a.label}
            </button>
          )
        )}
      </div>
    </div>
  );
}

function QuickTile({
  icon: Icon,
  label,
  href,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string; style?: React.CSSProperties }>;
  label: string;
  href?: string;
  onClick?: () => void;
}) {
  const content = (
    <div
      style={{
        background: "var(--cs-surface)",
        border: "1px solid var(--cs-border-soft)",
        borderRadius: "var(--cs-r-lg)",
        padding: "12px 10px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        boxShadow: "var(--cs-shadow-xs)",
        cursor: href || onClick ? "pointer" : "default",
        opacity: href || onClick ? 1 : 0.6,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "var(--cs-r-md)",
          background: "var(--cs-sand-tint)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={20} style={{ color: "var(--cs-sand-dark)" }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--cs-text-secondary)" }}>{label}</span>
    </div>
  );

  if (href) {
    return (
      <Link href={href} style={{ textDecoration: "none" }}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} disabled={!onClick} style={{ all: "unset", width: "100%" }}>
      {content}
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "2rem 1rem",
        color: "var(--cs-text-muted)",
        fontSize: 14,
        background: "var(--cs-surface)",
        border: "1px solid var(--cs-border-soft)",
        borderRadius: "var(--cs-r-lg)",
      }}
    >
      <ClipboardCheck size={28} style={{ marginBottom: 8, opacity: 0.4 }} />
      <div>{message}</div>
    </div>
  );
}
