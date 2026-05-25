import { redirect } from "next/navigation";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { createClient } from "@/lib/supabase/server";
import { getTodaysSchedule } from "@/lib/queries/bookings";
import { getStaffAdminName } from "@/lib/staff/display-name";
import { isDevAuthBypassEnabled, getDevBypassLayoutStaff } from "@/lib/dev-bypass";
import { getActionRequiredNotificationsAction } from "@/lib/notifications/queries";
import { getCrmTodaySnapshot } from "@/lib/queries/crm-today";
import { CrmBookingQueuePanel } from "@/components/features/crm/today/crm-booking-queue-panel";
import { TodayAttentionStrip } from "@/components/features/crm/today/today-attention-strip";
import { TodaySideRail } from "@/components/features/crm/today/today-side-rail";
import { TodayPriorityStrip } from "@/components/features/crm/today/today-priority-strip";
import { TodayStaffReadiness } from "@/components/features/crm/today/today-staff-readiness";
import { TodayDispatchSnapshot } from "@/components/features/crm/today/today-dispatch-snapshot";
import { TodayQuickActions } from "@/components/features/crm/today/today-quick-actions";
import { TodayWorkflowStrip } from "@/components/features/crm/today/today-workflow-strip";
import { TodaySystemMatchStatus } from "@/components/features/crm/today/today-system-match-status";
import { TodayEmergencyActions } from "@/components/features/crm/today/today-emergency-actions";
import { updateBookingPaymentAction } from "@/app/(dashboard)/manager/bookings/actions";
import { getCrmReadiness } from "@/lib/queries/crm-readiness";
import { TodayReadinessStrip } from "@/components/features/crm/today/today-readiness-strip";

// ── Local types ───────────────────────────────────────────────────────────────

type Relation<T> = T | T[] | null;
type CustomerRel = { full_name: string; phone: string | null };
type ServiceRel  = { name: string; duration_minutes: number };
type StaffRel    = { full_name: string; nickname?: string | null };
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

// ── Auth helper ───────────────────────────────────────────────────────────────

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

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CrmTodayPage() {
  const { branchId, branchName, role } = await getCsrContext();
  const today   = new Date().toISOString().split("T")[0]!;
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes();

  const [rawBookings, snapshot, actionNotifications, readiness] = await Promise.all([
    getTodaysSchedule(branchId, today),
    getCrmTodaySnapshot({ branchId, date: today }),
    getActionRequiredNotificationsAction(3),
    getCrmReadiness(branchId).catch(() => null),
  ]);

  const bookings = rawBookings as BookingRow[];

  // Build queue data for the interactive panel
  const queueData = bookings.map((b) => {
    const meta = (b as { metadata?: unknown }).metadata as Record<string, unknown> | null;
    const hsAddr = meta?.home_service_address as Record<string, unknown> | null;
    const dispatch = meta?.dispatch as Record<string, unknown> | null;
    const priceRaw = meta?.price_paid;
    const pricePaid = typeof priceRaw === "number" && Number.isFinite(priceRaw) ? priceRaw : 0;
    return {
      id:                    b.id,
      start_time:            b.start_time,
      end_time:              b.end_time,
      status:                b.status,
      type:                  b.type,
      travel_buffer_mins:    b.travel_buffer_mins,
      payment_status:        b.payment_status,
      payment_method:        b.payment_method,
      amount_paid:           b.amount_paid,
      price_paid:            pricePaid,
      customer_name:         first(b.customers)?.full_name ?? null,
      service_name:          first(b.services)?.name ?? null,
      service_duration:      first(b.services)?.duration_minutes ?? null,
      staff_name:            first(b.staff) ? getStaffAdminName(first(b.staff)!) : null,
      resource_name:         first(b.branch_resources)?.name ?? null,
      hs_zone:               typeof hsAddr?.zone === "string" ? hsAddr.zone : null,
      hs_address:            typeof hsAddr?.full_address === "string" ? hsAddr.full_address : null,
      hs_city:               typeof hsAddr?.city === "string" ? hsAddr.city : null,
      hs_map_url:            typeof hsAddr?.map_url === "string" ? hsAddr.map_url : null,
      dispatch_warning:      typeof dispatch?.dispatch_warning === "string" ? dispatch.dispatch_warning : null,
      needs_location_review: dispatch?.needs_location_review === true,
    };
  });

  const upcoming  = bookings.filter((b) => b.status === "confirmed" && toMins(b.start_time) > nowMins);
  const inProgBks = bookings.filter((b) => b.status === "in_progress");
  const completed = bookings.filter((b) => b.status === "completed");
  const cancelled = bookings.filter((b) => b.status === "cancelled" || b.status === "no_show");

  const nextAppt = [...upcoming].sort((a, b) => toMins(a.start_time) - toMins(b.start_time))[0];

  const roleLabel =
    role === "csr_head" ? "CSR Head"
    : role === "owner"   ? "Owner"
    : role === "manager" ? "Manager"
    : "CSR Staff";

  return (
    <div>
      <PageHeader
        title="Daily Operations Center"
        description={`${branchName} · ${new Date().toLocaleDateString("en-PH", {
          weekday: "long", month: "long", day: "numeric",
        })} · Front-desk operations`}
      />

      {/* Attention strip — shows only when there are action-required notifications */}
      <TodayAttentionStrip notifications={actionNotifications} />

      {/* Workflow guide — visual step order for the front-desk shift */}
      <TodayWorkflowStrip />

      {/* System Readiness — top issues from the readiness aggregator */}
      <TodayReadinessStrip readiness={readiness} />

      {/* ── Serve Customers ── */}
      <div style={{ marginBottom: "1.25rem" }}>
        <div
          style={{
            fontSize: "0.9375rem",
            fontWeight: 600,
            color: "var(--cs-text)",
            fontFamily: "var(--font-display)",
            marginBottom: "0.25rem",
          }}
        >
          Serve Customers
        </div>
        <div
          style={{
            fontSize: "0.8125rem",
            color: "var(--cs-text-muted)",
            marginBottom: "0.75rem",
          }}
        >
          Create walk-ins, start home-service bookings, review online requests, and search customers.
        </div>
        <TodayQuickActions />
      </div>

      {/* ── Today's Operational Snapshot ── */}
      <div style={{ marginBottom: "1.25rem" }}>
        <div
          style={{
            fontSize: "0.9375rem",
            fontWeight: 600,
            color: "var(--cs-text)",
            fontFamily: "var(--font-display)",
            marginBottom: "0.25rem",
          }}
        >
          Today&apos;s Operational Snapshot
        </div>
        <div
          style={{
            fontSize: "0.8125rem",
            color: "var(--cs-text-muted)",
            marginBottom: "0.75rem",
          }}
        >
          A quick view of bookings, assignments, payments, dispatch, and urgent actions.
        </div>
        <TodayPriorityStrip
          bookingSummary={snapshot.bookingSummary}
          staffReadiness={snapshot.staffReadiness}
          dispatchStats={snapshot.dispatchStats}
          payment={snapshot.payment}
          urgentCount={actionNotifications.length}
        />
      </div>

      {/* Main two-column layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: "1.25rem",
          alignItems: "start",
        }}
      >
        {/* ── Left column: booking queue + system cards ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          {/* Next appointment banner */}
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
                    {first(nextAppt.services)?.name ?? "Service"}
                    {" · "}
                    {first(nextAppt.staff) ? getStaffAdminName(first(nextAppt.staff)!) : "Unassigned"}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: "0.6875rem", fontWeight: 700, padding: "3px 8px",
                    borderRadius: 12, backgroundColor: "var(--cs-sand-mist)", color: "var(--cs-sand)",
                    flexShrink: 0,
                  }}
                >
                  {nextAppt.type === "home_service" ? "Home" : nextAppt.type === "walk_in" ? "Walk-in" : "Online"}
                </span>
              </div>
            </div>
          )}

          {/* Booking queue */}
          <div>
            <div
              style={{
                fontSize: "0.9375rem", fontWeight: 600,
                color: "var(--cs-text)", fontFamily: "var(--font-display)",
                marginBottom: "0.875rem",
              }}
            >
              Today&apos;s Booking Queue
            </div>
            <CrmBookingQueuePanel
              bookings={queueData}
              nextApptId={nextAppt?.id}
              paymentAction={updateBookingPaymentAction}
            />
          </div>

          {/* System orientation cards */}
          <TodaySystemMatchStatus />
          <TodayEmergencyActions />
        </div>

        {/* ── Right rail ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <TodayStaffReadiness summary={snapshot.staffReadiness} />
          <TodayDispatchSnapshot stats={snapshot.dispatchStats} />
          <TodaySideRail
            completed={completed.length}
            inProgress={inProgBks.length}
            upcoming={upcoming.length}
            cancelledNS={cancelled.length}
            paymentSummary={snapshot.payment}
          />
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: "1.5rem",
          paddingTop: "0.75rem",
          borderTop: "1px solid var(--cs-border-soft)",
          fontSize: "0.6875rem",
          color: "var(--cs-text-muted)",
          lineHeight: 1.5,
        }}
      >
        Signed in as {roleLabel} · {branchName}
      </div>
    </div>
  );
}
