import { PageHeader } from "@/components/features/dashboard/page-header";
import { BookingStatusBadge } from "@/components/features/dashboard/booking-status-badge";
import { BookingTypeBadge } from "@/components/features/dashboard/booking-type-badge";
import { PaymentStatusBadge } from "@/components/features/dashboard/payment-status-badge";
import { PaymentMethodBadge } from "@/components/features/dashboard/payment-method-badge";
import { EmptyState } from "@/components/features/dashboard/empty-state";
import { getOwnerBookingsAction } from "./actions";
import { formatDate, formatTime } from "@/lib/utils";

type BranchRel   = { name: string }     | { name: string }[]     | null;
type ServiceRel  = { name: string }     | { name: string }[]     | null;
type StaffRel    = { full_name: string } | { full_name: string }[] | null;
type CustomerRel = { full_name: string } | { full_name: string }[] | null;

type OwnerBookingRow = {
  id:             string;
  start_time:     string;
  type:           string;
  status:         string;
  payment_method: string;
  payment_status: string;
  amount_paid:    number;
  branches:       BranchRel;
  services:       ServiceRel;
  staff:          StaffRel;
  customers:      CustomerRel;
};

function readName(rel: BranchRel | ServiceRel): string {
  if (!rel) return "—";
  if (Array.isArray(rel)) return rel[0]?.name ?? "—";
  return rel.name;
}

function readFullName(rel: StaffRel | CustomerRel): string {
  if (!rel) return "—";
  if (Array.isArray(rel)) return rel[0]?.full_name ?? "—";
  return rel.full_name;
}

export default async function OwnerBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; branch?: string; status?: string; type?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const today = new Date().toISOString().split("T")[0]!;
  const fromDate = resolvedSearchParams.date ?? today;

  const result = await getOwnerBookingsAction({
    fromDate,
    toDate:   fromDate,
    branchId: resolvedSearchParams.branch  || undefined,
    status:   resolvedSearchParams.status  || undefined,
    type:     resolvedSearchParams.type    || undefined,
  });

  const bookings: OwnerBookingRow[] = "error" in result ? [] : (result as unknown as OwnerBookingRow[]);

  return (
    <div>
      <PageHeader title="All Bookings" description="Cross-branch view" />

      <form style={{ marginBottom: "1.25rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <input
          type="date"
          name="date"
          defaultValue={fromDate}
          aria-label="Select date"
          style={{ height: 36, borderRadius: 6, border: "1px solid var(--cs-border)", padding: "0 0.75rem", fontSize: "0.875rem", backgroundColor: "var(--cs-surface)", color: "var(--cs-text)" }}
        />
        <button
          type="submit"
          style={{ height: 36, padding: "0 1rem", borderRadius: 6, border: "1px solid var(--cs-border)", backgroundColor: "var(--cs-surface)", color: "var(--cs-text)", fontSize: "0.875rem", cursor: "pointer" }}
        >
          Filter
        </button>
      </form>

      <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)", marginBottom: "0.75rem" }}>
        {bookings.length} booking{bookings.length !== 1 ? "s" : ""} on {formatDate(fromDate)}
      </div>

      {bookings.length === 0 ? (
        <EmptyState title="No bookings found" description="No bookings match the selected filters." />
      ) : (
        <div style={{ backgroundColor: "var(--cs-surface)", border: "1px solid var(--cs-border)", borderRadius: 10, overflow: "hidden" }}>
          {bookings.map((booking, i) => (
            <div
              key={booking.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.875rem",
                padding: "0.75rem 1rem",
                borderBottom: i < bookings.length - 1 ? "1px solid var(--cs-border)" : "none",
              }}
            >
              <div style={{ minWidth: 52, paddingTop: 2, fontSize: "0.8125rem", fontWeight: 500, color: "var(--cs-text)" }}>
                {formatTime(booking.start_time)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--cs-text)" }}>
                  {readFullName(booking.customers)}
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)" }}>
                  {readName(booking.services)} · {readFullName(booking.staff)} · {readName(booking.branches)}
                </div>
                {/* Payment info */}
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3, flexWrap: "wrap" }}>
                  <PaymentMethodBadge method={booking.payment_method} />
                  <PaymentStatusBadge status={booking.payment_status} />
                  {booking.payment_status === "paid" && booking.amount_paid > 0 && (
                    <span style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
                      ₱{booking.amount_paid.toLocaleString("en-PH")}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0, paddingTop: 2 }}>
                <BookingTypeBadge type={booking.type} />
                <BookingStatusBadge status={booking.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
