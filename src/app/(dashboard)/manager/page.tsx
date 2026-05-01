import Link from "next/link";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { StatCard } from "@/components/features/dashboard/stat-card";
import { BookingStatusBadge } from "@/components/features/dashboard/booking-status-badge";
import { BookingTypeBadge } from "@/components/features/dashboard/booking-type-badge";
import { BookingActionMenu } from "@/components/features/dashboard/booking-action-menu";
import { EmptyState } from "@/components/features/dashboard/empty-state";
import { getTodaysSchedule, getManagerDashboardStats } from "@/lib/queries/bookings";
import { getStaffByBranch } from "@/lib/queries/staff";
import { getBranchById } from "@/lib/queries/branches";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatTime } from "@/lib/utils";

async function getManagerContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("staff")
    .select("branch_id")
    .eq("auth_user_id", user.id)
    .single();

  if (!me?.branch_id) redirect("/login");
  return me.branch_id as string;
}

type Relation<T> = T | T[] | null;

type BookingRow = {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  type: string;
  travel_buffer_mins: number | null;
  staff?: Relation<{ id: string; full_name: string }>;
  services?: Relation<{ name: string; duration_minutes: number }>;
  customers?: Relation<{ full_name: string; phone: string | null }>;
};

function readRelation<T>(relation: Relation<T>): T | null {
  if (!relation) return null;
  return Array.isArray(relation) ? (relation[0] ?? null) : relation;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function detectIssues(bookings: BookingRow[]) {
  const issues: { label: string; count: number; href: string }[] = [];

  // Home service needing prep
  const homeServices = bookings.filter(
    (b) => b.type === "home_service" && b.status === "confirmed"
  );
  if (homeServices.length > 0) {
    issues.push({
      label: "Home service bookings need prep",
      count: homeServices.length,
      href: "/manager/bookings",
    });
  }

  // Unassigned staff
  const unassigned = bookings.filter(
    (b) => b.status !== "cancelled" && b.status !== "no_show" && !readRelation(b.staff)
  );
  if (unassigned.length > 0) {
    issues.push({
      label: "Bookings without assigned therapist",
      count: unassigned.length,
      href: "/manager/bookings",
    });
  }

  // Overlapping bookings per staff
  const staffBookings = new Map<string, BookingRow[]>();
  for (const b of bookings) {
    const s = readRelation(b.staff);
    if (!s) continue;
    const list = staffBookings.get(s.id) ?? [];
    list.push(b);
    staffBookings.set(s.id, list);
  }
  let overlapCount = 0;
  for (const [, list] of staffBookings) {
    const sorted = [...list].sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
    for (let i = 1; i < sorted.length; i++) {
      if (timeToMinutes(sorted[i]!.start_time) < timeToMinutes(sorted[i - 1]!.end_time)) {
        overlapCount++;
      }
    }
  }
  if (overlapCount > 0) {
    issues.push({
      label: "Overlapping schedule detected",
      count: overlapCount,
      href: "/manager/schedule",
    });
  }

  // Bookings starting soon (within 2 hours)
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const soon = bookings.filter(
    (b) =>
      b.status === "confirmed" &&
      timeToMinutes(b.start_time) > nowMins &&
      timeToMinutes(b.start_time) <= nowMins + 120
  );
  if (soon.length > 0) {
    issues.push({
      label: "Bookings starting within 2 hours",
      count: soon.length,
      href: "/manager/schedule",
    });
  }

  return issues;
}

export default async function ManagerTodayPage() {
  const branchId = await getManagerContext();
  const today = new Date().toISOString().split("T")[0]!;

  const [branch, bookingsRaw, stats, staff] = await Promise.all([
    getBranchById(branchId),
    getTodaysSchedule(branchId, today),
    getManagerDashboardStats(branchId, today),
    getStaffByBranch(branchId),
  ]);

  const bookings = bookingsRaw as BookingRow[];
  const issues = detectIssues(bookings);
  const branchName = branch?.name ?? "Your Branch";

  return (
    <div>
      {/* Workspace identity strip */}
      <div style={{
        display:      "flex",
        alignItems:   "center",
        gap:          10,
        padding:      "12px 14px",
        background:   "var(--cs-manager-bg)",
        border:       "1px solid rgba(90,122,138,0.15)",
        borderRadius: "var(--cs-r-md)",
        marginBottom: "1.25rem",
      }}>
        <div style={{
          width:          36,
          height:         36,
          borderRadius:   "var(--cs-r-sm)",
          background:     "rgba(90,122,138,0.15)",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          fontSize:       18,
          flexShrink:     0,
        }}>
          ▸
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--cs-manager-text)" }}>
            Operations Dashboard — {branchName}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--cs-text-muted)" }}>
            {new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" })} · Daily operations, live bookings, and branch activity
          </div>
        </div>
      </div>

      <PageHeader
        title={`Today — ${branchName}`}
        description={`${new Date().toLocaleDateString("en-PH", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })} · Daily operations, live bookings, and branch activity`}
      />

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
          gap: "0.625rem",
          marginBottom: "1.5rem",
        }}
      >
        <StatCard label="Bookings" value={stats.total} accent />
        <StatCard label="Confirmed" value={stats.confirmed} />
        <StatCard label="In Progress" value={stats.in_progress} />
        <StatCard label="Home Service" value={bookings.filter((b) => b.type === "home_service").length} />
        <StatCard label="Completed" value={stats.completed} accent />
        <StatCard label="Cancelled / No-Show" value={stats.cancelled + stats.no_show} />
      </div>

      {/* Two-column layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: "1.25rem",
          alignItems: "start",
        }}
      >
        {/* Left: Bookings */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: "0.875rem",
            }}
          >
            <span style={{ fontSize: 16 }}>🕐</span>
            <div
              style={{
                fontSize: "0.9375rem",
                fontWeight: 600,
                color: "var(--cs-text)",
                fontFamily: "var(--font-display)",
              }}
            >
              Today&apos;s Bookings
            </div>
            <span
              style={{
                marginLeft: "auto",
                fontSize: "0.75rem",
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: "var(--cs-r-pill)",
                backgroundColor: "var(--cs-sand-mist)",
                color: "var(--cs-sand)",
              }}
            >
              {bookings.length} total
            </span>
          </div>

          {bookings.length === 0 ? (
            <EmptyState
              title="No bookings today"
              description="There are no appointments scheduled for today."
              icon="🌿"
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              {bookings.map((booking) => {
                const customer = readRelation(booking.customers);
                const service = readRelation(booking.services);
                const staffMember = readRelation(booking.staff);

                return (
                  <div
                    key={booking.id}
                    className="cs-card"
                    style={{
                      padding: "0.875rem 1rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.875rem",
                    }}
                  >
                    <div
                      style={{
                        minWidth: 56,
                        flexShrink: 0,
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "0.9375rem",
                          fontWeight: 700,
                          color: "var(--cs-text)",
                          lineHeight: 1,
                        }}
                      >
                        {formatTime(booking.start_time).replace(" ", "")}
                      </div>
                      <div style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)", marginTop: 2 }}>
                        {service?.duration_minutes ?? "—"} min
                      </div>
                    </div>

                    <div
                      style={{
                        width: 3,
                        alignSelf: "stretch",
                        borderRadius: 2,
                        backgroundColor:
                          booking.status === "in_progress"
                            ? "var(--cs-sand)"
                            : booking.status === "completed"
                            ? "var(--cs-success)"
                            : booking.status === "cancelled" || booking.status === "no_show"
                            ? "var(--cs-error)"
                            : "var(--cs-border)",
                      }}
                    />

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
                      <div
                        style={{
                          fontSize: "0.8125rem",
                          color: "var(--cs-text-muted)",
                          marginTop: 2,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {service?.name ?? "Service"}
                        {staffMember && (
                          <span style={{ marginLeft: 6 }}>· {staffMember.full_name}</span>
                        )}
                        {!staffMember && (
                          <span style={{ marginLeft: 6, color: "var(--cs-error)" }}>· Unassigned</span>
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        flexShrink: 0,
                      }}
                    >
                      <BookingTypeBadge type={booking.type} />
                      <BookingStatusBadge status={booking.status} />
                      <BookingActionMenu bookingId={booking.id} currentStatus={booking.status} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Issues + Quick Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Issues */}
          <div className="cs-card" style={{ padding: "1.25rem" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: "0.875rem",
              }}
            >
              <span style={{ fontSize: 16 }}>⚡</span>
              <div
                style={{
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  color: "var(--cs-text)",
                  fontFamily: "var(--font-display)",
                }}
              >
                Needs Attention
              </div>
            </div>

            {issues.length === 0 ? (
              <div
                style={{
                  padding: "1.5rem 0.5rem",
                  textAlign: "center",
                  color: "var(--cs-text-muted)",
                  fontSize: "0.875rem",
                }}
              >
                <div style={{ fontSize: 24, marginBottom: 8 }}>✅</div>
                No urgent issues right now
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {issues.map((issue) => (
                  <Link
                    key={issue.label}
                    href={issue.href}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.625rem 0.75rem",
                      borderRadius: "var(--cs-r-sm)",
                      backgroundColor: "var(--cs-sand-mist)",
                      textDecoration: "none",
                      color: "var(--cs-text)",
                      fontSize: "0.8125rem",
                    }}
                  >
                    <span>{issue.label}</span>
                    <span
                      style={{
                        fontWeight: 700,
                        color: "var(--cs-sand)",
                        minWidth: 20,
                        textAlign: "center",
                      }}
                    >
                      {issue.count}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="cs-card" style={{ padding: "1.25rem" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: "0.875rem",
              }}
            >
              <span style={{ fontSize: 16 }}>🚀</span>
              <div
                style={{
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  color: "var(--cs-text)",
                  fontFamily: "var(--font-display)",
                }}
              >
                Quick Actions
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              {[
                { icon: "📋", label: "View all bookings", href: "/manager/bookings" },
                { icon: "👥", label: "Manage staff schedule", href: "/manager/staff" },
                { icon: "🗓️", label: "View schedule timeline", href: "/manager/schedule" },
              ].map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "0.625rem 0.5rem",
                    borderRadius: "var(--cs-r-sm)",
                    textDecoration: "none",
                    color: "var(--cs-text-secondary)",
                    fontSize: "0.8125rem",
                    transition: "var(--cs-trans)",
                  }}

                >
                  <span>{action.icon}</span>
                  {action.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Staff on duty */}
          <div className="cs-card" style={{ padding: "1.25rem" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: "0.875rem",
              }}
            >
              <span style={{ fontSize: 16 }}>👥</span>
              <div
                style={{
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  color: "var(--cs-text)",
                  fontFamily: "var(--font-display)",
                }}
              >
                Staff on Duty
              </div>
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: "var(--cs-r-pill)",
                  backgroundColor: "var(--cs-success-bg)",
                  color: "var(--cs-success)",
                }}
              >
                {staff.length} active
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {staff.slice(0, 6).map((s) => (
                <div
                  key={s.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: "0.8125rem",
                    color: "var(--cs-text-secondary)",
                  }}
                >
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      backgroundColor: "var(--cs-border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: 600,
                      color: "var(--cs-text-muted)",
                      flexShrink: 0,
                    }}
                  >
                    {s.full_name.charAt(0)}
                  </div>
                  <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {s.full_name}
                  </span>
                  <span style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)", flexShrink: 0 }}>
                    {s.tier}
                  </span>
                </div>
              ))}
              {staff.length > 6 && (
                <Link
                  href="/manager/staff"
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--cs-sand)",
                    textDecoration: "none",
                    paddingTop: 4,
                  }}
                >
                  +{staff.length - 6} more →
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

