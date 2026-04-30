"use client";

import { BookingStatusBadge } from "./booking-status-badge";
import { BookingActionMenu } from "./booking-action-menu";

const STATUS_BG: Record<string, string> = {
  confirmed: "#EFF6FF",
  in_progress: "#F5F3FF",
  completed: "#F0FDF4",
  cancelled: "#F9FAFB",
  no_show: "#FFF7ED",
};

const STATUS_BORDER: Record<string, string> = {
  confirmed: "#BFDBFE",
  in_progress: "#DDD6FE",
  completed: "#BBF7D0",
  cancelled: "#E5E7EB",
  no_show: "#FED7AA",
};

const SLOT_HEIGHT = 56;
const START_HOUR = 8;
const END_HOUR = 21;
const MINUTES_PER_SLOT = 30;

type Relation<T> = T | T[] | null;

type BookingStaff = {
  id: string;
  full_name: string;
  tier?: string;
};

type BookingService = {
  id: string;
  name: string;
  duration_minutes: number;
};

type BookingCustomer = {
  id: string;
  full_name: string;
  phone?: string | null;
};

export type TimelineBooking = {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  type: string;
  staff_id?: string;
  staff?: Relation<BookingStaff>;
  services?: Relation<BookingService>;
  customers?: Relation<BookingCustomer>;
};

export type TimelineStaffMember = {
  id: string;
  full_name: string;
  tier: string;
};

function firstRelation<T>(value: Relation<T> | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map((value) => Number(value));
  return (h ?? 0) * 60 + (m ?? 0);
}

function minutesToPixels(minutes: number): number {
  const offsetFromStart = minutes - START_HOUR * 60;
  return (offsetFromStart / MINUTES_PER_SLOT) * SLOT_HEIGHT;
}

function getDurationPixels(startTime: string, endTime: string): number {
  const minutes = timeToMinutes(endTime) - timeToMinutes(startTime);
  return (minutes / MINUTES_PER_SLOT) * SLOT_HEIGHT;
}

function formatTimeLabel(hour24: number): string {
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 > 12 ? hour24 - 12 : hour24;
  return `${hour12}:00 ${period}`;
}

type ScheduleTimelineProps = {
  bookings: TimelineBooking[];
  staff: TimelineStaffMember[];
  date: string;
};

export function ScheduleTimeline({ bookings, staff, date }: ScheduleTimelineProps) {
  const totalMinutes = (END_HOUR - START_HOUR) * 60;
  const totalSlots = totalMinutes / MINUTES_PER_SLOT;
  const totalHeight = totalSlots * SLOT_HEIGHT;
  const timeRows = Array.from({ length: totalSlots + 1 }, (_, index) => START_HOUR + index / 2);

  return (
    <div style={{ overflowX: "auto" }} aria-label={`Schedule timeline for ${date}`}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `64px repeat(${staff.length}, minmax(170px, 1fr))`,
          minWidth: 64 + staff.length * 170,
        }}
      >
        <div
          style={{
            backgroundColor: "var(--cs-surface)",
            borderBottom: "1px solid var(--cs-border)",
            borderRight: "1px solid var(--cs-border)",
            padding: "8px 0",
            position: "sticky",
            top: 0,
            zIndex: 5,
          }}
        />

        {staff.map((member) => (
          <div
            key={member.id}
            style={{
              padding: "8px 12px",
              backgroundColor: "var(--cs-surface)",
              borderBottom: "1px solid var(--cs-border)",
              borderRight: "1px solid var(--cs-border)",
              position: "sticky",
              top: 0,
              zIndex: 5,
            }}
          >
            <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--cs-text)" }}>
              {member.full_name}
            </div>
            <div style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)" }}>{member.tier}</div>
          </div>
        ))}

        <div style={{ position: "relative", height: totalHeight, borderRight: "1px solid var(--cs-border)" }}>
          {timeRows.map((row, index) => {
            const isHour = Number.isInteger(row);
            return (
              <div key={row + index}>
                <div
                  style={{
                    position: "absolute",
                    top: index * SLOT_HEIGHT,
                    right: 8,
                    fontSize: "0.6875rem",
                    color: isHour ? "var(--cs-text-muted)" : "transparent",
                    whiteSpace: "nowrap",
                    lineHeight: 1,
                    marginTop: -6,
                  }}
                >
                  {isHour ? formatTimeLabel(row) : "·"}
                </div>
                {isHour && (
                  <div
                    style={{
                      position: "absolute",
                      top: index * SLOT_HEIGHT,
                      left: 0,
                      right: -999,
                      height: 1,
                      backgroundColor: "var(--cs-border)",
                      zIndex: 0,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {staff.map((member) => {
          const memberBookings = bookings.filter((booking) => {
            const staffRel = firstRelation(booking.staff);
            return staffRel?.id === member.id || booking.staff_id === member.id;
          });

          return (
            <div
              key={member.id}
              style={{
                position: "relative",
                height: totalHeight,
                borderRight: "1px solid var(--cs-border)",
              }}
            >
              {Array.from({ length: totalSlots }).map((_, index) => (
                <div
                  key={index}
                  style={{
                    position: "absolute",
                    top: index * SLOT_HEIGHT,
                    left: 0,
                    right: 0,
                    height: SLOT_HEIGHT,
                    borderBottom: "1px solid var(--cs-border)",
                    opacity: 0.4,
                  }}
                />
              ))}

              {memberBookings.map((booking) => {
                const topPixels = minutesToPixels(timeToMinutes(booking.start_time));
                const heightPixels = getDurationPixels(booking.start_time, booking.end_time);

                if (topPixels < 0 || topPixels > totalHeight) return null;

                const customer = firstRelation(booking.customers);
                const service = firstRelation(booking.services);

                return (
                  <div
                    key={booking.id}
                    style={{
                      position: "absolute",
                      top: topPixels + 2,
                      left: 4,
                      right: 4,
                      height: Math.max(heightPixels - 4, 28),
                      backgroundColor: STATUS_BG[booking.status] ?? "#F9FAFB",
                      border: `1.5px solid ${STATUS_BORDER[booking.status] ?? "#E5E7EB"}`,
                      borderRadius: 6,
                      padding: "4px 6px",
                      overflow: "hidden",
                      zIndex: 2,
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "var(--cs-text)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {customer?.full_name ?? "—"}
                    </div>
                    {heightPixels > 40 && (
                      <div
                        style={{
                          fontSize: "0.6875rem",
                          color: "var(--cs-text-muted)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {service?.name ?? "Service"}
                      </div>
                    )}
                    {heightPixels > 64 && (
                      <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                        <BookingStatusBadge status={booking.status} />
                        <BookingActionMenu bookingId={booking.id} currentStatus={booking.status} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
