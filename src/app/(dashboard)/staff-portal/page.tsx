import { PageHeader } from "@/components/features/dashboard/page-header";
import { BookingStatusBadge } from "@/components/features/dashboard/booking-status-badge";
import { BookingTypeBadge } from "@/components/features/dashboard/booking-type-badge";
import { StatCard } from "@/components/features/dashboard/stat-card";
import { EmptyState } from "@/components/features/dashboard/empty-state";
import { getMyTodayAction } from "./actions";
import { formatTime } from "@/lib/utils";
import { STAFF_TYPE_LABELS } from "@/constants/staff";
import type { Database } from "@/types/supabase";

type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];
type ServiceRow = Database["public"]["Tables"]["services"]["Row"];
type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];
type StaffRow = Database["public"]["Tables"]["staff"]["Row"];

type OneOrMany<T> = T | T[] | null;

type ServiceRelation = OneOrMany<Pick<ServiceRow, "id" | "name" | "duration_minutes">>;
type CustomerRelation = OneOrMany<Pick<CustomerRow, "id" | "full_name">>;

type StaffTodayBooking = Pick<
  BookingRow,
  "id" | "start_time" | "end_time" | "type" | "status"
> & {
  services: ServiceRelation;
  customers: CustomerRelation;
};

type StaffLite = Pick<StaffRow, "id" | "full_name" | "tier" | "system_role" | "staff_type" | "branch_id">;

type TodayActionResult =
  | { error: string }
  | { bookings: StaffTodayBooking[]; staff: StaffLite };

function firstRelation<T>(relation: OneOrMany<T>): T | null {
  if (!relation) return null;
  return Array.isArray(relation) ? (relation[0] ?? null) : relation;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function statusStripColor(status: string): string {
  if (status === "completed") return "var(--cs-success)";
  if (status === "in_progress") return "var(--cs-sand)";
  if (status === "cancelled" || status === "no_show") return "var(--cs-text-muted)";
  return "var(--cs-sand)";
}

function tierLabel(tier: string | null): string {
  if (tier === "senior") return "Senior";
  if (tier === "mid") return "Mid";
  if (tier === "junior") return "Amateur";
  return tier ?? "";
}

export default async function StaffTodayPage() {
  const today = new Date().toISOString().split("T")[0]!;
  const result = (await getMyTodayAction(today)) as TodayActionResult;

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

  const { bookings, staff } = result;
  const confirmed = bookings.filter((booking) => booking.status === "confirmed").length;
  const inProgress = bookings.filter((booking) => booking.status === "in_progress").length;
  const completed = bookings.filter((booking) => booking.status === "completed").length;

  return (
    <div>
      <PageHeader
        title="Today's Bookings"
        description={new Date().toLocaleDateString("en-PH", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
      />

      {/* Workspace identity strip */}
      <div style={{
        display:      "flex",
        alignItems:   "center",
        gap:          12,
        padding:      "14px 16px",
        background:   "var(--cs-staff-bg)",
        border:       "1px solid rgba(138,106,90,0.15)",
        borderLeft:   "3px solid var(--cs-staff-accent)",
        borderRadius: "var(--cs-r-md)",
        marginBottom: "1.25rem",
      }}>
        <div style={{
          width:          40,
          height:         40,
          borderRadius:   "50%",
          background:     "linear-gradient(135deg, var(--cs-staff-accent), var(--cs-sand))",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          fontSize:       16,
          fontWeight:     700,
          color:          "#fff",
          flexShrink:     0,
        }}>
          {staff.full_name.charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--cs-staff-text)" }}>
            Good {getGreeting()}, {staff.full_name.split(" ")[0]}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--cs-text-muted)" }}>
            {STAFF_TYPE_LABELS[staff.staff_type as keyof typeof STAFF_TYPE_LABELS] ?? "Staff"}
            {staff.tier && <span style={{ marginLeft: 6 }}>&middot; {tierLabel(staff.tier)}</span>}
            <span style={{ marginLeft: 6 }}>&middot; {bookings.length} appointment{bookings.length !== 1 ? "s" : ""} today</span>
          </div>
        </div>
      </div>

      {staff.staff_type === "salon_head" && (
        <div
          style={{
            padding: "0.75rem 1rem",
            marginBottom: "1.25rem",
            backgroundColor: "var(--cs-success-bg)",
            border: "1px solid var(--cs-success)",
            borderRadius: 8,
            fontSize: "0.8125rem",
            color: "var(--cs-success)",
          }}
        >
          <strong>Supervisor View</strong> &mdash; Department oversight and team scheduling tools are coming soon.
        </div>
      )}

      {bookings.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "0.625rem",
            marginBottom: "1.25rem",
          }}
        >
          <StatCard label="Upcoming" value={confirmed} accent />
          <StatCard label="In Progress" value={inProgress} />
          <StatCard label="Completed" value={completed} accent />
        </div>
      )}

      {bookings.length === 0 ? (
        <EmptyState
          title="No bookings today"
          description="You have no appointments scheduled for today. Enjoy the day!"
        />
      ) : (
        <div
          style={{
            backgroundColor: "var(--cs-surface)",
            border: "1px solid var(--cs-border)",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          {bookings.map((booking, i) => {
            const customer = firstRelation(booking.customers);
            const service = firstRelation(booking.services);
            const timeParts = formatTime(booking.start_time).split(" ");
            const timeMain = timeParts[0] ?? "";
            const timePeriod = timeParts[1] ?? "";

            return (
              <div
                key={booking.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.875rem",
                  padding: "1rem",
                  borderBottom: i < bookings.length - 1 ? "1px solid var(--cs-border)" : "none",
                  backgroundColor:
                    booking.status === "in_progress" ? "var(--cs-sand-mist)" : "transparent",
                }}
              >
                <div
                  style={{
                    minWidth: 60,
                    flexShrink: 0,
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: "1rem",
                      fontWeight: 700,
                      color: "var(--cs-text)",
                      lineHeight: 1,
                    }}
                  >
                    {timeMain}
                  </div>
                  <div
                    style={{
                      fontSize: "0.6875rem",
                      color: "var(--cs-text-muted)",
                      marginTop: 2,
                    }}
                  >
                    {timePeriod}
                  </div>
                </div>

                <div
                  style={{
                    width: 3,
                    alignSelf: "stretch",
                    borderRadius: 2,
                    backgroundColor: statusStripColor(booking.status),
                    flexShrink: 0,
                  }}
                />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.9375rem", fontWeight: 500, color: "var(--cs-text)" }}>
                    {customer?.full_name ?? "—"}
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)", marginTop: 2 }}>
                    {service?.name ?? "Service"}
                    {typeof service?.duration_minutes === "number" && (
                      <span style={{ marginLeft: 6 }}>· {service.duration_minutes} min</span>
                    )}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", marginTop: 2 }}>
                    Until {formatTime(booking.end_time)}
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                  <BookingTypeBadge type={booking.type} />
                  <BookingStatusBadge status={booking.status} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

