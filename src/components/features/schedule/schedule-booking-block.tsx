"use client";

import { BookingStatusBadge } from "@/components/features/dashboard/booking-status-badge";
import { BookingTypeBadge } from "@/components/features/dashboard/booking-type-badge";
import {
  getTimelineBlockPercent,
  type TimelineDisplayMode,
  type TimelineRange,
} from "@/lib/utils/schedule-timeline";
import type { DailyScheduleBooking } from "@/lib/queries/schedule";
import type { Database } from "@/types/supabase";

type ResourceRow = Database["public"]["Tables"]["branch_resources"]["Row"];

const STATUS_BG: Record<string, string> = {
  confirmed: "#E8F5E9",
  in_progress: "#EDE7F6",
  completed: "#E0F2F1",
  cancelled: "#F5F5F5",
  no_show: "#FFF3E0",
  pending: "#FFF8E1",
};

const STATUS_BORDER: Record<string, string> = {
  confirmed: "#4A7C59",
  in_progress: "#7E57C2",
  completed: "#00897B",
  cancelled: "#BDBDBD",
  no_show: "#FF9800",
  pending: "#F59E0B",
};

const STATUS_TEXT: Record<string, string> = {
  confirmed: "#1B5E20",
  in_progress: "#4527A0",
  completed: "#004D40",
  cancelled: "#616161",
  no_show: "#E65100",
  pending: "#B45309",
};

type BookingBlockProps = {
  booking: DailyScheduleBooking;
  branchResources?: ResourceRow[];
  date?: string;
  onClick?: (bookingId: string) => void;
  isSelected?: boolean;
  onHoverEnter?: (bookingId: string, x: number, y: number) => void;
  onHoverLeave?: () => void;
  timelineRange: TimelineRange;
  timelineMode: TimelineDisplayMode;
};

export function ScheduleBookingBlock({
  booking,
  onClick,
  isSelected,
  onHoverEnter,
  onHoverLeave,
  timelineRange,
  timelineMode,
}: BookingBlockProps) {
  const { leftPercent, widthPercent } = getTimelineBlockPercent(
    booking.start_time,
    booking.end_time,
    timelineRange
  );
  const isCompact = timelineMode === "fit" || widthPercent < 9;
  const showDetails = !isCompact && widthPercent >= 9;
  const showBadges = timelineMode === "expanded" && widthPercent >= 14;

  const bg = STATUS_BG[booking.status] ?? "#F5F5F5";
  const border = STATUS_BORDER[booking.status] ?? "#BDBDBD";
  const text = STATUS_TEXT[booking.status] ?? "#424242";

  return (
    <button
      type="button"
      onClick={() => onClick?.(booking.id)}
      style={{
        position: "absolute",
        left: `${leftPercent}%`,
        width: `${widthPercent}%`,
        minWidth: timelineMode === "expanded" ? 56 : undefined,
        top: 6,
        bottom: 6,
        backgroundColor: bg,
        borderTop: isSelected ? `2.5px solid var(--cs-sand)` : `1.5px solid ${border}`,
        borderRight: isSelected ? `2.5px solid var(--cs-sand)` : `1.5px solid ${border}`,
        borderBottom: isSelected ? `2.5px solid var(--cs-sand)` : `1.5px solid ${border}`,
        borderLeft: `3px solid ${border}`,
        borderRadius: 8,
        padding: isCompact ? "2px 6px 2px 5px" : "6px 8px 6px 7px",
        zIndex: isSelected ? 10 : 3,
        cursor: "pointer",
        textAlign: "left",
        overflow: "hidden",
        maxWidth: `${Math.max(0, 100 - leftPercent)}%`,
        transition: "box-shadow 150ms ease, transform 150ms ease, border-color 150ms ease",
        outline: isSelected ? `2px solid var(--cs-sand)` : "none",
        outlineOffset: 1,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 4px 12px rgba(30,25,22,0.12)";
        e.currentTarget.style.transform = "scale(1.01)";
        e.currentTarget.style.zIndex = "10";
        onHoverEnter?.(booking.id, e.clientX, e.clientY);
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.transform = "none";
        e.currentTarget.style.zIndex = isSelected ? "10" : "3";
        onHoverLeave?.();
      }}
      aria-label={`Booking: ${booking.service} for ${booking.customer}`}
      aria-pressed={isSelected}
    >
      <div
        style={{
          fontSize: isCompact ? "0.625rem" : "0.75rem",
          fontWeight: 600,
          color: text,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          lineHeight: 1.3,
        }}
      >
        {booking.service}
      </div>
      {showDetails && (
        <div
          style={{
            fontSize: "0.6875rem",
            color: "#5A4A3A",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            marginTop: 2,
            lineHeight: 1.3,
          }}
        >
          {booking.customer}
          {booking.resource_name && (
            <span
              style={{
                marginLeft: 6,
                color: text,
                fontWeight: 600,
                opacity: 0.8,
              }}
            >
              · {booking.resource_name}
            </span>
          )}
        </div>
      )}
      {showBadges && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            marginTop: 4,
          }}
        >
          <BookingStatusBadge status={booking.status} />
          {booking.type && booking.type !== "online" && (
            <BookingTypeBadge type={booking.type} />
          )}
        </div>
      )}
    </button>
  );
}
