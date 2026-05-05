import { PageHeader } from "@/components/features/dashboard/page-header";
import { BookingStatusBadge } from "@/components/features/dashboard/booking-status-badge";
import { BookingTypeBadge } from "@/components/features/dashboard/booking-type-badge";
import { BookingActionMenu } from "@/components/features/dashboard/booking-action-menu";
import { PaymentStatusBadge } from "@/components/features/dashboard/payment-status-badge";
import { PaymentMethodBadge } from "@/components/features/dashboard/payment-method-badge";
import { PaymentActionMenu } from "@/components/features/dashboard/payment-action-menu";
import { DailyCashSummary } from "@/components/features/dashboard/daily-cash-summary";
import { EmptyState } from "@/components/features/dashboard/empty-state";
import { getTodaysSchedule, getDailyPaymentSummary } from "@/lib/queries/bookings";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatTime } from "@/lib/utils";
import { isDevAuthBypassEnabled, getDevBypassLayoutStaff } from "@/lib/dev-bypass";

type Relation<T> = T | T[] | null;

type CustomerRelation = { full_name: string; phone: string | null };
type ServiceRelation  = { name: string };
type StaffRelation    = { full_name: string };

type BookingRow = {
  id:                 string;
  start_time:         string;
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
  branch_resources:   Relation<{ name: string }>;
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

async function getOperationsContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("staff")
    .select("branch_id, system_role")
    .eq("auth_user_id", user.id)
    .single();

  const allowedRoles = [
    "owner", "manager", "assistant_manager", "store_manager",
    "crm", "csr", "csr_head", "csr_staff",
  ];

  if (!me && isDevAuthBypassEnabled()) {
    const mock = getDevBypassLayoutStaff();
    return { branchId: mock.branch_id, systemRole: mock.system_role };
  }

  if (!me?.branch_id || !allowedRoles.includes(me.system_role)) redirect("/login");

  return { branchId: me.branch_id as string, systemRole: me.system_role };
}

export default async function ManagerBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const { branchId, systemRole } = await getOperationsContext();
  const today = new Date().toISOString().split("T")[0]!;
  const date = resolvedSearchParams.date ?? today;

  const [rawBookings, cashSummary] = await Promise.all([
    getTodaysSchedule(branchId, date),
    getDailyPaymentSummary(branchId, date),
  ]);
  const bookings = rawBookings as BookingRow[];

  const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("en-PH", {
    weekday: "long", month: "long", day: "numeric",
  });

  return (
    <div>
      <PageHeader title="Bookings" description="Manage booking status and payments" icon="📋" />

      <form style={{ marginBottom: "1.25rem" }}>
        <input
          type="date"
          name="date"
          defaultValue={date}
          aria-label="Select date"
          style={{
            height: 36,
            borderRadius: 6,
            border: "1px solid var(--cs-border)",
            padding: "0 0.75rem",
            fontSize: "0.875rem",
            backgroundColor: "var(--cs-surface)",
            color: "var(--cs-text)",
          }}
        />
        <button
          type="submit"
          style={{
            marginLeft: 8,
            height: 36,
            padding: "0 1rem",
            borderRadius: 6,
            border: "1px solid var(--cs-border)",
            backgroundColor: "var(--cs-surface)",
            color: "var(--cs-text)",
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        >
          View
        </button>
      </form>

      {/* Daily cash summary — always shown so manager can see collected vs expected */}
      <DailyCashSummary data={cashSummary} label={dateLabel} />

      {bookings.length === 0 ? (
        <EmptyState title="No bookings" description={`No bookings on ${date}.`} />
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
            const customer = readRelation(booking.customers);
            const service  = readRelation(booking.services);
            const staff    = readRelation(booking.staff);
            const pricePaid = readPricePaid(booking.metadata);

            return (
              <div
                key={booking.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.875rem",
                  padding: "0.875rem 1rem",
                  borderBottom: i < bookings.length - 1 ? "1px solid var(--cs-border)" : "none",
                }}
              >
                {/* Time */}
                <div style={{ minWidth: 52, paddingTop: 2, fontSize: "0.875rem", fontWeight: 500, color: "var(--cs-text)", flexShrink: 0 }}>
                  {formatTime(booking.start_time)}
                </div>

                {/* Customer + service + payment info */}
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
                    {service?.name ?? "Service"} · {staff?.full_name ?? "Unassigned"}
                    {readRelation(booking.branch_resources) && (
                      <span style={{ color: "var(--cs-sand)", marginLeft: 6, fontWeight: 500 }}>
                        · {readRelation(booking.branch_resources)!.name}
                      </span>
                    )}
                    {booking.type === "home_service" && booking.travel_buffer_mins ? (
                      <span style={{ color: "var(--cs-sand)", marginLeft: 6 }}>
                        +{booking.travel_buffer_mins}min travel
                      </span>
                    ) : null}
                  </div>
                  {/* Payment line */}
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
                  <BookingActionMenu bookingId={booking.id} currentStatus={booking.status} userRole={systemRole} />
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
