import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { BookingStatusBadge } from "@/components/features/dashboard/booking-status-badge";
import { BookingTypeBadge } from "@/components/features/dashboard/booking-type-badge";
import { BookingActionMenu } from "@/components/features/dashboard/booking-action-menu";
import { PaymentStatusBadge } from "@/components/features/dashboard/payment-status-badge";
import { PaymentMethodBadge } from "@/components/features/dashboard/payment-method-badge";
import { PaymentActionMenu } from "@/components/features/dashboard/payment-action-menu";
import { DailyCashSummary } from "@/components/features/dashboard/daily-cash-summary";
import { EmptyState } from "@/components/features/dashboard/empty-state";
import { createClient } from "@/lib/supabase/server";
import { getTodaysSchedule, getDailyPaymentSummary } from "@/lib/queries/bookings";
import { formatTime } from "@/lib/utils";
import { isDevAuthBypassEnabled, getDevBypassLayoutStaff } from "@/lib/dev-bypass";

type Relation<T> = T | T[] | null;

type CustomerRelation = { full_name: string; phone: string | null };
type ServiceRelation  = { name: string };
type StaffRelation    = { full_name: string };

type BookingRow = {
  id:                 string;
  start_time:         string;
  booking_date:       string;
  status:             string;
  type:               string;
  travel_buffer_mins: number | null;
  metadata:           Record<string, unknown> | null;
  payment_method:     string;
  payment_status:     string;
  amount_paid:        number;
  customers:          Relation<CustomerRelation>;
  services:           Relation<ServiceRelation>;
  staff:              Relation<StaffRelation>;
};

function readRelation<T>(relation: Relation<T>): T | null {
  if (!relation) return null;
  return Array.isArray(relation) ? (relation[0] ?? null) : relation;
}

function readPricePaid(metadata: Record<string, unknown> | null): number {
  if (!metadata) return 0;
  const n = Number(metadata["price_paid"] ?? 0);
  return Number.isFinite(n) ? n : 0;
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

  const allowedRoles = [
    "owner", "manager", "assistant_manager", "store_manager",
    "crm", "csr", "csr_head", "csr_staff",
  ];

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

export default async function CrmBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; status?: string; type?: string; highlight?: string }>;
}) {
  const { branchId, branchName, role } = await getCsrContext();
  const params = await searchParams;

  const today = new Date().toISOString().split("T")[0]!;
  const date = params.date ?? today;

  const [rawBookings, cashSummary] = await Promise.all([
    getTodaysSchedule(branchId, date),
    getDailyPaymentSummary(branchId, date),
  ]);
  let bookings = rawBookings as BookingRow[];

  if (params.status) bookings = bookings.filter((b) => b.status === params.status);
  if (params.type)   bookings = bookings.filter((b) => b.type === params.type);

  const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("en-PH", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  return (
    <div>
      <PageHeader
        title="Bookings"
        description={`${branchName} · ${dateLabel}`}
        icon="📋"
        action={
          <Link
            href="/crm/bookings/new"
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              backgroundColor: "var(--cs-sand)",
              color: "#fff",
              fontSize: "0.8125rem",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            ➕ New Booking
          </Link>
        }
      />

      {/* Filters */}
      <div
        className="cs-card"
        style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.625rem 0.875rem", marginBottom: "1rem", flexWrap: "wrap" }}
      >
        <form style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <input
            type="date"
            name="date"
            defaultValue={date}
            aria-label="Select date"
            style={{ height: 36, borderRadius: 6, border: "1px solid var(--cs-border)", padding: "0 0.75rem", fontSize: "0.875rem", backgroundColor: "var(--cs-surface)", color: "var(--cs-text)" }}
          />
          <select
            name="status"
            defaultValue={params.status ?? ""}
            aria-label="Filter by status"
            style={{ height: 36, borderRadius: 6, border: "1px solid var(--cs-border)", padding: "0 0.75rem", fontSize: "0.875rem", backgroundColor: "var(--cs-surface)", color: "var(--cs-text)" }}
          >
            <option value="">All Statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No Show</option>
          </select>
          <select
            name="type"
            defaultValue={params.type ?? ""}
            aria-label="Filter by type"
            style={{ height: 36, borderRadius: 6, border: "1px solid var(--cs-border)", padding: "0 0.75rem", fontSize: "0.875rem", backgroundColor: "var(--cs-surface)", color: "var(--cs-text)" }}
          >
            <option value="">All Types</option>
            <option value="walkin">Walk-in</option>
            <option value="online">Online</option>
            <option value="home_service">Home Service</option>
          </select>
          <button type="submit" style={{ height: 36, padding: "0 1rem", borderRadius: 6, border: "1px solid var(--cs-border)", backgroundColor: "var(--cs-surface)", color: "var(--cs-text)", fontSize: "0.875rem", cursor: "pointer" }}>
            Filter
          </button>
          {(params.date || params.status || params.type) && (
            <Link
              href="/crm/bookings"
              style={{ height: 36, padding: "0 1rem", borderRadius: 6, border: "1px solid var(--cs-border)", backgroundColor: "var(--cs-surface-warm)", color: "var(--cs-text)", fontSize: "0.875rem", textDecoration: "none", display: "inline-flex", alignItems: "center" }}
            >
              Clear
            </Link>
          )}
        </form>
      </div>

      {/* Daily cash summary */}
      <DailyCashSummary data={cashSummary} label={dateLabel} />

      {bookings.length === 0 ? (
        <EmptyState
          title="No bookings"
          description={`No bookings on ${new Date(date + "T00:00:00").toLocaleDateString("en-PH", { month: "long", day: "numeric" })}.`}
          icon="📋"
        />
      ) : (
        <div style={{ backgroundColor: "var(--cs-surface)", border: "1px solid var(--cs-border)", borderRadius: 10, overflow: "hidden" }}>
          {bookings.map((booking, i) => {
            const customer = readRelation(booking.customers);
            const service  = readRelation(booking.services);
            const staffMember = readRelation(booking.staff);
            const pricePaid = readPricePaid(booking.metadata);
            const isHighlighted = params.highlight === booking.id;

            return (
              <div
                key={booking.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.875rem",
                  padding: "0.875rem 1rem",
                  borderBottom: i < bookings.length - 1 ? "1px solid var(--cs-border)" : "none",
                  backgroundColor: isHighlighted ? "var(--cs-sand-mist)" : undefined,
                  transition: "background-color 0.2s ease",
                }}
              >
                {/* Time */}
                <div style={{ minWidth: 52, paddingTop: 2, fontSize: "0.875rem", fontWeight: 500, color: "var(--cs-text)", flexShrink: 0 }}>
                  {formatTime(booking.start_time)}
                </div>

                {/* Customer + service + payment */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--cs-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {customer?.full_name ?? "—"}
                    {customer?.phone && (
                      <span style={{ fontSize: "0.75rem", fontWeight: 400, color: "var(--cs-text-muted)", marginLeft: 8 }}>
                        {customer.phone}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)" }}>
                    {service?.name ?? "Service"} · {staffMember?.full_name ?? "Unassigned"}
                    {booking.type === "home_service" && booking.travel_buffer_mins ? (
                      <span style={{ color: "var(--cs-sand)", marginLeft: 6 }}>+{booking.travel_buffer_mins}min travel</span>
                    ) : null}
                  </div>
                  {/* Payment info line */}
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3, flexWrap: "wrap" }}>
                    {pricePaid > 0 && (
                      <span style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
                        ₱{pricePaid.toLocaleString("en-PH")}
                      </span>
                    )}
                    <PaymentMethodBadge method={booking.payment_method} />
                    <PaymentStatusBadge status={booking.payment_status} />
                  </div>
                </div>

                {/* Badges + actions */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, paddingTop: 2 }}>
                  <BookingTypeBadge type={booking.type} />
                  <BookingStatusBadge status={booking.status} />
                  <BookingActionMenu bookingId={booking.id} currentStatus={booking.status} userRole={role} />
                  <PaymentActionMenu
                    bookingId={booking.id}
                    paymentStatus={booking.payment_status}
                    paymentMethod={booking.payment_method}
                    amountPaid={booking.amount_paid}
                    pricePaid={pricePaid}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
