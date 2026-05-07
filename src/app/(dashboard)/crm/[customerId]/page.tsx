import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { BookingStatusBadge } from "@/components/features/dashboard/booking-status-badge";
import { BookingTypeBadge } from "@/components/features/dashboard/booking-type-badge";
import { CustomerNotesForm } from "@/components/features/dashboard/customer-notes-form";
import { CustomerSegmentBadge } from "@/components/features/crm/customer-segment-badge";
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
  | "preferred_visit_type"
  | "pressure_preference"
  | "health_notes"
  | "birthday"
  | "loyalty_tier"
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

function computeSegment(customer: CustomerProfile): "new" | "repeat" | "lapsed" | null {
  if (customer.total_bookings === 1) return "new";
  if (customer.total_bookings >= 2) {
    if (customer.last_booking_date) {
      const daysSince = Math.floor(
        (Date.now() - new Date(customer.last_booking_date).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSince >= 30) return "lapsed";
    }
    return "repeat";
  }
  return null;
}

function mostBookedService(bookings: BookingHistoryItem[]): string | null {
  const counts = new Map<string, number>();
  for (const b of bookings) {
    const svc = firstRelation(b.services);
    if (svc?.name) {
      counts.set(svc.name, (counts.get(svc.name) ?? 0) + 1);
    }
  }
  let max = 0;
  let name: string | null = null;
  for (const [svcName, count] of counts) {
    if (count > max) {
      max = count;
      name = svcName;
    }
  }
  return name;
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

  const segment = computeSegment(customer);
  const topService = mostBookedService(bookings);

  return (
    <div>
      <div style={{ marginBottom: "0.75rem" }}>
        <Link
          href="/crm/customers"
          style={{
            fontSize: "0.8125rem",
            color: "var(--cs-text-muted)",
            textDecoration: "none",
          }}
        >
          &larr; All Customers
        </Link>
      </div>

      <PageHeader
        title={customer.full_name}
        description={
          [customer.phone, customer.email].filter(Boolean).join(" · ") || undefined
        }
        icon="👤"
        action={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {segment && <CustomerSegmentBadge segment={segment} />}
            <Link
              href={`/crm/bookings/new?customerId=${customer.id}`}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid var(--cs-border)",
                backgroundColor: "var(--cs-sand-mist)",
                color: "var(--cs-sand)",
                fontSize: "0.75rem",
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              Book again
            </Link>
          </div>
        }
      />

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: "0.625rem",
          marginBottom: "1.5rem",
        }}
      >
        <StatCard label="Total Visits" value={customer.total_bookings} accent />
        <StatCard label="Completed" value={completedBookings.length} />
        <StatCard
          label="Last Visit"
          value={customer.last_booking_date ? formatDate(customer.last_booking_date) : "Never"}
        />
        <StatCard
          label="Preferred Staff"
          value={preferredStaff?.full_name ?? "No preference"}
        />
        <StatCard
          label="Top Service"
          value={topService ?? "—"}
        />
        <StatCard label="Revenue" value={formatCurrency(totalRevenue)} accent />
      </div>

      {/* Two-column: History + Sidebar */}
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
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: "0.875rem",
            }}
          >
            <span style={{ fontSize: 16 }}>📋</span>
            <div
              style={{
                fontSize: "0.9375rem",
                fontWeight: 600,
                color: "var(--cs-text)",
                fontFamily: "var(--font-display)",
              }}
            >
              Booking History
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
              title="No bookings yet"
              description="This customer has no booking history."
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
                      borderBottom: i < bookings.length - 1 ? "1px solid var(--cs-border)" : "none",
                    }}
                  >
                    <div style={{ minWidth: 90, flexShrink: 0 }}>
                      <div style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--cs-text)" }}>
                        {formatDate(booking.booking_date)}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
                        {formatTime(booking.start_time)}
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
                        {service?.name ?? "—"}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
                        {staffMember?.full_name ?? "Unassigned"}
                        {branch?.name && <span style={{ marginLeft: 6 }}>&middot; {branch.name}</span>}
                      </div>
                    </div>

                    {pricePaid > 0 && (
                      <div
                        style={{
                          fontSize: "0.875rem",
                          fontWeight: 500,
                          color: "var(--cs-text)",
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

        {/* Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Contact */}
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
                  borderBottom: i < arr.length - 1 ? "1px solid var(--cs-border)" : "none",
                }}
              >
                <div
                  style={{
                    minWidth: 50,
                    fontSize: "0.75rem",
                    color: "var(--cs-text-muted)",
                    flexShrink: 0,
                  }}
                >
                  {row.label}
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--cs-text)" }}>{row.value}</div>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
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
              Quick Actions
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              {[
                {
                  icon: "➕",
                  label: "Book again",
                  soon: false,
                  href: `/crm/bookings/new?customerId=${customer.id}`,
                },
                { icon: "📝", label: "Add note", soon: false, scrollTo: "notes" },
                { icon: "✏️", label: "Edit customer", soon: true },
              ].map((action) =>
                action.soon ? (
                  <div
                    key={action.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "0.625rem 0.5rem",
                      borderRadius: "var(--cs-r-sm)",
                      color: "var(--cs-text-muted)",
                      fontSize: "0.8125rem",
                      opacity: 0.6,
                      cursor: "not-allowed",
                    }}
                    title="Coming soon"
                  >
                    <span>{action.icon}</span>
                    {action.label}
                  </div>
                ) : (
                  <Link
                    key={action.label}
                    href={action.href ?? "#notes"}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "0.625rem 0.5rem",
                      borderRadius: "var(--cs-r-sm)",
                      color: "var(--cs-text-secondary)",
                      fontSize: "0.8125rem",
                      textDecoration: "none",
                      transition: "var(--cs-trans)",
                    }}
                  >
                    <span>{action.icon}</span>
                    {action.label}
                  </Link>
                )
              )}
            </div>
          </div>

          {/* Notes */}
          <div id="notes" className="cs-card" style={{ padding: "1.25rem" }}>
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
              CRM Notes
            </div>
            <CustomerNotesForm
              customerId={customer.id}
              initialFullName={customer.full_name}
              initialPhone={customer.phone}
              initialEmail={customer.email}
              initialNotes={customer.notes}
              initialPreferredStaffId={customer.preferred_staff_id}
              initialPreferredVisitType={customer.preferred_visit_type}
              initialPressurePreference={customer.pressure_preference}
              initialHealthNotes={customer.health_notes}
              initialBirthday={customer.birthday}
              initialLoyaltyTier={customer.loyalty_tier}
              staff={staffOptions}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
