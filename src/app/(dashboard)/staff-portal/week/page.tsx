import { PageHeader } from "@/components/features/dashboard/page-header";
import { BookingStatusBadge } from "@/components/features/dashboard/booking-status-badge";
import { BookingTypeBadge } from "@/components/features/dashboard/booking-type-badge";
import { getMyWeekAction } from "../actions";
import { formatDate, formatTime } from "@/lib/utils";
import type { Database } from "@/types/supabase";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const FULL_DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];
type ServiceRow = Database["public"]["Tables"]["services"]["Row"];
type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];
type ScheduleRow = Database["public"]["Tables"]["staff_schedules"]["Row"];
type OverrideRow = Database["public"]["Tables"]["schedule_overrides"]["Row"];
type BlockedTimeRow = Database["public"]["Tables"]["blocked_times"]["Row"];
type StaffRow = Database["public"]["Tables"]["staff"]["Row"];

type OneOrMany<T> = T | T[] | null;

type WeekBooking = Pick<
  BookingRow,
  "id" | "booking_date" | "start_time" | "end_time" | "type" | "status"
> & {
  services: OneOrMany<Pick<ServiceRow, "id" | "name" | "duration_minutes">>;
  customers: OneOrMany<Pick<CustomerRow, "id" | "full_name">>;
};

type WeekResult =
  | { error: string }
  | {
      bookings: WeekBooking[];
      schedule: ScheduleRow[];
      overrides: OverrideRow[];
      blocks: BlockedTimeRow[];
      staff: Pick<StaffRow, "id" | "full_name" | "tier" | "system_role" | "branch_id">;
    };

function firstRelation<T>(relation: OneOrMany<T>): T | null {
  if (!relation) return null;
  return Array.isArray(relation) ? (relation[0] ?? null) : relation;
}

function getWeekRange(): { fromDate: string; toDate: string; days: string[] } {
  const days: string[] = [];
  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d.toISOString().split("T")[0]!);
  }

  return {
    fromDate: days[0]!,
    toDate: days[6]!,
    days,
  };
}

export default async function StaffWeekPage() {
  const { fromDate, toDate, days } = getWeekRange();
  const result = (await getMyWeekAction(fromDate, toDate)) as WeekResult;

  if ("error" in result) {
    return (
      <div
        style={{
          padding: "2rem",
          textAlign: "center",
          color: "var(--cs-text-muted)",
          fontSize: "0.875rem",
        }}
      >
        {result.error}
      </div>
    );
  }

  const { bookings, schedule, overrides } = result;
  const today = new Date().toISOString().split("T")[0]!;

  const bookingsByDate: Record<string, WeekBooking[]> = {};
  days.forEach((day) => {
    bookingsByDate[day] = [];
  });

  bookings.forEach((booking) => {
    const dayList = bookingsByDate[booking.booking_date];
    if (dayList) {
      dayList.push(booking);
    }
  });

  const scheduleByDay: Partial<Record<number, ScheduleRow>> = {};
  schedule.forEach((sch) => {
    scheduleByDay[sch.day_of_week] = sch;
  });

  const overrideByDate: Record<string, OverrideRow> = {};
  overrides.forEach((override) => {
    overrideByDate[override.override_date] = override;
  });

  return (
    <div>
      <PageHeader title="My Week" description={`${formatDate(fromDate)} — ${formatDate(toDate)}`} />

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {days.map((date) => {
          const isToday = date === today;
          const dayBookings = bookingsByDate[date] ?? [];
          const override = overrideByDate[date];
          const dayDate = new Date(`${date}T00:00:00`);
          const dayOfWeek = dayDate.getDay();
          const regularSchedule = scheduleByDay[dayOfWeek];

          let workHours: string | null = null;
          if (override) {
            workHours = override.is_day_off
              ? "Day off"
              : `${override.start_time?.substring(0, 5)} – ${override.end_time?.substring(0, 5)}`;
          } else if (regularSchedule) {
            workHours = `${regularSchedule.start_time.substring(0, 5)} – ${regularSchedule.end_time.substring(0, 5)}`;
          }

          return (
            <div
              key={date}
              style={{
                backgroundColor: "var(--cs-surface)",
                border: `1.5px solid ${isToday ? "var(--cs-sand)" : "var(--cs-border)"}`,
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "0.625rem 1rem",
                  backgroundColor: isToday ? "var(--cs-sand-lighter)" : "var(--cs-warm-white)",
                  borderBottom: "1px solid var(--cs-border)",
                  gap: "0.875rem",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    backgroundColor: isToday ? "var(--cs-sand)" : "transparent",
                    border: isToday ? "none" : "1.5px solid var(--cs-border)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.625rem",
                      fontWeight: 600,
                      color: isToday ? "#fff" : "var(--cs-text-muted)",
                      lineHeight: 1,
                    }}
                  >
                    {DAY_NAMES[dayOfWeek]}
                  </div>
                  <div
                    style={{
                      fontSize: "0.875rem",
                      fontWeight: 700,
                      color: isToday ? "#fff" : "var(--cs-text)",
                      lineHeight: 1,
                      marginTop: 1,
                    }}
                  >
                    {dayDate.getDate()}
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: "0.875rem",
                      fontWeight: isToday ? 600 : 400,
                      color: isToday ? "var(--cs-sand)" : "var(--cs-text)",
                    }}
                  >
                    {FULL_DAY_NAMES[dayOfWeek]}
                    {isToday && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: "0.6875rem",
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: 4,
                          backgroundColor: "var(--cs-sand)",
                          color: "#fff",
                        }}
                      >
                        TODAY
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
                    {workHours ?? "Not scheduled"}
                    {override?.is_day_off && (
                      <span
                        style={{
                          marginLeft: 6,
                          color: "var(--cs-manager-accent)",
                          fontSize: "0.6875rem",
                          fontWeight: 600,
                        }}
                      >
                        Override
                      </span>
                    )}
                  </div>
                </div>

                {dayBookings.length > 0 && (
                  <div
                    style={{
                      padding: "2px 10px",
                      borderRadius: 20,
                      backgroundColor: isToday ? "var(--cs-sand)" : "var(--cs-border)",
                      color: isToday ? "#fff" : "var(--cs-text-muted)",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {dayBookings.length}
                  </div>
                )}
              </div>

              {dayBookings.length === 0 ? (
                <div style={{ padding: "0.625rem 1rem", fontSize: "0.8125rem", color: "var(--cs-text-muted)" }}>
                  {workHours === "Day off" ? "Day off" : "No appointments"}
                </div>
              ) : (
                dayBookings.map((booking, i) => {
                  const customer = firstRelation(booking.customers);
                  const service = firstRelation(booking.services);
                  return (
                    <div
                      key={booking.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        padding: "0.625rem 1rem",
                        borderBottom: i < dayBookings.length - 1 ? "1px solid var(--cs-border)" : "none",
                      }}
                    >
                      <div
                        style={{
                          minWidth: 48,
                          fontSize: "0.8125rem",
                          fontWeight: 500,
                          color: "var(--cs-text)",
                          flexShrink: 0,
                        }}
                      >
                        {formatTime(booking.start_time)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: "0.875rem",
                            fontWeight: 500,
                            color: "var(--cs-text)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {customer?.full_name ?? "—"}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
                          {service?.name ?? "Service"}
                          {typeof service?.duration_minutes === "number" && (
                            <span> · {service.duration_minutes} min</span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                        <BookingTypeBadge type={booking.type} />
                        <BookingStatusBadge status={booking.status} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
