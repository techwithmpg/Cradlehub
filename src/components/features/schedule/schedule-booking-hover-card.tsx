"use client";

import { Clock, CalendarDays, User, BedDouble, Scissors, CreditCard } from "lucide-react";
import { BookingStatusBadge } from "@/components/features/dashboard/booking-status-badge";
import { BookingTypeBadge } from "@/components/features/dashboard/booking-type-badge";
import { Button } from "@/components/ui/button";
import { formatScheduleTime } from "@/lib/utils/schedule-timeline";
import type { DailyScheduleBooking } from "@/lib/queries/schedule";

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

export type BookingHoverPreview = {
  booking: DailyScheduleBooking;
  staffName: string;
  date: string;
  x: number;
  y: number;
};

type ScheduleBookingHoverCardProps = {
  preview: BookingHoverPreview;
  onOpenDetails: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
};

const CARD_WIDTH = 280;

export function ScheduleBookingHoverCard({
  preview,
  onOpenDetails,
  onMouseEnter,
  onMouseLeave,
}: ScheduleBookingHoverCardProps) {
  const { booking, staffName, date, x, y } = preview;

  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const cardX = Math.min(x + 14, vw - CARD_WIDTH - 16);
  const cardY = Math.max(8, Math.min(y - 60, vh - 380));

  const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div
      role="tooltip"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: "fixed",
        left: cardX,
        top: cardY,
        width: CARD_WIDTH,
        zIndex: 9999,
        backgroundColor: "var(--cs-surface)",
        border: "1px solid var(--cs-border)",
        borderRadius: 10,
        padding: "0.875rem 1rem",
        boxShadow: "0 8px 24px rgba(30,25,22,0.15)",
        pointerEvents: "auto",
      }}
    >
      {/* ID + badges */}
      <div style={{ marginBottom: "0.625rem" }}>
        <div
          style={{
            fontSize: "0.6875rem",
            color: "var(--cs-text-muted)",
            fontFamily: "var(--font-mono, monospace)",
            marginBottom: "0.375rem",
          }}
        >
          #{booking.id.slice(0, 8).toUpperCase()}
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          <BookingStatusBadge status={booking.status} />
          <BookingTypeBadge type={booking.type ?? "online"} />
        </div>
      </div>

      {/* Info rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", marginBottom: "0.75rem" }}>
        <HoverRow icon={<User size={11} />} value={booking.customer} />
        <HoverRow icon={<CalendarDays size={11} />} value={dateLabel} />
        <HoverRow
          icon={<Clock size={11} />}
          value={`${formatScheduleTime(booking.start_time)} – ${formatScheduleTime(booking.end_time)} · ${durationLabel(booking.start_time, booking.end_time)}`}
        />
        <HoverRow icon={<Scissors size={11} />} value={booking.service} />
        <HoverRow icon={<User size={11} />} value={staffName} />
        {booking.resource_name && (
          <HoverRow icon={<BedDouble size={11} />} value={booking.resource_name} />
        )}
        {booking.payment_status && booking.payment_status !== "unpaid" && (
          <HoverRow
            icon={<CreditCard size={11} />}
            value={booking.payment_status.replace(/_/g, " ")}
          />
        )}
      </div>

      <Button
        size="sm"
        onClick={onOpenDetails}
        style={{
          width: "100%",
          height: 30,
          fontSize: "0.75rem",
          backgroundColor: "var(--cs-sand)",
          color: "#fff",
          border: "none",
        }}
      >
        View Details
      </Button>
    </div>
  );
}

function HoverRow({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
      <span style={{ color: "var(--cs-text-muted)", flexShrink: 0, marginTop: 2 }}>{icon}</span>
      <span
        style={{
          fontSize: "0.8rem",
          color: "var(--cs-text)",
          lineHeight: 1.4,
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
