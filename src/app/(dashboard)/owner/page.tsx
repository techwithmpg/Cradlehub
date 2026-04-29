import { PageHeader } from "@/components/features/dashboard/page-header";
import { StatCard } from "@/components/features/dashboard/stat-card";
import { BookingStatusBadge } from "@/components/features/dashboard/booking-status-badge";
import { BookingTypeBadge } from "@/components/features/dashboard/booking-type-badge";
import {
  getOwnerDashboardAction,
  getOwnerBookingsAction,
} from "@/app/(dashboard)/owner/bookings/actions";
import { getAllBranches } from "@/lib/queries/branches";
import { getAllStaff } from "@/lib/queries/staff";
import { formatCurrency, formatTime } from "@/lib/utils";

type BranchSummary = {
  name: string;
  total: number;
  completed: number;
  revenue: number;
};

type OwnerDashboardStats = {
  total_bookings: number;
  total_completed: number;
  total_cancelled: number;
  total_revenue: number;
  by_branch: BranchSummary[];
};

type BranchRel = { name: string } | { name: string }[] | null;
type ServiceRel = { name: string } | { name: string }[] | null;
type StaffRel = { full_name: string } | { full_name: string }[] | null;
type CustomerRel = { full_name: string } | { full_name: string }[] | null;

type OwnerBookingRow = {
  id: string;
  start_time: string;
  type: string;
  status: string;
  branches: BranchRel;
  services: ServiceRel;
  staff: StaffRel;
  customers: CustomerRel;
};

function today(): string {
  return new Date().toISOString().split("T")[0]!;
}

function readName(relation: BranchRel | ServiceRel): string {
  if (!relation) return "—";
  if (Array.isArray(relation)) return relation[0]?.name ?? "—";
  return relation.name;
}

function readFullName(relation: StaffRel | CustomerRel): string {
  if (!relation) return "—";
  if (Array.isArray(relation)) return relation[0]?.full_name ?? "—";
  return relation.full_name;
}

export default async function OwnerOverviewPage() {
  const [statsResult, recentBookingsResult, branches, staff] = await Promise.all([
    getOwnerDashboardAction(today()),
    getOwnerBookingsAction({ fromDate: today(), toDate: today() }),
    getAllBranches(),
    getAllStaff(),
  ]);

  const statsData: OwnerDashboardStats | null =
    "error" in statsResult ? null : (statsResult as OwnerDashboardStats);
  const bookingsData: OwnerBookingRow[] =
    "error" in recentBookingsResult
      ? []
      : (recentBookingsResult as OwnerBookingRow[]);

  return (
    <div>
      <PageHeader
        title="Overview"
        description={`Today — ${new Date().toLocaleDateString("en-PH", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}`}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "0.75rem",
          marginBottom: "2rem",
        }}
      >
        <StatCard
          label="Today's Bookings"
          value={statsData?.total_bookings ?? 0}
          sub="all branches"
          accent
        />
        <StatCard label="Completed" value={statsData?.total_completed ?? 0} sub="today" />
        <StatCard
          label="Revenue Today"
          value={formatCurrency(statsData?.total_revenue ?? 0)}
          sub="completed bookings"
          accent
        />
        <StatCard label="Active Branches" value={branches.length} />
        <StatCard
          label="Total Staff"
          value={staff.filter((s) => s.is_active).length}
          sub="active therapists"
        />
      </div>

      {statsData?.by_branch && statsData.by_branch.length > 0 && (
        <div style={{ marginBottom: "2rem" }}>
          <div
            style={{
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: "var(--ch-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "0.75rem",
            }}
          >
            By Branch
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "0.75rem",
            }}
          >
            {statsData.by_branch.map((b) => (
              <div
                key={b.name}
                style={{
                  backgroundColor: "var(--ch-surface)",
                  border: "1px solid var(--ch-border)",
                  borderRadius: 10,
                  padding: "0.875rem 1rem",
                }}
              >
                <div
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: "var(--ch-text)",
                    marginBottom: "0.5rem",
                  }}
                >
                  {b.name}
                </div>
                <div
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--ch-text-muted)",
                    display: "flex",
                    gap: "1rem",
                  }}
                >
                  <span>{b.total} bookings</span>
                  <span>{b.completed} done</span>
                  <span style={{ color: "var(--ch-accent)" }}>{formatCurrency(b.revenue)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div
          style={{
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--ch-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "0.75rem",
          }}
        >
          Today's Bookings
        </div>

        {bookingsData.length === 0 ? (
          <div
            style={{
              padding: "2rem",
              textAlign: "center",
              color: "var(--ch-text-subtle)",
              fontSize: "0.875rem",
              backgroundColor: "var(--ch-surface)",
              border: "1px solid var(--ch-border)",
              borderRadius: 10,
            }}
          >
            No bookings today yet
          </div>
        ) : (
          <div
            style={{
              backgroundColor: "var(--ch-surface)",
              border: "1px solid var(--ch-border)",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            {bookingsData.map((b, i) => (
              <div
                key={b.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  padding: "0.75rem 1rem",
                  borderBottom: i < bookingsData.length - 1 ? "1px solid var(--ch-border)" : "none",
                }}
              >
                <div
                  style={{
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    color: "var(--ch-text)",
                    minWidth: 52,
                  }}
                >
                  {formatTime(b.start_time)}
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
                    {readFullName(b.customers)}
                  </div>
                  <div
                    style={{
                      fontSize: "0.8125rem",
                      color: "var(--ch-text-muted)",
                    }}
                  >
                    {readName(b.services)} · {readFullName(b.staff)}
                  </div>
                </div>

                <div className="hidden sm:block" style={{ fontSize: "0.75rem", color: "var(--ch-text-subtle)" }}>
                  {readName(b.branches)}
                </div>

                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <BookingTypeBadge type={b.type} />
                  <BookingStatusBadge status={b.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
