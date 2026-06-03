"use client";

/**
 * CrmScheduleDetailsPanel
 *
 * Inline right-side panel for the CRM schedule page.
 * Shows either staff details (when a staff row is selected) or
 * booking details (when a booking block is selected).
 *
 * This replaces the Sheet-based details panel for CRM context.
 */

import { useState } from "react";
import { X, User, Clock, Scissors, BedDouble, CreditCard } from "lucide-react";
import { BookingStatusBadge } from "@/components/features/dashboard/booking-status-badge";
import { BookingTypeBadge } from "@/components/features/dashboard/booking-type-badge";
import { StaffScheduleCalendarModal } from "@/components/features/staff-schedule/staff-schedule-calendar-modal";
import { formatScheduleTime } from "@/lib/utils/schedule-timeline";
import type { DailyScheduleStaffRow, DailyScheduleBooking } from "@/lib/queries/schedule";
import type { StaffScheduleItem } from "@/components/features/staff-schedule/staff-schedule-list";
import type { Database } from "@/types/supabase";

type ResourceRow = Database["public"]["Tables"]["branch_resources"]["Row"];

type CrmScheduleDetailsPanelProps = {
  staff: DailyScheduleStaffRow | null;
  booking: DailyScheduleBooking | null;
  availabilityItem?: StaffScheduleItem | null;
  branchResources: ResourceRow[];
  date: string;
  branchName?: string | null;
  onClose: () => void;
  canEditAvailability?: boolean;
  onEditAvailability?: () => void;
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatStaffLabel(staff: DailyScheduleStaffRow): string {
  if (!staff.staff_tier) return "Service Staff";
  const tier = staff.staff_tier.toLowerCase();
  if (tier === "senior") return "Senior Therapist";
  if (tier === "mid") return "Therapist";
  if (tier === "junior") return "Junior Therapist";
  return staff.staff_tier.charAt(0).toUpperCase() + staff.staff_tier.slice(1);
}

function durationLabel(start: string, end: string): string {
  const [h1, m1] = start.split(":").map(Number);
  const [h2, m2] = end.split(":").map(Number);
  const mins = (h2! * 60 + m2!) - (h1! * 60 + m1!);
  if (mins < 0) return "";
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const rm = mins % 60;
    return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
  }
  return `${mins}m`;
}

export function CrmScheduleDetailsPanel({
  staff,
  booking,
  availabilityItem,
  date,
  branchName,
  onClose,
  canEditAvailability = false,
  onEditAvailability,
}: CrmScheduleDetailsPanelProps) {
  const [isFullScheduleOpen, setIsFullScheduleOpen] = useState(false);

  if (!staff && !booking) {
    return (
      <div
        style={{
          backgroundColor: "var(--cs-surface)",
          border: "1px solid var(--cs-border)",
          borderRadius: 10,
          padding: "1.25rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 200,
        }}
      >
        <span style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)" }}>
          Select a staff member or booking to view details.
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: "var(--cs-surface)",
        border: "1px solid var(--cs-border)",
        borderRadius: 10,
        padding: "1.25rem",
        height: "fit-content",
        maxHeight: "calc(100vh - 200px)",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          style={{
            fontSize: "0.6875rem",
            fontWeight: 600,
            color: "var(--cs-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {booking ? "Booking Details" : "Staff Details"}
        </span>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--cs-text-muted)",
            fontSize: "1.125rem",
            lineHeight: 1,
            padding: "0 2px",
          }}
          aria-label="Close details"
        >
          <X size={16} />
        </button>
      </div>

      {/* Staff info (always shown when staff is selected) */}
      {staff && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "#E8F5E9",
              color: "#4A7C59",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.875rem",
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {getInitials(staff.staff_name)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--cs-text)" }}>
              {staff.staff_name}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", marginTop: 1 }}>
              {formatStaffLabel(staff)}
            </div>
          </div>
        </div>
      )}

      {/* Staff schedule */}
      {staff && (
        <PanelSection label="Today's Schedule" icon={<Clock size={12} />}>
          {staff.work_start && staff.work_end ? (
            <PanelRow
              label="Hours"
              value={`${formatScheduleTime(staff.work_start)} – ${formatScheduleTime(staff.work_end)}`}
            />
          ) : (
            <PanelRow label="Status" value="Off today" valueColor="#9CA3AF" />
          )}
          <PanelRow label="Bookings" value={`${staff.bookings.length} assigned`} />
          <PanelRow label="Blocked" value={`${staff.blocks.length} blocks`} />
        </PanelSection>
      )}

      {/* Staff bookings list */}
      {staff && staff.bookings.length > 0 && (
        <PanelSection label="Assigned Bookings" icon={<Scissors size={12} />}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {staff.bookings.map((b) => (
              <div
                key={b.id}
                style={{
                  padding: "6px 8px",
                  borderRadius: 6,
                  background: "var(--cs-surface-warm)",
                  border: "1px solid var(--cs-border-soft)",
                  fontSize: "0.75rem",
                }}
              >
                <div style={{ fontWeight: 600, color: "var(--cs-text)" }}>{b.service}</div>
                <div style={{ color: "var(--cs-text-muted)", marginTop: 2 }}>
                  {formatScheduleTime(b.start_time)} – {formatScheduleTime(b.end_time)} · {b.customer}
                </div>
                <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                  <BookingStatusBadge status={b.status} />
                  <BookingTypeBadge type={b.type ?? "online"} />
                </div>
              </div>
            ))}
          </div>
        </PanelSection>
      )}

      {/* Booking-specific details */}
      {booking && (
        <>
          <PanelSection label="Booking Info" icon={<Scissors size={12} />}>
            <PanelRow label="Service" value={booking.service} />
            <PanelRow
              label="Time"
              value={`${formatScheduleTime(booking.start_time)} – ${formatScheduleTime(booking.end_time)}`}
            />
            <PanelRow label="Duration" value={durationLabel(booking.start_time, booking.end_time)} />
            <PanelRow label="Customer" value={booking.customer} />
            {booking.resource_name && (
              <PanelRow label="Room" value={booking.resource_name} icon={<BedDouble size={12} />} />
            )}
          </PanelSection>

          <PanelSection label="Status" icon={<CreditCard size={12} />}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <BookingStatusBadge status={booking.status} />
              <BookingTypeBadge type={booking.type ?? "online"} />
            </div>
          </PanelSection>
        </>
      )}

      {/* Actions */}
      {staff && (
        <PanelSection label="Actions" icon={<User size={12} />}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <ActionButton
              label="Edit Availability"
              onClick={onEditAvailability}
              disabled={!canEditAvailability}
            />
            <ActionButton
              label="View Full Schedule"
              onClick={() => setIsFullScheduleOpen(true)}
            />
          </div>
        </PanelSection>
      )}

      <StaffScheduleCalendarModal
        open={isFullScheduleOpen}
        onOpenChange={setIsFullScheduleOpen}
        initialDate={date}
        branchName={branchName}
        staff={
          staff
            ? {
                id: staff.staff_id,
                full_name: staff.staff_name,
                nickname: availabilityItem?.staff.nickname ?? null,
                avatar_url: null,
                staff_type: availabilityItem?.staff.staff_type ?? null,
                system_role: null,
                branch_name: branchName ?? null,
              }
            : null
        }
      />
    </div>
  );
}

function PanelSection({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: "0.625rem",
          fontWeight: 700,
          color: "var(--cs-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          marginBottom: "0.5rem",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        {icon}
        {label}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>{children}</div>
    </div>
  );
}

function PanelRow({
  label,
  value,
  icon,
  valueColor,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  valueColor?: string;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, minWidth: 0 }}>
      <span style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)", flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}>
        {icon}
        {label}
      </span>
      <span
        style={{
          fontSize: "0.8125rem",
          fontWeight: 500,
          color: valueColor ?? "var(--cs-text)",
          textAlign: "right",
          minWidth: 0,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center rounded-md border border-[var(--cs-border)] bg-[var(--cs-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--cs-text-secondary)] transition hover:bg-[var(--cs-surface-warm)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
  );
}
