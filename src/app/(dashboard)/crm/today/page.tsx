import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { StatCard } from "@/components/features/dashboard/stat-card";
import { createClient } from "@/lib/supabase/server";
import { getTodaysSchedule, getDailyPaymentSummary, getManagerDashboardStats } from "@/lib/queries/bookings";
import { isDevAuthBypassEnabled, getDevBypassLayoutStaff } from "@/lib/dev-bypass";
import { CrmBookingQueuePanel } from "./crm-booking-queue-panel";

type Relation<T> = T | T[] | null;
type CustomerRel = { full_name: string; phone: string | null };
type ServiceRel  = { name: string; duration_minutes: number };
type StaffRel    = { full_name: string };
type ResourceRel = { name: string };

type BookingRow = {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  type: string;
  travel_buffer_mins: number | null;
  payment_status?: string;
  payment_method?: string;
  amount_paid?: number;
  customers: Relation<CustomerRel>;
  services:  Relation<ServiceRel>;
  staff:     Relation<StaffRel>;
  branch_resources: Relation<ResourceRel>;
};

function first<T>(v: Relation<T>): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function toMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const hr = h ?? 0;
  const ampm = hr >= 12 ? "PM" : "AM";
  const display = hr % 12 === 0 ? 12 : hr % 12;
  return `${display}:${String(m ?? 0).padStart(2, "0")}${ampm}`;
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
    return { branchId: mock.branch_id, branchName: mock.branches.name, role: mock.system_role };
  }

  if (!me || !allowedRoles.includes(me.system_role) || !me.branch_id) redirect("/login");

  return {
    branchId:   me.branch_id as string,
    branchName: (me.branches as { name: string } | null)?.name ?? "Your Branch",
    role:       me.system_role,
  };
}

export default async function CrmTodayPage() {
  const { branchId, branchName, role } = await getCsrContext();
  const today   = new Date().toISOString().split("T")[0]!;
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes();

  const [rawBookings, stats, paymentSummary] = await Promise.all([
    getTodaysSchedule(branchId, today),
    getManagerDashboardStats(branchId, today),
    getDailyPaymentSummary(branchId, today).catch(() => null),
  ]);

  const bookings = rawBookings as BookingRow[];

  // Map to normalized card data for the client component
  const queueData = bookings.map((b) => ({
    id:               b.id,
    start_time:       b.start_time,
    end_time:         b.end_time,
    status:           b.status,
    type:             b.type,
    travel_buffer_mins: b.travel_buffer_mins,
    payment_status:   b.payment_status,
    payment_method:   b.payment_method,
    amount_paid:      b.amount_paid,
    customer_name:    first(b.customers)?.full_name ?? null,
    service_name:     first(b.services)?.name ?? null,
    service_duration: first(b.services)?.duration_minutes ?? null,
    staff_name:       first(b.staff)?.full_name ?? null,
    resource_name:    first(b.branch_resources)?.name ?? null,
  }));

  const upcoming = bookings.filter(
    (b) => b.status === "confirmed" && toMins(b.start_time) > nowMins
  );
  const inProgress    = bookings.filter((b) => b.status === "in_progress");
  const homeServices  = bookings.filter((b) => b.type === "home_service" && b.status !== "cancelled" && b.status !== "no_show");
  const completed     = bookings.filter((b) => b.status === "completed");
  const cancelledNS   = bookings.filter((b) => b.status === "cancelled" || b.status === "no_show");

  const nextAppt = [...upcoming].sort(
    (a, b) => toMins(a.start_time) - toMins(b.start_time)
  )[0];

  const unpaidCount = paymentSummary?.unpaid_count ?? 0;

  return (
    <div>
      <PageHeader
        title="Today"
        description={`${branchName} · ${new Date().toLocaleDateString("en-PH", {
          weekday: "long", month: "long", day: "numeric",
        })} · Daily front-desk operations`}
        icon="🌅"
      />

      {/* Quick Actions */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <Link
          href="/crm/bookings/new"
          style={{
            padding: "8px 16px", borderRadius: 8,
            backgroundColor: "var(--cs-sand)", color: "#fff",
            fontSize: "0.8125rem", fontWeight: 500, textDecoration: "none",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}
        >
          <span>➕</span> New In-House Booking
        </Link>
        {["Search Customer:/crm/customers:🔍", "Schedule:/crm/schedule:📅", "All Bookings:/crm/bookings:📋"].map((s) => {
          const [label, href, icon] = s.split(":");
          return (
            <Link
              key={href}
              href={href!}
              style={{
                padding: "8px 16px", borderRadius: 8,
                border: "1px solid var(--cs-border)",
                backgroundColor: "var(--cs-surface)", color: "var(--cs-text)",
                fontSize: "0.8125rem", fontWeight: 500, textDecoration: "none",
                display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              <span>{icon}</span> {label}
            </Link>
          );
        })}
      </div>

      {/* KPI Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
          gap: "0.625rem",
          marginBottom: "1.5rem",
        }}
      >
        <StatCard label="Total"       value={stats.total}        accent />
        <StatCard label="Upcoming"    value={upcoming.length} />
        <StatCard label="In Progress" value={inProgress.length} />
        <StatCard label="Completed"   value={completed.length} />
        <StatCard label="Home Service" value={homeServices.length} />
        <StatCard label="Cancelled"   value={cancelledNS.length} />
        {paymentSummary && (
          <>
            <StatCard label="Expected (₱)"   value={`₱${paymentSummary.total_expected.toLocaleString()}`} />
            <StatCard label="Collected (₱)"  value={`₱${paymentSummary.total_collected.toLocaleString()}`} accent />
            <StatCard label="Unpaid"          value={unpaidCount} />
          </>
        )}
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
        {/* Left: Booking Queue */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Next Appointment Banner */}
          {nextAppt && (
            <div
              className="cs-card"
              style={{ padding: "1rem 1.25rem", borderLeft: "3px solid var(--cs-sand)" }}
            >
              <div
                style={{
                  fontSize: "0.6875rem", fontWeight: 600,
                  color: "var(--cs-sand)", textTransform: "uppercase",
                  letterSpacing: "0.06em", marginBottom: 8,
                }}
              >
                Next Appointment
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
                <div style={{ minWidth: 56, textAlign: "center" }}>
                  <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--cs-text)", lineHeight: 1 }}>
                    {formatTime(nextAppt.start_time)}
                  </div>
                  <div style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)" }}>
                    {first(nextAppt.services)?.duration_minutes ?? "—"} min
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--cs-text)" }}>
                    {first(nextAppt.customers)?.full_name ?? "—"}
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)" }}>
                    {first(nextAppt.services)?.name ?? "Service"} · {first(nextAppt.staff)?.full_name ?? "Unassigned"}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: "0.6875rem", fontWeight: 700, padding: "3px 8px",
                    borderRadius: 12, backgroundColor: "var(--cs-sand-mist)", color: "var(--cs-sand)",
                    flexShrink: 0,
                  }}
                >
                  {nextAppt.type === "home_service" ? "🏠 Home" : nextAppt.type === "walk_in" ? "Walk-in" : "Online"}
                </span>
              </div>
            </div>
          )}

          {/* Interactive Queue with tabs */}
          <div>
            <div
              style={{
                display: "flex", alignItems: "center", gap: 8, marginBottom: "0.875rem",
              }}
            >
              <span style={{ fontSize: 16 }}>🕐</span>
              <div
                style={{
                  fontSize: "0.9375rem", fontWeight: 600,
                  color: "var(--cs-text)", fontFamily: "var(--font-display)",
                }}
              >
                Today&apos;s Booking Queue
              </div>
            </div>

            <CrmBookingQueuePanel
              bookings={queueData}
              nextApptId={nextAppt?.id}
            />
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Day Progress */}
          <div className="cs-card" style={{ padding: "1.25rem" }}>
            <div
              style={{
                display: "flex", alignItems: "center", gap: 8, marginBottom: "0.875rem",
              }}
            >
              <span style={{ fontSize: 16 }}>✅</span>
              <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--cs-text)", fontFamily: "var(--font-display)" }}>
                Day Progress
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {[
                { label: "Completed",         value: completed.length,   color: "var(--cs-success)" },
                { label: "In Progress",        value: inProgress.length,  color: "var(--cs-sand)" },
                { label: "Upcoming",           value: upcoming.length,    color: "var(--cs-info)" },
                { label: "Cancelled / No-show", value: cancelledNS.length, color: "var(--cs-error)" },
              ].map((row) => (
                <div
                  key={row.label}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "0.5rem 0.75rem", borderRadius: "var(--cs-r-sm)",
                    backgroundColor: "var(--cs-surface-warm)",
                  }}
                >
                  <span style={{ fontSize: "0.8125rem", color: "var(--cs-text-secondary)" }}>
                    {row.label}
                  </span>
                  <span style={{ fontSize: "0.875rem", fontWeight: 700, color: row.color, minWidth: 20, textAlign: "center" }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Summary */}
          {paymentSummary && (
            <div className="cs-card" style={{ padding: "1.25rem" }}>
              <div
                style={{
                  display: "flex", alignItems: "center", gap: 8, marginBottom: "0.875rem",
                }}
              >
                <span style={{ fontSize: 16 }}>💰</span>
                <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--cs-text)", fontFamily: "var(--font-display)" }}>
                  Payment Summary
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {[
                  { label: "Expected",    value: `₱${paymentSummary.total_expected.toLocaleString()}`,   color: "var(--cs-text)" },
                  { label: "Collected",   value: `₱${paymentSummary.total_collected.toLocaleString()}`,  color: "var(--cs-success)" },
                  { label: "Outstanding", value: `₱${paymentSummary.total_unpaid.toLocaleString()}`,     color: paymentSummary.total_unpaid > 0 ? "var(--cs-error)" : "var(--cs-text-muted)" },
                ].map((row) => (
                  <div
                    key={row.label}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "0.5rem 0.75rem", borderRadius: "var(--cs-r-sm)",
                      backgroundColor: "var(--cs-surface-warm)",
                    }}
                  >
                    <span style={{ fontSize: "0.8125rem", color: "var(--cs-text-secondary)" }}>{row.label}</span>
                    <span style={{ fontSize: "0.875rem", fontWeight: 700, color: row.color }}>{row.value}</span>
                  </div>
                ))}
              </div>
              {/* By-method breakdown */}
              {paymentSummary.total_collected > 0 && (
                <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid var(--cs-border)" }}>
                  <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--cs-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
                    By Method
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    {(Object.entries(paymentSummary.by_method) as [string, number][])
                      .filter(([, v]) => v > 0)
                      .map(([method, amount]) => (
                        <div key={method} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem" }}>
                          <span style={{ color: "var(--cs-text-muted)", textTransform: "capitalize" }}>
                            {method.replace(/_/g, " ")}
                          </span>
                          <span style={{ color: "var(--cs-text)", fontWeight: 500 }}>
                            ₱{amount.toLocaleString()}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Role info */}
          <div
            style={{
              padding: "0.875rem 1rem", borderRadius: "var(--cs-r-md)",
              backgroundColor: "var(--cs-csr-staff-bg)", border: "1px solid var(--cs-border-soft)",
            }}
          >
            <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--cs-csr-staff-text)", marginBottom: 4 }}>
              Role: {role === "csr_head" ? "CSR Head" : role === "owner" ? "Owner" : role === "manager" ? "Manager" : "CSR Staff"}
            </div>
            <div style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)", lineHeight: 1.5 }}>
              {role === "csr_head" || role === "owner" || role === "manager"
                ? "You can create, update, cancel, and reassign bookings."
                : "You can create and update bookings. Cancel and reassign require CSR Head approval."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
