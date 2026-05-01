"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BookingStatusBadge } from "@/components/features/dashboard/booking-status-badge";
import { BookingTypeBadge } from "@/components/features/dashboard/booking-type-badge";
import {
  getTimelineOffsetPx,
  getTimelineWidthPx,
  formatScheduleTime,
} from "@/lib/utils/schedule-timeline";
import type { DailyScheduleBooking } from "@/lib/queries/schedule";

const STATUS_BG: Record<string, string> = {
  confirmed: "#E8F5E9",
  in_progress: "#EDE7F6",
  completed: "#E0F2F1",
  cancelled: "#F5F5F5",
  no_show: "#FFF3E0",
};

const STATUS_BORDER: Record<string, string> = {
  confirmed: "#4A7C59",
  in_progress: "#7E57C2",
  completed: "#00897B",
  cancelled: "#BDBDBD",
  no_show: "#FF9800",
};

const STATUS_TEXT: Record<string, string> = {
  confirmed: "#1B5E20",
  in_progress: "#4527A0",
  completed: "#004D40",
  cancelled: "#616161",
  no_show: "#E65100",
};

type BookingBlockProps = {
  booking: DailyScheduleBooking;
};

export function ScheduleBookingBlock({ booking }: BookingBlockProps) {
  const [open, setOpen] = useState(false);
  const left = getTimelineOffsetPx(booking.start_time);
  const width = getTimelineWidthPx(booking.start_time, booking.end_time);
  const minWidth = 56;
  const effectiveWidth = Math.max(width, minWidth);
  const isCompact = effectiveWidth < 120;

  const bg = STATUS_BG[booking.status] ?? "#F5F5F5";
  const border = STATUS_BORDER[booking.status] ?? "#BDBDBD";
  const text = STATUS_TEXT[booking.status] ?? "#424242";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          position: "absolute",
          left,
          width: effectiveWidth,
          top: 6,
          bottom: 6,
          backgroundColor: bg,
          border: `1.5px solid ${border}`,
          borderRadius: 8,
          padding: isCompact ? "2px 6px" : "6px 8px",
          zIndex: 3,
          cursor: "pointer",
          textAlign: "left",
          overflow: "hidden",
          transition: "box-shadow 150ms ease, transform 150ms ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = "0 4px 12px rgba(30,25,22,0.12)";
          e.currentTarget.style.transform = "scale(1.01)";
          e.currentTarget.style.zIndex = "10";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = "none";
          e.currentTarget.style.transform = "none";
          e.currentTarget.style.zIndex = "3";
        }}
        aria-label={`Booking: ${booking.service} for ${booking.customer}`}
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
        {!isCompact && (
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
          </div>
        )}
        {!isCompact && effectiveWidth >= 180 && (
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
              <span
                style={{
                  fontSize: "0.625rem",
                  color: "var(--cs-text-subtle)",
                  textTransform: "capitalize",
                }}
              >
                {booking.type.replace("_", " ")}
              </span>
            )}
          </div>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          style={{ maxWidth: 420, borderRadius: "var(--cs-r-lg)" }}
        >
          <DialogHeader>
            <DialogTitle
              style={{
                fontFamily: "var(--font-playfair)",
                fontSize: "1.125rem",
                color: "var(--cs-text)",
              }}
            >
              Booking Details
            </DialogTitle>
          </DialogHeader>

          <div style={{ display: "grid", gap: "0.875rem", paddingTop: 4 }}>
            <div>
              <div
                style={{
                  fontSize: "0.6875rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--cs-text-muted)",
                  marginBottom: 4,
                }}
              >
                Service
              </div>
              <div
                style={{
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  color: "var(--cs-text)",
                }}
              >
                {booking.service}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: "0.6875rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--cs-text-muted)",
                  marginBottom: 4,
                }}
              >
                Customer
              </div>
              <div
                style={{
                  fontSize: "0.9375rem",
                  fontWeight: 500,
                  color: "var(--cs-text)",
                }}
              >
                {booking.customer}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "0.6875rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--cs-text-muted)",
                    marginBottom: 4,
                  }}
                >
                  Time
                </div>
                <div
                  style={{
                    fontSize: "0.875rem",
                    color: "var(--cs-text)",
                  }}
                >
                  {formatScheduleTime(booking.start_time)} –{" "}
                  {formatScheduleTime(booking.end_time)}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: "0.6875rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--cs-text-muted)",
                    marginBottom: 4,
                  }}
                >
                  Type
                </div>
                <div>
                  <BookingTypeBadge type={booking.type ?? "online"} />
                </div>
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: "0.6875rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--cs-text-muted)",
                  marginBottom: 4,
                }}
              >
                Status
              </div>
              <div>
                <BookingStatusBadge status={booking.status} />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
