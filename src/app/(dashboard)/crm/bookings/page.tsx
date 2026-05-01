import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { BookingStatusBadge } from "@/components/features/dashboard/booking-status-badge";
import { BookingTypeBadge } from "@/components/features/dashboard/booking-type-badge";
import { BookingActionMenu } from "@/components/features/dashboard/booking-action-menu";
import { EmptyState } from "@/components/features/dashboard/empty-state";
import { getAllBookings } from "@/lib/queries/bookings";
import { getStaffByBranch } from "@/lib/queries/staff";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatTime } from "@/lib/utils";

type Relation<T> = T | T[] | null;

type CustomerRelation = {
  id: string;
  full_name: string;
  phone: string | null;
};

type ServiceRelation = {
  name: string;
};

type StaffRelation = {
  id: string;
  full_name: string;
};

type BookingRow = {
  id: string;
  booking_date: string;
  start_time: string;
  status: string;
  type: string;
  travel_buffer_mins: number | null;
  customers: Relation<CustomerRelation>;
  services: Relation<ServiceRelation>;
  staff: Relation<StaffRelation>;
};

type OperationsContext = {
  branchId: string;
  branchName: string;
  systemRole: string;
};

function firstRelation<T>(relation: Relation<T>): T | null {
  if (!relation) return null;
  return Array.isArray(relation) ? (relation[0] ?? null) : relation;
}

async function getOperationsContext(): Promise<OperationsContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("staff")
    .select("branch_id, system_role, branches(name)")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .single();

  const allowedRoles = ["owner", "crm", "csr", "csr_head", "csr_staff"];
  if (!me?.branch_id || !allowedRoles.includes(me.system_role)) redirect("/crm/today");

  return {
    branchId: me.branch_id as string,
    branchName: (me.branches as { name?: string } | null)?.name ?? "Your Branch",
    systemRole: me.system_role,
  };
}

export default async function CrmBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    status?: string;
    type?: string;
    staffId?: string;
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const { branchId, branchName, systemRole } = await getOperationsContext();
  const today = new Date().toISOString().split("T")[0]!;

  const date = resolvedSearchParams.date ?? today;
  const status = resolvedSearchParams.status ?? "all";
  const type = resolvedSearchParams.type ?? "all";
  const staffId = resolvedSearchParams.staffId ?? "all";

  const [rawBookings, staffMembers] = await Promise.all([
    getAllBookings({
      branchId,
      date,
      status: status === "all" ? undefined : status,
      type: type === "all" ? undefined : type,
      staffId: staffId === "all" ? undefined : staffId,
    }),
    getStaffByBranch(branchId),
  ]);

  const bookings = rawBookings as BookingRow[];
  const therapistOptions = staffMembers.filter((staffMember) => staffMember.system_role === "staff");

  return (
    <div>
      <PageHeader
        title="Bookings"
        description={`${branchName} · Front-desk booking operations`}
        icon="📋"
      />

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <Link href="/crm/bookings/new" className="cs-btn cs-btn-primary cs-btn-sm">
          New In-house Booking
        </Link>
        <Link href="/crm/today" className="cs-btn cs-btn-ghost cs-btn-sm">
          Today Queue
        </Link>
        <Link href="/crm/schedule" className="cs-btn cs-btn-ghost cs-btn-sm">
          View Schedule
        </Link>
      </div>

      <form
        style={{
          marginBottom: "1.25rem",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "0.5rem",
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>Date</span>
          <input
            type="date"
            name="date"
            defaultValue={date}
            style={filterStyle}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>Status</span>
          <select name="status" defaultValue={status} style={filterStyle}>
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No Show</option>
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>Type</span>
          <select name="type" defaultValue={type} style={filterStyle}>
            <option value="all">All types</option>
            <option value="online">Online</option>
            <option value="walkin">Walk-in</option>
            <option value="home_service">Home Service</option>
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>Therapist</span>
          <select name="staffId" defaultValue={staffId} style={filterStyle}>
            <option value="all">All therapists</option>
            {therapistOptions.map((staffMember) => (
              <option key={staffMember.id} value={staffMember.id}>
                {staffMember.full_name}
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: "flex", alignItems: "end" }}>
          <button type="submit" className="cs-btn cs-btn-ghost cs-btn-sm">
            Apply Filters
          </button>
        </div>
      </form>

      {bookings.length === 0 ? (
        <EmptyState title="No bookings found" description={`No bookings matched your filters for ${formatDate(date)}.`} />
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
            const customer = firstRelation(booking.customers);
            const service = firstRelation(booking.services);
            const staff = firstRelation(booking.staff);

            return (
              <div
                key={booking.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.875rem",
                  padding: "0.875rem 1rem",
                  borderBottom: i < bookings.length - 1 ? "1px solid var(--cs-border)" : "none",
                }}
              >
                <div style={{ minWidth: 96, flexShrink: 0 }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
                    {formatDate(booking.booking_date)}
                  </div>
                  <div style={{ fontSize: "0.8125rem", fontWeight: 600 }}>
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
                    {customer?.full_name ?? "Guest"}
                    {customer?.phone && (
                      <span style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", marginLeft: 8 }}>
                        {customer.phone}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)" }}>
                    {service?.name ?? "Service"} · {staff?.full_name ?? "Unassigned"}
                    {booking.type === "home_service" && booking.travel_buffer_mins ? (
                      <span style={{ color: "var(--cs-sand)", marginLeft: 6 }}>
                        +{booking.travel_buffer_mins}min travel
                      </span>
                    ) : null}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <BookingTypeBadge type={booking.type} />
                  <BookingStatusBadge status={booking.status} />
                  <BookingActionMenu
                    bookingId={booking.id}
                    currentStatus={booking.status}
                    userRole={systemRole}
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

const filterStyle: CSSProperties = {
  height: 36,
  borderRadius: 6,
  border: "1px solid var(--cs-border)",
  padding: "0 0.625rem",
  fontSize: "0.8125rem",
  backgroundColor: "var(--cs-surface)",
  color: "var(--cs-text)",
};
