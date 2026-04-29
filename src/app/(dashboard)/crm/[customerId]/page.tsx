import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { BookingStatusBadge } from "@/components/features/dashboard/booking-status-badge";
import { BookingTypeBadge } from "@/components/features/dashboard/booking-type-badge";
import { CustomerNotesForm } from "@/components/features/dashboard/customer-notes-form";
import { StatCard } from "@/components/features/dashboard/stat-card";
import { EmptyState } from "@/components/features/dashboard/empty-state";
import { getCustomerProfileAction } from "@/app/(dashboard)/crm/actions";
import { getAllStaff } from "@/lib/queries/staff";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import type { Database } from "@/types/supabase";

type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];
type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];
type StaffRow = Database["public"]["Tables"]["staff"]["Row"];
type BranchRow = Database["public"]["Tables"]["branches"]["Row"];
type ServiceRow = Database["public"]["Tables"]["services"]["Row"];

type OneOrMany<T> = T | T[] | null;

type StaffRelation = OneOrMany<Pick<StaffRow, "id" | "full_name" | "tier">>;
type BranchRelation = OneOrMany<Pick<BranchRow, "id" | "name">>;
type ServiceRelation = OneOrMany<Pick<ServiceRow, "id" | "name">>;

type CustomerProfile = Pick<
  CustomerRow,
  | "id"
  | "full_name"
  | "phone"
  | "email"
  | "first_booking_date"
  | "last_booking_date"
  | "total_bookings"
  | "notes"
  | "preferred_staff_id"
>;

type BookingHistoryItem = Pick<
  BookingRow,
  "id" | "booking_date" | "start_time" | "status" | "type" | "metadata"
> & {
  services: ServiceRelation;
  staff: StaffRelation;
  branches: BranchRelation;
};

type CustomerProfilePayload = {
  customer: CustomerProfile;
  bookings: BookingHistoryItem[];
};

type ActionError = {
  error: string;
};

type StaffWithBranch = StaffRow & {
  branches: unknown;
};

function firstRelation<T>(relation: OneOrMany<T>): T | null {
  if (!relation) return null;
  return Array.isArray(relation) ? (relation[0] ?? null) : relation;
}

function readPricePaid(metadata: unknown): number {
  if (!metadata || typeof metadata !== "object") return 0;
  const maybePrice = (metadata as Record<string, unknown>)["price_paid"];
  if (typeof maybePrice === "number") return maybePrice;
  if (typeof maybePrice === "string") {
    const parsed = Number(maybePrice);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function isCustomerProfilePayload(value: unknown): value is CustomerProfilePayload {
  if (!value || typeof value !== "object") return false;
  const maybePayload = value as Partial<CustomerProfilePayload>;
  return !!maybePayload.customer && Array.isArray(maybePayload.bookings);
}

export default async function CustomerProfilePage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const [profileResult, allStaffResult] = await Promise.all([
    getCustomerProfileAction(customerId),
    getAllStaff(),
  ]);

  if ((profileResult as ActionError).error || !isCustomerProfilePayload(profileResult)) {
    notFound();
  }

  const { customer, bookings } = profileResult;
  if (!customer) {
    notFound();
  }

  const allStaff = allStaffResult as StaffWithBranch[];
  const completedBookings = bookings.filter((booking) => booking.status === "completed");
  const totalRevenue = completedBookings.reduce((sum, booking) => {
    return sum + readPricePaid(booking.metadata);
  }, 0);

  const preferredStaff = allStaff.find((staffMember) => staffMember.id === customer.preferred_staff_id);
  const staffOptions = allStaff
    .filter((staffMember) => staffMember.is_active)
    .map((staffMember) => ({
      id: staffMember.id,
      full_name: staffMember.full_name,
      tier: staffMember.tier,
    }));

  return (
    <div>
      <div style={{ marginBottom: "0.75rem" }}>
        <Link
          href="/crm"
          style={{
            fontSize: "0.8125rem",
            color: "var(--ch-text-muted)",
            textDecoration: "none",
          }}
        >
          ← All Customers
        </Link>
      </div>

      <PageHeader title={customer.full_name} description={customer.phone} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: "1.5rem",
          alignItems: "start",
        }}
      >
        <div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "0.625rem",
              marginBottom: "1.5rem",
            }}
          >
            <StatCard label="Total Visits" value={customer.total_bookings} accent />
            <StatCard label="Revenue Generated" value={formatCurrency(totalRevenue)} />
            <StatCard
              label="Last Visit"
              value={customer.last_booking_date ? formatDate(customer.last_booking_date) : "Never"}
            />
          </div>

          <div
            style={{
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: "var(--ch-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "0.625rem",
            }}
          >
            Booking History ({bookings.length})
          </div>

          {bookings.length === 0 ? (
            <EmptyState title="No bookings yet" description="This customer has no booking history." />
          ) : (
            <div
              style={{
                backgroundColor: "var(--ch-surface)",
                border: "1px solid var(--ch-border)",
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              {bookings.map((booking, i) => {
                const service = firstRelation(booking.services);
                const staffMember = firstRelation(booking.staff);
                const branch = firstRelation(booking.branches);
                const pricePaid = readPricePaid(booking.metadata);

                return (
                  <div
                    key={booking.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.875rem",
                      padding: "0.75rem 1rem",
                      borderBottom: i < bookings.length - 1 ? "1px solid var(--ch-border)" : "none",
                    }}
                  >
                    <div style={{ minWidth: 90, flexShrink: 0 }}>
                      <div style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--ch-text)" }}>
                        {formatDate(booking.booking_date)}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--ch-text-muted)" }}>
                        {formatTime(booking.start_time)}
                      </div>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "0.875rem",
                          fontWeight: 500,
                          color: "var(--ch-text)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {service?.name ?? "—"}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--ch-text-muted)" }}>
                        {staffMember?.full_name ?? "Unassigned"}
                        {branch?.name && <span style={{ marginLeft: 6 }}>· {branch.name}</span>}
                      </div>
                    </div>

                    {pricePaid > 0 && (
                      <div
                        style={{
                          fontSize: "0.875rem",
                          fontWeight: 500,
                          color: "var(--ch-text)",
                          flexShrink: 0,
                        }}
                      >
                        {formatCurrency(pricePaid)}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <BookingTypeBadge type={booking.type} />
                      <BookingStatusBadge status={booking.status} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div
            style={{
              backgroundColor: "var(--ch-surface)",
              border: "1px solid var(--ch-border)",
              borderRadius: 10,
              padding: "1rem",
            }}
          >
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "var(--ch-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "0.75rem",
              }}
            >
              Contact
            </div>
            {[
              { label: "Phone", value: customer.phone },
              { label: "Email", value: customer.email ?? "—" },
              {
                label: "Since",
                value: customer.first_booking_date ? formatDate(customer.first_booking_date) : "—",
              },
              { label: "Prefers", value: preferredStaff?.full_name ?? "No preference" },
            ].map((row, i, arr) => (
              <div
                key={row.label}
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  padding: "4px 0",
                  borderBottom: i < arr.length - 1 ? "1px solid var(--ch-border)" : "none",
                }}
              >
                <div
                  style={{
                    minWidth: 50,
                    fontSize: "0.75rem",
                    color: "var(--ch-text-subtle)",
                    flexShrink: 0,
                  }}
                >
                  {row.label}
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--ch-text)" }}>{row.value}</div>
              </div>
            ))}
          </div>

          <div
            style={{
              backgroundColor: "var(--ch-surface)",
              border: "1px solid var(--ch-border)",
              borderRadius: 10,
              padding: "1rem",
            }}
          >
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "var(--ch-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "0.75rem",
              }}
            >
              CRM Notes
            </div>
            <CustomerNotesForm
              customerId={customer.id}
              initialNotes={customer.notes}
              initialPreferredStaffId={customer.preferred_staff_id}
              staff={staffOptions}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
