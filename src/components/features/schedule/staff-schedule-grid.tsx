"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import {
  GRID_START_HOUR,
  GRID_END_HOUR,
  SLOT_MINUTES,
  SLOT_HEIGHT,
  getEventTopOffset,
  getEventHeight,
  formatScheduleTime,
  timeToMinutes,
} from "@/lib/utils/schedule-grid";
import type { DailyScheduleStaffRow } from "@/lib/queries/schedule";
import { BookingStatusBadge } from "@/components/features/dashboard/booking-status-badge";

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

type StaffScheduleGridProps = {
  branchId: string;
  date: string;
  staffRows: DailyScheduleStaffRow[];
};

function useScheduleRealtime(branchId: string, date: string) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const channel = supabase
      .channel(`schedule-live-${branchId}-${date}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `branch_id=eq.${branchId}`,
        },
        () => {
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [branchId, date, router]);
}

export function StaffScheduleGrid({ branchId, date, staffRows }: StaffScheduleGridProps) {
  useScheduleRealtime(branchId, date);

  const totalMinutes = (GRID_END_HOUR - GRID_START_HOUR) * 60;
  const totalSlots = totalMinutes / SLOT_MINUTES;
  const totalHeight = totalSlots * SLOT_HEIGHT;
  const timeLabels = Array.from({ length: totalSlots + 1 }, (_, i) => GRID_START_HOUR + i / 2);

  if (staffRows.length === 0) {
    return (
      <div
        className="cs-card"
        style={{
          padding: "3rem 1.5rem",
          textAlign: "center",
          color: "var(--cs-text-muted)",
          fontSize: "0.875rem",
        }}
      >
        <div style={{ fontSize: 28, marginBottom: 12 }}>🌿</div>
        <div style={{ fontWeight: 600, color: "var(--cs-text)", marginBottom: 4 }}>
          No staff scheduled
        </div>
        <div>There are no active staff members at this branch for the selected date.</div>
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }} aria-label={`Daily schedule for ${date}`}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `56px repeat(${staffRows.length}, minmax(180px, 1fr))`,
          minWidth: 56 + staffRows.length * 180,
        }}
      >
        {/* Corner cell */}
        <div
          style={{
            backgroundColor: "var(--cs-surface)",
            borderBottom: "1px solid var(--cs-border)",
            borderRight: "1px solid var(--cs-border)",
            position: "sticky",
            top: 0,
            zIndex: 5,
          }}
        />

        {/* Staff headers */}
        {staffRows.map((row) => (
          <div
            key={row.staff_id}
            style={{
              padding: "10px 12px",
              backgroundColor: "var(--cs-surface)",
              borderBottom: "1px solid var(--cs-border)",
              borderRight: "1px solid var(--cs-border)",
              position: "sticky",
              top: 0,
              zIndex: 5,
            }}
          >
            <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--cs-text)" }}>
              {row.staff_name}
            </div>
            <div style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)", marginTop: 2 }}>
              {row.staff_tier}
              {row.work_start && row.work_end
                ? ` · ${row.work_start.slice(0, 5)}–${row.work_end.slice(0, 5)}`
                : " · Off"}
            </div>
          </div>
        ))}

        {/* Time axis */}
        <div style={{ position: "relative", height: totalHeight, borderRight: "1px solid var(--cs-border)" }}>
          {timeLabels.map((row, index) => {
            const isHour = Number.isInteger(row);
            return (
              <div key={row + index}>
                <div
                  style={{
                    position: "absolute",
                    top: index * SLOT_HEIGHT,
                    right: 6,
                    fontSize: "0.6875rem",
                    color: isHour ? "var(--cs-text-muted)" : "transparent",
                    whiteSpace: "nowrap",
                    lineHeight: 1,
                    marginTop: -6,
                  }}
                >
                  {isHour ? formatScheduleTime(`${String(row).padStart(2, "0")}:00`) : "·"}
                </div>
                {isHour && (
                  <div
                    style={{
                      position: "absolute",
                      top: index * SLOT_HEIGHT,
                      left: 0,
                      right: -9999,
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

        {/* Staff columns */}
        {staffRows.map((row) => {
          const workStartMin = row.work_start ? timeToMinutes(row.work_start) : null;
          const workEndMin = row.work_end ? timeToMinutes(row.work_end) : null;

          return (
            <div
              key={row.staff_id}
              style={{
                position: "relative",
                height: totalHeight,
                borderRight: "1px solid var(--cs-border)",
              }}
            >
              {/* Slot grid lines */}
              {Array.from({ length: totalSlots }).map((_, index) => {
                const slotTimeMinutes = GRID_START_HOUR * 60 + index * SLOT_MINUTES;
                const isOutsideWork =
                  workStartMin !== null &&
                  workEndMin !== null &&
                  (slotTimeMinutes < workStartMin || slotTimeMinutes >= workEndMin);

                return (
                  <div
                    key={index}
                    style={{
                      position: "absolute",
                      top: index * SLOT_HEIGHT,
                      left: 0,
                      right: 0,
                      height: SLOT_HEIGHT,
                      borderBottom: "1px solid var(--cs-border-soft)",
                      backgroundColor: isOutsideWork ? "var(--cs-border-soft)" : undefined,
                      opacity: isOutsideWork ? 0.6 : 0.35,
                    }}
                  />
                );
              })}

              {/* Blocked times */}
              {row.blocks.map((block, bi) => {
                const top = getEventTopOffset(block.start_time);
                const height = getEventHeight(block.start_time, block.end_time);
                return (
                  <div
                    key={`block-${bi}`}
                    style={{
                      position: "absolute",
                      top: top + 2,
                      left: 4,
                      right: 4,
                      height: Math.max(height - 4, 24),
                      backgroundColor: "#F3F4F6",
                      border: "1.5px dashed #D1D5DB",
                      borderRadius: 6,
                      padding: "4px 6px",
                      zIndex: 2,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.6875rem",
                        color: "#9CA3AF",
                        fontWeight: 500,
                        textAlign: "center",
                        lineHeight: 1.3,
                      }}
                    >
                      {block.reason || "Blocked"}
                    </span>
                  </div>
                );
              })}

              {/* Bookings */}
              {row.bookings.map((booking) => {
                const top = getEventTopOffset(booking.start_time);
                const height = getEventHeight(booking.start_time, booking.end_time);
                if (top < 0 || top > totalHeight) return null;

                return (
                  <div
                    key={booking.id}
                    style={{
                      position: "absolute",
                      top: top + 2,
                      left: 4,
                      right: 4,
                      height: Math.max(height - 4, 28),
                      backgroundColor: STATUS_BG[booking.status] ?? "#F9FAFB",
                      border: `1.5px solid ${STATUS_BORDER[booking.status] ?? "#E5E7EB"}`,
                      borderRadius: 6,
                      padding: "4px 6px",
                      overflow: "hidden",
                      zIndex: 3,
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.6875rem",
                        fontWeight: 600,
                        color: "var(--cs-text)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {booking.customer}
                    </div>
                    {height > 36 && (
                      <div
                        style={{
                          fontSize: "0.6875rem",
                          color: "var(--cs-text-muted)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          marginTop: 1,
                        }}
                      >
                        {booking.service}
                      </div>
                    )}
                    {height > 56 && (
                      <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
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
