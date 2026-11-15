import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  FileText,
  Plus,
  Sparkles,
  UserRound,
} from "lucide-react";
import { CrmSectionCard, CrmStatCard } from "@/components/features/crm/shared/crm-cards";
import { CrmPageHeader } from "@/components/features/crm/shared/crm-page-header";
import { OpenAdministrativeBookingButton } from "@/components/features/bookings/administrative-booking-modal-provider";
import { BookingStatusBadge } from "@/components/features/dashboard/booking-status-badge";
import { BookingTypeBadge } from "@/components/features/dashboard/booking-type-badge";
import { CustomerNotesForm } from "@/components/features/dashboard/customer-notes-form";
import { CustomerSegmentBadge } from "@/components/features/crm/customer-segment-badge";
import { EmptyState } from "@/components/features/dashboard/empty-state";
import { getCustomerProfileAction } from "@/app/(dashboard)/crm/actions";
import { getAllStaff } from "@/lib/queries/staff";
import { getStaffAdminName } from "@/lib/staff/display-name";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import type { Database } from "@/types/supabase";
import { getCustomerDiscountHistoryAction } from "@/lib/cash-flow/discount-actions";

type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];
type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];
type StaffRow = Database["public"]["Tables"]["staff"]["Row"];
type BranchRow = Database["public"]["Tables"]["branches"]["Row"];
type ServiceRow = Database["public"]["Tables"]["services"]["Row"];

type OneOrMany<T> = T | T[] | null;

type StaffRelation = OneOrMany<Pick<StaffRow, "id" | "full_name" | "nickname" | "tier">>;
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CustomerProfilePage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;

  // Reject non-UUID segments immediately (e.g. /crm/payments, /crm/new)
  // so we never send a garbage value to Postgres as a UUID.
  if (!UUID_RE.test(customerId)) {
    notFound();
  }

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
  const preferredStaffName = preferredStaff ? getStaffAdminName(preferredStaff) : "No preference";
  const staffOptions = allStaff
    .filter((staffMember) => staffMember.is_active)
    .map((staffMember) => ({
      id: staffMember.id,
      full_name: staffMember.full_name,
      nickname: staffMember.nickname,
      tier: staffMember.tier,
    }));

  const segment = computeSegment(customer);
  const topService = mostBookedService(bookings);
  const discountHistory = await getCustomerDiscountHistoryAction(customer.id);

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/crm/customers"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--cs-text-muted)] transition hover:text-[var(--cs-text)]"
        >
          <ArrowLeft size={14} />
          All Customers
        </Link>
      </div>

      <CrmPageHeader
        eyebrow="Guest Profile"
        title={customer.full_name}
        description={
          [customer.phone, customer.email].filter(Boolean).join(" · ") || undefined
        }
        badge={segment ? <CustomerSegmentBadge segment={segment} /> : undefined}
        actions={
          <OpenAdministrativeBookingButton
            mode="standard_future"
            customerId={customer.id}
            label="Book again"
            showIcon={false}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1F4E33] px-3.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#163B26]"
          />
        }
      />

      {discountHistory.available ? (
        <CrmSectionCard
          title="Discount history"
          description="Check identification at each visit before selecting Senior Citizen or PWD."
          className="mb-5"
          compact
        >
          {discountHistory.entries.length ? (
            <ul className="space-y-1 text-sm text-[var(--cs-text)]">
              {discountHistory.entries.map((entry, index) => (
                <li key={`${entry.transactionId}-${index}`}>
                  {entry.category === "senior" ? "Senior Citizen" : entry.category.toUpperCase()} · {formatCurrency(entry.amount)} · {formatDate(entry.appliedAt)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--cs-text-muted)]">No committed discounts on file.</p>
          )}
        </CrmSectionCard>
      ) : null}

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <CrmStatCard
          compact
          title="Total Visits"
          value={customer.total_bookings}
          tone="success"
          icon={<CalendarCheck className="size-4" aria-hidden="true" />}
        />
        <CrmStatCard
          compact
          title="Completed"
          value={completedBookings.length}
          tone="info"
          icon={<CheckCircle2 className="size-4" aria-hidden="true" />}
        />
        <CrmStatCard
          compact
          title="Last Visit"
          value={customer.last_booking_date ? formatDate(customer.last_booking_date) : "Never"}
          tone="neutral"
          icon={<Clock3 className="size-4" aria-hidden="true" />}
        />
        <CrmStatCard
          compact
          title="Preferred Staff"
          value={preferredStaffName}
          tone="neutral"
          icon={<UserRound className="size-4" aria-hidden="true" />}
        />
        <CrmStatCard
          compact
          title="Top Service"
          value={topService ?? "—"}
          tone="neutral"
          icon={<Sparkles className="size-4" aria-hidden="true" />}
        />
        <CrmStatCard
          compact
          title="Revenue"
          value={formatCurrency(totalRevenue)}
          tone="success"
          icon={<Banknote className="size-4" aria-hidden="true" />}
        />
      </div>

      {/* Two-column: History + Sidebar */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <CrmSectionCard
            title="Booking History"
            icon={<CalendarCheck className="size-4" aria-hidden="true" />}
            badge={
              <span className="rounded-full bg-[#EEF7F1] px-2.5 py-0.5 text-xs font-bold text-[#1F4E33] tabular-nums">
                {bookings.length} total
              </span>
            }
            noPadding
          >
            {bookings.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="No bookings yet"
                  description="This customer has no booking history."
                />
              </div>
            ) : (
              <div className="divide-y divide-[var(--cs-border-soft)]">
                {bookings.map((booking) => {
                  const service = firstRelation(booking.services);
                  const staffMember = firstRelation(booking.staff);
                  const staffName = staffMember ? getStaffAdminName(staffMember) : "Unassigned";
                  const branch = firstRelation(booking.branches);
                  const pricePaid = readPricePaid(booking.metadata);

                  return (
                    <div
                      key={booking.id}
                      className="flex flex-wrap items-center gap-3.5 px-4 py-3"
                    >
                      <div className="min-w-[90px] shrink-0">
                        <div className="text-[0.8125rem] font-semibold text-[var(--cs-text)]">
                          {formatDate(booking.booking_date)}
                        </div>
                        <div className="text-xs text-[var(--cs-text-muted)]">
                          {formatTime(booking.start_time)}
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-[var(--cs-text)]">
                          {service?.name ?? "—"}
                        </div>
                        <div className="text-xs text-[var(--cs-text-muted)]">
                          {staffName}
                          {branch?.name ? <span className="ml-1.5">&middot; {branch.name}</span> : null}
                        </div>
                      </div>

                      {pricePaid > 0 ? (
                        <div className="shrink-0 text-sm font-semibold text-[var(--cs-text)] tabular-nums">
                          {formatCurrency(pricePaid)}
                        </div>
                      ) : null}

                      <div className="flex shrink-0 gap-1.5">
                        <BookingTypeBadge type={booking.type} />
                        <BookingStatusBadge status={booking.status} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CrmSectionCard>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          <CrmSectionCard title="Contact" compact>
            <div className="divide-y divide-[var(--cs-border-soft)]">
              {[
                { label: "Phone", value: customer.phone },
                { label: "Email", value: customer.email ?? "—" },
                {
                  label: "Since",
                  value: customer.first_booking_date ? formatDate(customer.first_booking_date) : "—",
                },
                { label: "Prefers", value: preferredStaffName },
              ].map((row) => (
                <div key={row.label} className="flex gap-2 py-1.5 first:pt-0 last:pb-0">
                  <div className="min-w-[56px] shrink-0 text-xs font-medium text-[var(--cs-text-muted)]">
                    {row.label}
                  </div>
                  <div className="min-w-0 text-[0.8125rem] text-[var(--cs-text)]">{row.value}</div>
                </div>
              ))}
            </div>
          </CrmSectionCard>

          <CrmSectionCard title="Quick Actions" compact>
            <div className="flex flex-col gap-1.5">
              <OpenAdministrativeBookingButton
                mode="standard_future"
                customerId={customer.id}
                showIcon={false}
                className="flex w-full items-center justify-start gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--cs-text-secondary)] transition hover:bg-[#F5F2EE] hover:text-[var(--cs-text)]"
                variant="ghost"
              >
                <Plus size={14} className="text-[#1F4E33]" />
                Book again
              </OpenAdministrativeBookingButton>
              <Link
                href="#notes"
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--cs-text-secondary)] transition hover:bg-[#F5F2EE] hover:text-[var(--cs-text)]"
              >
                <FileText size={14} className="text-[#1F4E33]" />
                Add note
              </Link>
            </div>
          </CrmSectionCard>

          <div id="notes">
            <CrmSectionCard title="CRM Notes" compact>
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
            </CrmSectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}
