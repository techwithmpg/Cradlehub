import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { StatCard } from "@/components/features/dashboard/stat-card";
import { BookingStatusBadge } from "@/components/features/dashboard/booking-status-badge";
import { BookingTypeBadge } from "@/components/features/dashboard/booking-type-badge";
import { BookingActionMenu } from "@/components/features/dashboard/booking-action-menu";
import { EmptyState } from "@/components/features/dashboard/empty-state";
import { getManagerDashboardStats, getTodaysSchedule } from "@/lib/queries/bookings";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatTime } from "@/lib/utils";

type Relation<T> = T | T[] | null;

type CustomerRelation = {
  full_name: string;
  phone: string | null;
};

type ServiceRelation = {
  name: string;
};

type StaffRelation = {
  full_name: string;
};

type BookingRow = {
  id: string;
  booking_date: string;
  start_time: string;
  status: string;
  type: string;
  customers: Relation<CustomerRelation>;
  services: Relation<ServiceRelation>;
  staff: Relation<StaffRelation>;
};

type RecentCustomer = {
  id: string;
  full_name: string;
  updated_at: string;
  notes: string | null;
  last_booking_date: string | null;
};

type CrmContext = {
  branchId: string;
  branchName: string;
  systemRole: string;
};

function firstRelation<T>(relation: Relation<T>): T | null {
  if (!relation) return null;
  return Array.isArray(relation) ? (relation[0] ?? null) : relation;
}

function currentTimeKey(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}:00`;
}

function formatUpdatedTime(value: string): string {
  return new Date(value).toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  });
}

async function getCrmContext(): Promise<CrmContext> {
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
  if (!me?.branch_id || !allowedRoles.includes(me.system_role)) redirect("/crm/bookings");

  return {
    branchId: me.branch_id as string,
    branchName: (me.branches as { name?: string } | null)?.name ?? "Your Branch",
    systemRole: me.system_role,
  };
}

export default async function CrmTodayPage() {
  const { branchId, branchName, systemRole } = await getCrmContext();
  const today = new Date().toISOString().split("T")[0]!;
  const [rawBookings, stats, supabase] = await Promise.all([
    getTodaysSchedule(branchId, today),
    getManagerDashboardStats(branchId, today),
    createClient(),
  ]);

  const { data: recentCustomersRaw } = await supabase
    .from("customers")
    .select("id, full_name, updated_at, notes, last_booking_date")
    .order("updated_at", { ascending: false })
    .limit(6);

  const bookings = rawBookings as BookingRow[];
  const recentCustomers = (recentCustomersRaw ?? []) as RecentCustomer[];

  const nowTime = currentTimeKey();
  const upcoming = bookings.filter(
    (booking) =>
      booking.start_time > nowTime &&
      booking.status !== "cancelled" &&
      booking.status !== "no_show"
  );
  const nextAppointment = upcoming[0] ?? null;
  const walkins = bookings.filter((booking) => booking.type === "walkin").length;
  const cancelledOrNoShow = stats.cancelled + stats.no_show;
  const homeServiceBookings = bookings.filter((booking) => booking.type === "home_service");
  const recentNotes = recentCustomers.filter((customer) => customer.notes && customer.notes.trim().length > 0);

  return (
    <div>
      <PageHeader
        title="Today"
        description={`Daily front-desk operations · ${branchName}`}
        icon="🗓️"
      />

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <Link href="/crm/bookings/new" className="cs-btn cs-btn-primary cs-btn-sm">
          New In-house Booking
        </Link>
        <Link href="/crm/customers#customer-search" className="cs-btn cs-btn-ghost cs-btn-sm">
          Search Customer
        </Link>
        <Link href="/crm/schedule" className="cs-btn cs-btn-ghost cs-btn-sm">
          View Schedule
        </Link>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "0.625rem",
          marginBottom: "1.25rem",
        }}
      >
        <StatCard label="Today's Bookings" value={stats.total} accent />
        <StatCard label="Upcoming" value={upcoming.length} />
        <StatCard label="Walk-ins" value={walkins} />
        <StatCard label="Cancelled / No-show" value={cancelledOrNoShow} />
      </div>

      <div style={{ display: "grid", gap: "1rem", marginBottom: "1rem" }}>
        <section className="cs-card" style={{ padding: "1rem" }}>
          <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.625rem" }}>
            Next Appointment
          </div>
          {!nextAppointment ? (
            <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)" }}>
              No upcoming appointments for the rest of {formatDate(today)}.
            </div>
          ) : (
            <BookingQueueRow booking={nextAppointment} userRole={systemRole} highlight />
          )}
        </section>

        <section className="cs-card" style={{ padding: "1rem" }}>
          <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.625rem" }}>
            Today&apos;s Booking Queue
          </div>
          {bookings.length === 0 ? (
            <EmptyState title="No bookings yet" description="No bookings are scheduled for today." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {bookings.map((booking) => (
                <BookingQueueRow key={booking.id} booking={booking} userRole={systemRole} />
              ))}
            </div>
          )}
        </section>

        <section className="cs-card" style={{ padding: "1rem" }}>
          <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.625rem" }}>
            Home Service Bookings
          </div>
          {homeServiceBookings.length === 0 ? (
            <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)" }}>
              No home service bookings scheduled today.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {homeServiceBookings.map((booking) => (
                <BookingQueueRow key={booking.id} booking={booking} userRole={systemRole} />
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="cs-card" style={{ padding: "1rem" }}>
        <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.625rem" }}>
          {recentNotes.length > 0 ? "Recent Customer Notes" : "Recently Updated Customers"}
        </div>
        <div style={{ display: "grid", gap: "0.5rem" }}>
          {(recentNotes.length > 0 ? recentNotes : recentCustomers).slice(0, 5).map((customer) => (
            <Link
              key={customer.id}
              href={`/crm/${customer.id}`}
              style={{
                padding: "0.625rem 0.75rem",
                border: "1px solid var(--cs-border)",
                borderRadius: 8,
                textDecoration: "none",
                color: "var(--cs-text)",
                backgroundColor: "var(--cs-surface)",
              }}
            >
              <div style={{ fontSize: "0.8125rem", fontWeight: 600 }}>{customer.full_name}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
                Updated {formatUpdatedTime(customer.updated_at)}
                {customer.last_booking_date ? ` · Last visit ${formatDate(customer.last_booking_date)}` : ""}
              </div>
              {customer.notes && (
                <div
                  style={{
                    marginTop: 4,
                    fontSize: "0.75rem",
                    color: "var(--cs-text-muted)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {customer.notes}
                </div>
              )}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function BookingQueueRow({
  booking,
  userRole,
  highlight = false,
}: {
  booking: BookingRow;
  userRole: string;
  highlight?: boolean;
}) {
  const customer = firstRelation(booking.customers);
  const service = firstRelation(booking.services);
  const staff = firstRelation(booking.staff);

  return (
    <div
      style={{
        display: "flex",
        gap: "0.625rem",
        alignItems: "center",
        border: "1px solid var(--cs-border)",
        backgroundColor: highlight ? "var(--cs-sand-mist)" : "var(--cs-surface)",
        borderRadius: 8,
        padding: "0.625rem 0.75rem",
      }}
    >
      <div style={{ minWidth: 52, fontSize: "0.8125rem", fontWeight: 600 }}>
        {formatTime(booking.start_time)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "0.8125rem",
            fontWeight: 600,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {customer?.full_name ?? "Guest"}
        </div>
        <div
          style={{
            fontSize: "0.75rem",
            color: "var(--cs-text-muted)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {service?.name ?? "Service"} · {staff?.full_name ?? "Unassigned"}
        </div>
      </div>
      <BookingTypeBadge type={booking.type} />
      <BookingStatusBadge status={booking.status} />
      <BookingActionMenu bookingId={booking.id} currentStatus={booking.status} userRole={userRole} />
    </div>
  );
}
