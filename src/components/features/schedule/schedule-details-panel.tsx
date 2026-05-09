"use client";

import { useState, useTransition } from "react";
import { X, MapPin, Clock, CalendarDays, User, BedDouble, Scissors, CreditCard } from "lucide-react";
import { BookingStatusBadge } from "@/components/features/dashboard/booking-status-badge";
import { BookingTypeBadge } from "@/components/features/dashboard/booking-type-badge";
import { BookingActionMenu } from "@/components/features/dashboard/booking-action-menu";
import { PaymentActionMenu } from "@/components/features/dashboard/payment-action-menu";
import { Button } from "@/components/ui/button";
import { formatScheduleTime } from "@/lib/utils/schedule-timeline";
import type { DailyScheduleBooking } from "@/lib/queries/schedule";
import type { Database } from "@/types/supabase";
import { editBookingAction } from "@/app/(dashboard)/manager/bookings/actions";

type ResourceRow = Database["public"]["Tables"]["branch_resources"]["Row"];

type ActionFn = (input: unknown) => Promise<{ success: boolean; error?: string }>;

export type ScheduleDetailsPanelProps = {
  booking: DailyScheduleBooking | null;
  staffName: string;
  branchResources: ResourceRow[];
  date: string;
  viewerRole: string;
  statusAction?: ActionFn;
  paymentAction?: ActionFn;
  onClose: () => void;
};

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

export function ScheduleDetailsPanel({
  booking,
  staffName,
  branchResources,
  date,
  viewerRole,
  statusAction,
  paymentAction,
  onClose,
}: ScheduleDetailsPanelProps) {
  if (!booking) {
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
          minHeight: 120,
        }}
      >
        <span style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)" }}>Select a booking to view details.</span>
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
        position: "sticky",
        top: "1rem",
        height: "fit-content",
        maxHeight: "calc(100vh - 160px)",
        overflowY: "auto",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <span
          style={{
            fontSize: "0.6875rem",
            fontWeight: 600,
            color: "var(--cs-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Booking Details
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
          aria-label="Close booking details"
        >
          <X size={16} />
        </button>
      </div>

      {/* ID + Badges */}
      <div style={{ marginBottom: "1.25rem" }}>
        <div
          style={{
            fontSize: "0.75rem",
            color: "var(--cs-text-muted)",
            fontFamily: "var(--font-mono, monospace)",
            marginBottom: "0.5rem",
          }}
        >
          #{booking.id.slice(0, 8).toUpperCase()}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <BookingStatusBadge status={booking.status} />
          <BookingTypeBadge type={booking.type ?? "online"} />
        </div>
      </div>

      {/* Sections */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
        <PanelSection label="Customer" icon={<User size={12} />}>
          <PanelRow label="Name" value={booking.customer} />
        </PanelSection>

        <PanelSection label="Booking Info" icon={<Scissors size={12} />}>
          <PanelRow
            label="Date"
            value={new Date(date + "T00:00:00").toLocaleDateString("en-PH", {
              weekday: "short",
              month: "long",
              day: "numeric",
            })}
            icon={<CalendarDays size={12} />}
          />
          <PanelRow
            label="Time"
            value={`${formatScheduleTime(booking.start_time)} – ${formatScheduleTime(booking.end_time)}`}
            icon={<Clock size={12} />}
          />
          <PanelRow label="Duration" value={durationLabel(booking.start_time, booking.end_time)} />
          <PanelRow label="Service" value={booking.service} />
          <PanelRow label="Assigned Staff" value={staffName} />
          {booking.resource_name && (
            <PanelRow label="Room / Bed" value={booking.resource_name} icon={<BedDouble size={12} />} />
          )}
        </PanelSection>

        <PanelSection label="Availability Check" icon={<Clock size={12} />}>
          <PanelRow label="Staff" value="Available" valueColor="#4A7C59" />
          {booking.type === "home_service" ? (
            <PanelRow label="Travel" value="Home Service — no room needed" icon={<MapPin size={12} />} />
          ) : (
            <PanelRow
              label="Room / Bed"
              value={booking.resource_name ? "Assigned" : "Not assigned"}
              valueColor={booking.resource_name ? "#4A7C59" : "#D97706"}
              icon={<BedDouble size={12} />}
            />
          )}
        </PanelSection>

        {/* Resource assignment (non-home-service) */}
        {booking.type !== "home_service" && (
          <PanelSection label="Assignment" icon={<BedDouble size={12} />}>
            <SpaceAssignment
              bookingId={booking.id}
              currentResourceId={booking.resource_id}
              branchResources={branchResources}
            />
          </PanelSection>
        )}

        {/* Actions */}
        <PanelSection label="Actions" icon={<CreditCard size={12} />}>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.5rem" }}>
              <BookingActionMenu
                bookingId={booking.id}
                currentStatus={booking.status}
                userRole={viewerRole}
                statusAction={statusAction}
                actionScope="status"
                triggerLabel="Change Status"
                triggerVariant="panelSecondary"
                fullWidth
                emptyBehavior="disabled"
              />
              <PaymentActionMenu
                bookingId={booking.id}
                paymentStatus="unpaid"
                paymentMethod="pay_on_site"
                amountPaid={0}
                pricePaid={0}
                paymentAction={paymentAction}
                triggerLabel="Take Payment"
                triggerVariant="panelSecondary"
                fullWidth
              />
            </div>

            <BookingActionMenu
              bookingId={booking.id}
              currentStatus={booking.status}
              userRole={viewerRole}
              statusAction={statusAction}
              actionScope="cancel"
              triggerLabel="Cancel Booking"
              triggerVariant="panelDanger"
              fullWidth
            />
          </div>
        </PanelSection>
      </div>
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

function SpaceAssignment({
  bookingId,
  currentResourceId,
  branchResources,
}: {
  bookingId: string;
  currentResourceId: string | null;
  branchResources: ResourceRow[];
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState(currentResourceId ?? "");
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await editBookingAction({
        bookingId,
        resourceId: selectedId || null,
      });
      if (!result.success) {
        setError(result.error ?? "Failed to assign space");
      }
    });
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8 }}>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={isPending}
          style={{
            flex: 1,
            height: 34,
            borderRadius: 6,
            border: "1px solid var(--cs-border)",
            fontSize: "0.8125rem",
            backgroundColor: "var(--cs-surface)",
            color: "var(--cs-text)",
            padding: "0 0.5rem",
          }}
        >
          <option value="">Not assigned</option>
          {branchResources.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.type.replace(/_/g, " ")})
            </option>
          ))}
        </select>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isPending || selectedId === (currentResourceId ?? "")}
          style={{
            height: 34,
            fontSize: "0.75rem",
            backgroundColor: "var(--cs-sand)",
            color: "#fff",
            border: "none",
          }}
        >
          {isPending ? "..." : "Save"}
        </Button>
      </div>
      {error && (
        <div style={{ fontSize: "0.75rem", color: "#B91C1C", marginTop: 4 }}>{error}</div>
      )}
    </div>
  );
}
