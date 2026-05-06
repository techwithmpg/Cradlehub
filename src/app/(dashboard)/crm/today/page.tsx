import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { StatCard } from "@/components/features/dashboard/stat-card";
import { BookingStatusBadge } from "@/components/features/dashboard/booking-status-badge";
import { BookingTypeBadge } from "@/components/features/dashboard/booking-type-badge";
import { EmptyState } from "@/components/features/dashboard/empty-state";
import { createClient } from "@/lib/supabase/server";
import { getTodaysSchedule, getManagerDashboardStats } from "@/lib/queries/bookings";
import { formatTime } from "@/lib/utils";
import { isDevAuthBypassEnabled, getDevBypassLayoutStaff } from "@/lib/dev-bypass";

type Relation<T> = T | T[] | null;

type CustomerRelation = { full_name: string; phone: string | null };
type ServiceRelation = { name: string; duration_minutes: number };
type StaffRelation = { full_name: string };

type BookingRow = {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  type: string;
  travel_buffer_mins: number | null;
  customers: Relation<CustomerRelation>;
  services: Relation<ServiceRelation>;
  staff: Relation<StaffRelation>;
  branch_resources: Relation<{ name: string }>;
};

function readRelation<T>(relation: Relation<T>): T | null {
  if (!relation) return null;
  return Array.isArray(relation) ? (relation[0] ?? null) : relation;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

async function getCsrContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("staff")
    .select("branch_id, branches(name), system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  const allowedRoles = ["owner", "manager", "crm", "csr", "csr_head", "csr_staff"];

  const devBypass = isDevAuthBypassEnabled();

  if (!me && devBypass) {
    const mock = getDevBypassLayoutStaff();
    return {
      branchId: mock.branch_id,
      branchName: mock.branches.name,
      role: mock.system_role,
    };
  }

  if (!me || !allowedRoles.includes(me.system_role) || !me.branch_id) {
    redirect("/login");
  }

  return {
    branchId: me.branch_id as string,
    branchName: (me.branches as { name: string } | null)?.name ?? "Your Branch",
    role: me.system_role,
  };
}

export default async function CrmTodayPage() {
  const { branchId, branchName, role } = await getCsrContext();
  const today = new Date().toISOString().split("T")[0]!;
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes();

  const [rawBookings, stats] = await Promise.all([
    getTodaysSchedule(branchId, today),
    getManagerDashboardStats(branchId, today),
  ]);

  const bookings = rawBookings as BookingRow[];

  // Categorize bookings
  const upcoming = bookings.filter(
    (b) => b.status === "confirmed" && timeToMinutes(b.start_time) > nowMins
  );
  const walkins = bookings.filter((b) => b.type === "walk_in");
  const homeServices = bookings.filter(
    (b) => b.type === "home_service" && b.status !== "cancelled" && b.status !== "no_show"
  );
  const cancelledNoShow = bookings.filter(
    (b) => b.status === "cancelled" || b.status === "no_show"
  );
  const inProgress = bookings.filter((b) => b.status === "in_progress");
  const completed = bookings.filter((b) => b.status === "completed");

  // Next appointment
  const nextAppt = upcoming.sort(
    (a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time)
  )[0];

  // Active queue = confirmed + in_progress, sorted by time
  const activeQueue = bookings
    .filter((b) => b.status === "confirmed" || b.status === "in_progress")
    .sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));

  return (
    <div>
      <PageHeader
        title="Today"
        description={`${branchName} · ${new Date().toLocaleDateString("en-PH", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })} · Daily front-desk operations`}
        icon="🌅"
      />

      {/* Quick Actions */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/crm/bookings/new"
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            backgroundColor: "var(--cs-sand)",
            color: "#fff",
            fontSize: "0.8125rem",
            fontWeight: 500,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>➕</span> New In-House Booking
        </Link>
        <Link
          href="/crm/customers"
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid var(--cs-border)",
            backgroundColor: "var(--cs-surface)",
            color: "var(--cs-text)",
            fontSize: "0.8125rem",
            fontWeight: 500,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>🔍</span> Search Customer
        </Link>
        <Link
          href="/crm/schedule"
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid var(--cs-border)",
            backgroundColor: "var(--cs-surface)",
            color: "var(--cs-text)",
            fontSize: "0.8125rem",
            fontWeight: 500,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>📅</span> View Schedule
        </Link>
      </div>

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
        <StatCard label="Upcoming" value={upcoming.length} />
        <StatCard label="In Progress" value={inProgress.length} />
        <StatCard label="Walk-ins" value={walkins.length} />
        <StatCard label="Home Service" value={homeServices.length} />
        <StatCard label="Cancelled" value={cancelledNoShow.length} />
      </div>

      {/* Two-column layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 340px",
          gap: "1.25rem",
          alignItems: "start",
        }}
      >
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Next Appointment */}
          {nextAppt && (
            <div
              className="cs-card"
              style={{
                padding: "1rem 1.25rem",
                borderLeft: "3px solid var(--cs-sand)",
              }}
            >
              <div
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  color: "var(--cs-sand)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 8,
                }}
              >
                Next Appointment
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.875rem",
                }}
              >
                <div style={{ minWidth: 56, textAlign: "center" }}>
                  <div
                    style={{
                      fontSize: "1.125rem",
                      fontWeight: 700,
                      color: "var(--cs-text)",
                      lineHeight: 1,
                    }}
                  >
                    {formatTime(nextAppt.start_time).replace(" ", "")}
                  </div>
                  <div style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)" }}>
                    {readRelation(nextAppt.services)?.duration_minutes ?? "—"} min
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "0.9375rem",
                      fontWeight: 600,
                      color: "var(--cs-text)",
                    }}
                  >
                    {readRelation(nextAppt.customers)?.full_name ?? "—"}
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)" }}>
                    {readRelation(nextAppt.services)?.name ?? "Service"}
                    {" · "}
                    {readRelation(nextAppt.staff)?.full_name ?? "Unassigned"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <BookingTypeBadge type={nextAppt.type} />
                  <BookingStatusBadge status={nextAppt.status} />
                </div>
              </div>
            </div>
          )}

          {/* Today's Booking Queue */}
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
                Today&apos;s Booking Queue
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
                {activeQueue.length} active
              </span>
            </div>

            {activeQueue.length === 0 ? (
              <EmptyState
                title="No active bookings"
                description="There are no confirmed or in-progress appointments for today."
                icon="🌿"
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {activeQueue.map((booking) => {
                  const customer = readRelation(booking.customers);
                  const service = readRelation(booking.services);
                  const staffMember = readRelation(booking.staff);
                  const isNext = nextAppt?.id === booking.id;

                  return (
                    <Link
                      key={booking.id}
                      href={`/crm/bookings?highlight=${booking.id}`}
                      className="cs-card"
                      style={{
                        padding: "0.75rem 1rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.875rem",
                        textDecoration: "none",
                        color: "inherit",
                        borderLeft: isNext ? "3px solid var(--cs-sand)" : "3px solid transparent",
                      }}
                    >
                      <div style={{ minWidth: 56, textAlign: "center", flexShrink: 0 }}>
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
                        <div style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)" }}>
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
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {service?.name ?? "Service"}
                          {staffMember && (
                            <span style={{ marginLeft: 6 }}>· {staffMember.full_name}</span>
                          )}
                          {readRelation(booking.branch_resources) && (
                            <span style={{ marginLeft: 6, color: "var(--cs-sand)", fontWeight: 500 }}>
                              · {readRelation(booking.branch_resources)!.name}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <BookingTypeBadge type={booking.type} />
                        <BookingStatusBadge status={booking.status} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Home Service Bookings */}
          {homeServices.length > 0 && (
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: "0.875rem",
                }}
              >
                <span style={{ fontSize: 16 }}>🏠</span>
                <div
                  style={{
                    fontSize: "0.9375rem",
                    fontWeight: 600,
                    color: "var(--cs-text)",
                    fontFamily: "var(--font-display)",
                  }}
                >
                  Home Service Bookings
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {homeServices.map((booking) => {
                  const customer = readRelation(booking.customers);
                  const service = readRelation(booking.services);
                  const staffMember = readRelation(booking.staff);

                  return (
                    <div
                      key={booking.id}
                      className="cs-card"
                      style={{
                        padding: "0.75rem 1rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.875rem",
                      }}
                    >
                      <div style={{ minWidth: 56, textAlign: "center", flexShrink: 0 }}>
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
                        <div style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)" }}>
                          +{booking.travel_buffer_mins ?? 30}min travel
                        </div>
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
                        <div
                          style={{
                            fontSize: "0.8125rem",
                            color: "var(--cs-text-muted)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {service?.name ?? "Service"}
                          {staffMember && (
                            <span style={{ marginLeft: 6 }}>· {staffMember.full_name}</span>
                          )}
                          {readRelation(booking.branch_resources) && (
                            <span style={{ marginLeft: 6, color: "var(--cs-sand)", fontWeight: 500 }}>
                              · {readRelation(booking.branch_resources)!.name}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <BookingTypeBadge type={booking.type} />
                        <BookingStatusBadge status={booking.status} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Completed summary */}
          <div className="cs-card" style={{ padding: "1.25rem" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: "0.875rem",
              }}
            >
              <span style={{ fontSize: 16 }}>✅</span>
              <div
                style={{
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  color: "var(--cs-text)",
                  fontFamily: "var(--font-display)",
                }}
              >
                Day Progress
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {[
                { label: "Completed", value: completed.length, color: "var(--cs-success)" },
                { label: "In Progress", value: inProgress.length, color: "var(--cs-sand)" },
                { label: "Upcoming", value: upcoming.length, color: "var(--cs-info)" },
                { label: "Cancelled / No-show", value: cancelledNoShow.length, color: "var(--cs-error)" },
              ].map((row) => (
                <div
                  key={row.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "var(--cs-r-sm)",
                    backgroundColor: "var(--cs-surface-warm)",
                  }}
                >
                  <span style={{ fontSize: "0.8125rem", color: "var(--cs-text-secondary)" }}>
                    {row.label}
                  </span>
                  <span
                    style={{
                      fontSize: "0.875rem",
                      fontWeight: 700,
                      color: row.color,
                      minWidth: 20,
                      textAlign: "center",
                    }}
                  >
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div className="cs-card" style={{ padding: "1.25rem" }}>
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "var(--cs-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "0.75rem",
              }}
            >
              Quick Links
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              {[
                { icon: "📋", label: "All bookings", href: "/crm/bookings" },
                { icon: "👤", label: "All customers", href: "/crm/customers" },
                { icon: "📅", label: "Schedule", href: "/crm/schedule" },
                { icon: "➕", label: "New booking", href: "/crm/bookings/new" },
              ].map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
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
                  <span>{link.icon}</span>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Role info */}
          <div
            style={{
              padding: "0.875rem 1rem",
              borderRadius: "var(--cs-r-md)",
              backgroundColor: "var(--cs-csr-staff-bg)",
              border: "1px solid var(--cs-border-soft)",
            }}
          >
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "var(--cs-csr-staff-text)",
                marginBottom: 4,
              }}
            >
              Role: {role === "csr_head" ? "CSR Head" : "CSR Staff"}
            </div>
            <div style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)", lineHeight: 1.5 }}>
              {role === "csr_head"
                ? "You can create, update, cancel, and reassign bookings."
                : "You can create and update bookings. Cancel and reassign require CSR Head approval."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
