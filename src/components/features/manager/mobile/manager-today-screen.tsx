"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Users,
  AlertTriangle,
  UserCheck,
  Clock,
  ChevronRight,
  CalendarPlus,
  ClipboardCheck,
  Bell,
} from "lucide-react";
import {
  readRelation,
  formatTime12,
  timeToMinutes,
  computeKpiData,
  computeAlerts,
  getUrgencyScore,
  bookingNeedsResourceAssignment,
  type TodayBooking,
  type StaffAvailability,
} from "@/components/features/manager-today/manager-today-utils";
import type { StaffMember } from "@/components/features/staff/staff-management-utils";
import { getStaffAdminName } from "@/lib/staff/display-name";
import { BookingStatusBadge } from "@/components/features/dashboard/booking-status-badge";
import { WalkinDialog } from "@/components/features/manager-today/walkin-dialog";

type Props = {
  branchName: string;
  todayLabel: string;
  bookings: TodayBooking[];
  staff: StaffAvailability[];
  pendingStaff: StaffMember[];
  userRole: string;
};

export function ManagerTodayScreen({
  branchName,
  todayLabel,
  bookings,
  staff,
  pendingStaff,
}: Props) {
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const [walkinOpen, setWalkinOpen] = useState(false);

  const kpi = useMemo(() => computeKpiData(bookings, staff.length), [bookings, staff.length]);
  const alerts = useMemo(() => computeAlerts(bookings, nowMins), [bookings, nowMins]);

  const activeBookings = bookings.filter((b) => b.status !== "cancelled" && b.status !== "no_show");
  const sortedBookings = [...activeBookings].sort(
    (a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time)
  );

  const attentionBookings = activeBookings
    .filter((b) => getUrgencyScore(b, nowMins) > 0)
    .sort((a, b) => getUrgencyScore(b, nowMins) - getUrgencyScore(a, nowMins));

  const pendingApprovalsCount = pendingStaff?.length ?? 0;
  const openIssuesCount = alerts.reduce((sum, a) => sum + a.count, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "var(--cs-text-muted)",
              marginBottom: 1,
            }}
          >
            {branchName}
          </div>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "var(--cs-text)",
              fontFamily: "var(--font-display)",
              lineHeight: 1.2,
              margin: 0,
            }}
          >
            Good morning, Manager
          </h1>
          <div style={{ fontSize: 12, color: "var(--cs-text-muted)", marginTop: 1 }}>
            {todayLabel}
          </div>
        </div>
        <button
          type="button"
          aria-label="Notifications"
          style={{
            width: 36,
            height: 36,
            borderRadius: "var(--cs-r-md)",
            background: "var(--cs-surface)",
            border: "1px solid var(--cs-border-soft)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--cs-text-secondary)",
            flexShrink: 0,
            cursor: "pointer",
          }}
        >
          <Bell size={16} />
        </button>
      </div>

      {/* KPI Strip */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <KpiTile
          icon={CalendarDays}
          value={kpi.totalBookings}
          label="Bookings"
          color="var(--cs-sand)"
          bg="var(--cs-sand-tint)"
        />
        <KpiTile
          icon={Users}
          value={staff.filter((s) => s.status !== "off_duty").length}
          label="On Duty"
          color="var(--cs-success)"
          bg="var(--cs-success-bg)"
        />
        <KpiTile
          icon={AlertTriangle}
          value={openIssuesCount}
          label="Issues"
          color={openIssuesCount > 0 ? "var(--cs-error)" : "var(--cs-text-muted)"}
          bg={openIssuesCount > 0 ? "var(--cs-error-bg)" : "var(--cs-neutral-bg)"}
        />
        <KpiTile
          icon={UserCheck}
          value={pendingApprovalsCount}
          label="Pending"
          color={pendingApprovalsCount > 0 ? "var(--cs-warning)" : "var(--cs-text-muted)"}
          bg={pendingApprovalsCount > 0 ? "var(--cs-warning-bg)" : "var(--cs-neutral-bg)"}
        />
      </div>

      {/* Quick Actions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <QuickActionButton icon={CalendarDays} label="View Schedule" href="/manager/schedule" />
        <QuickActionButton icon={ClipboardCheck} label="Approve Staff" href="/manager/staff?tab=pending" />
        <QuickActionButton icon={AlertTriangle} label="Open Issues" href="/manager/bookings" />
        <QuickActionButton icon={CalendarPlus} label="Add Walk-in" onClick={() => setWalkinOpen(true)} />
      </div>

      {/* Today's Flow */}
      <section>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <h2
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "var(--cs-text)",
              fontFamily: "var(--font-display)",
              margin: 0,
            }}
          >
            Today&apos;s Flow
          </h2>
          <Link
            href="/manager/schedule"
            style={{
              fontSize: 11,
              color: "var(--cs-sand)",
              textDecoration: "none",
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            Full <ChevronRight size={11} />
          </Link>
        </div>

        {sortedBookings.length === 0 ? (
          <EmptyState message="No bookings yet today" />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {sortedBookings.map((b) => (
              <BookingFlowCard key={b.id} booking={b} />
            ))}
          </div>
        )}
      </section>

      {/* Attention Needed */}
      {attentionBookings.length > 0 && (
        <section>
          <h2
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "var(--cs-text)",
              fontFamily: "var(--font-display)",
              margin: "0 0 8px",
            }}
          >
            Attention Needed
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {attentionBookings.slice(0, 4).map((b) => (
              <AttentionCard key={b.id} booking={b} nowMins={nowMins} />
            ))}
          </div>
        </section>
      )}

      <WalkinDialog open={walkinOpen} onOpenChange={setWalkinOpen} />
    </div>
  );
}

function KpiTile({
  icon: Icon,
  value,
  label,
  color,
  bg,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string; style?: React.CSSProperties }>;
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
        borderRadius: "var(--cs-r-md)",
        padding: "10px 12px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        boxShadow: "var(--cs-shadow-xs)",
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={16} style={{ color }} />
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color, lineHeight: 1.2 }}>{value}</div>
        <div style={{ fontSize: 10, color: "var(--cs-text-muted)", fontWeight: 500 }}>{label}</div>
      </div>
    </div>
  );
}

function QuickActionButton({
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
        borderRadius: "var(--cs-r-md)",
        padding: "10px 10px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 5,
        boxShadow: "var(--cs-shadow-xs)",
        cursor: href || onClick ? "pointer" : "default",
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "var(--cs-r-sm)",
          background: "var(--cs-sand-tint)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={16} style={{ color: "var(--cs-sand-dark)" }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--cs-text-secondary)" }}>{label}</span>
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
    <button type="button" onClick={onClick} style={{ all: "unset", width: "100%" }}>
      {content}
    </button>
  );
}

function BookingFlowCard({ booking }: { booking: TodayBooking }) {
  const customer = readRelation(booking.customers);
  const service = readRelation(booking.services);
  const staffMember = readRelation(booking.staff);
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
  const startMins = timeToMinutes(booking.start_time);
  const endMins = timeToMinutes(booking.end_time);
  const isPast = endMins < nowMins;
  const isCurrent = startMins <= nowMins && endMins > nowMins;

  return (
    <div
      style={{
        background: "var(--cs-surface)",
        border: "1px solid var(--cs-border-soft)",
        borderRadius: "var(--cs-r-md)",
        padding: "10px 12px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        boxShadow: "var(--cs-shadow-xs)",
        opacity: isPast ? 0.65 : 1,
      }}
    >
      <div style={{ textAlign: "center", minWidth: 38, flexShrink: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--cs-text)" }}>
          {formatTime12(booking.start_time)}
        </div>
        <div style={{ fontSize: 9, color: "var(--cs-text-muted)" }}>
          {service?.duration_minutes ?? "—"} min
        </div>
      </div>
      <div style={{ width: 2, alignSelf: "stretch", borderRadius: 2, background: isCurrent ? "var(--cs-sand)" : "var(--cs-border)", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--cs-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {customer?.full_name ?? "Guest"}
        </div>
        <div style={{ fontSize: 11, color: "var(--cs-text-muted)", display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
          {service?.name ?? "Service"}
          {staffMember && <span>· {getStaffAdminName(staffMember)}</span>}
        </div>
        <div style={{ marginTop: 3 }}>
          <BookingStatusBadge status={booking.status} />
        </div>
      </div>
    </div>
  );
}

function AttentionCard({
  booking,
  nowMins,
}: {
  booking: TodayBooking;
  nowMins: number;
}) {
  const customer = readRelation(booking.customers);
  const service = readRelation(booking.services);
  const staffMember = readRelation(booking.staff);

  const issues: string[] = [];
  if (booking.status === "pending") issues.push("Pending confirmation");
  if (bookingNeedsResourceAssignment(booking)) issues.push("No room assigned");
  if (!staffMember) issues.push("No therapist");
  if (getUrgencyScore(booking, nowMins) === 70) issues.push("Starting soon");

  return (
    <div
      style={{
        background: "var(--cs-surface)",
        border: "1px solid var(--cs-border-soft)",
        borderRadius: "var(--cs-r-md)",
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        boxShadow: "var(--cs-shadow-xs)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ textAlign: "center", minWidth: 38, flexShrink: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--cs-error)" }}>
            {formatTime12(booking.start_time)}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--cs-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {customer?.full_name ?? "Guest"}
          </div>
          <div style={{ fontSize: 11, color: "var(--cs-text-muted)" }}>
            {service?.name ?? "Service"}
          </div>
        </div>
        <BookingStatusBadge status={booking.status} />
      </div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", paddingLeft: 46 }}>
        {issues.map((issue) => (
          <span
            key={issue}
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: "2px 7px",
              borderRadius: "var(--cs-r-pill)",
              background: "var(--cs-error-bg)",
              color: "var(--cs-error-text)",
            }}
          >
            {issue}
          </span>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "1.5rem 1rem",
        color: "var(--cs-text-muted)",
        fontSize: 13,
        background: "var(--cs-surface)",
        border: "1px solid var(--cs-border-soft)",
        borderRadius: "var(--cs-r-md)",
      }}
    >
      <Clock size={24} style={{ marginBottom: 6, opacity: 0.4 }} />
      <div>{message}</div>
    </div>
  );
}
