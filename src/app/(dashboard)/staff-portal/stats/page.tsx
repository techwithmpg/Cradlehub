import Link from "next/link";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { StatCard } from "@/components/features/dashboard/stat-card";
import { EmptyState } from "@/components/features/dashboard/empty-state";
import { BasicStaffStats } from "@/components/features/staff-portal/basic/basic-staff-stats";
import { getMyStatsAction, getMyMonthlyScheduleStatsAction, getMyProfileAction } from "../actions";
import { getStaffPortalMode, isBasicStaffMode } from "@/lib/staff/get-staff-portal-mode";
import { formatCurrency } from "@/lib/utils";
import type { StaffPortalStaff } from "@/components/features/staff-portal/types";
import type { MonthlyScheduleStats } from "../actions";

// ── Booking-based stats result type ──────────────────────────────────────────
type BookingStatsResult =
  | { error: string }
  | {
      total_assigned: number;
      completed: number;
      cancelled: number;
      no_show: number;
      revenue_generated: number;
    };

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMonthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
  });
}

function clampMonth(month: number): number {
  if (month < 1) return 1;
  if (month > 12) return 12;
  return month;
}

// ── Booking stats view (for therapist/driver staff) ───────────────────────────

function BookingStatsView({
  stats,
  year,
  month,
  prevHref,
  nextHref,
  isFuture,
}: {
  stats: Exclude<BookingStatsResult, { error: string }>;
  year: number;
  month: number;
  prevHref: string;
  nextHref: string;
  isFuture: boolean;
}) {
  const monthLabel = getMonthLabel(year, month);
  const completionRate =
    stats.total_assigned > 0
      ? Math.round((stats.completed / stats.total_assigned) * 100)
      : 0;

  return (
    <div>
      <PageHeader title="My Stats" description={monthLabel} />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          marginBottom: "1.5rem",
        }}
      >
        <Link
          href={prevHref}
          style={{
            padding: "5px 12px",
            borderRadius: 6,
            border: "1px solid var(--cs-border)",
            backgroundColor: "var(--cs-surface)",
            color: "var(--cs-text-muted)",
            fontSize: "0.8125rem",
            textDecoration: "none",
          }}
        >
          ← Prev
        </Link>
        <span
          style={{
            fontSize: "0.875rem",
            fontWeight: 500,
            color: "var(--cs-text)",
            minWidth: 140,
            textAlign: "center",
          }}
        >
          {monthLabel}
        </span>
        {!isFuture && (
          <Link
            href={nextHref}
            style={{
              padding: "5px 12px",
              borderRadius: 6,
              border: "1px solid var(--cs-border)",
              backgroundColor: "var(--cs-surface)",
              color: "var(--cs-text-muted)",
              fontSize: "0.8125rem",
              textDecoration: "none",
            }}
          >
            Next →
          </Link>
        )}
      </div>

      {stats.total_assigned === 0 ? (
        <EmptyState
          title="No data for this month"
          description="No bookings were assigned during this period."
        />
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: "0.75rem",
              marginBottom: "1.5rem",
            }}
          >
            <StatCard label="Assigned" value={stats.total_assigned} sub="total bookings" />
            <StatCard
              label="Completed"
              value={stats.completed}
              sub={`${completionRate}% completion rate`}
              accent
            />
            <StatCard
              label="Revenue"
              value={formatCurrency(stats.revenue_generated)}
              sub="from completed sessions"
              accent
            />
            <StatCard label="Cancelled" value={stats.cancelled} />
            <StatCard label="No Shows" value={stats.no_show} />
          </div>

          <div
            style={{
              backgroundColor: "var(--cs-surface)",
              border: "1px solid var(--cs-border)",
              borderRadius: 10,
              padding: "1.25rem",
              marginBottom: "1rem",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: "0.75rem",
              }}
            >
              <div style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--cs-text-muted)" }}>
                Completion Rate
              </div>
              <div
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  color:
                    completionRate >= 80
                      ? "var(--cs-success)"
                      : completionRate >= 60
                      ? "var(--cs-sand)"
                      : "var(--cs-manager-accent)",
                }}
              >
                {completionRate}%
              </div>
            </div>

            <div
              style={{
                height: 8,
                backgroundColor: "var(--cs-border)",
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${completionRate}%`,
                  borderRadius: 4,
                  backgroundColor:
                    completionRate >= 80
                      ? "var(--cs-success)"
                      : completionRate >= 60
                      ? "var(--cs-sand)"
                      : "var(--cs-manager-accent)",
                  transition: "width 0.5s ease",
                }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function StaffStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const now = new Date();
  const resolvedSearchParams = await searchParams;

  const yearParam = Number(resolvedSearchParams.year ?? now.getFullYear());
  const monthParam = Number(resolvedSearchParams.month ?? now.getMonth() + 1);
  const year = Number.isFinite(yearParam) ? Math.floor(yearParam) : now.getFullYear();
  const month = clampMonth(
    Number.isFinite(monthParam) ? Math.floor(monthParam) : now.getMonth() + 1
  );

  const prevDate = new Date(year, month - 2, 1);
  const nextDate = new Date(year, month, 1);
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const isFuture = nextDate > currentMonthStart;

  const prevHref = `/staff-portal/stats?year=${prevDate.getFullYear()}&month=${prevDate.getMonth() + 1}`;
  const nextHref = `/staff-portal/stats?year=${nextDate.getFullYear()}&month=${nextDate.getMonth() + 1}`;

  // Determine staff mode
  const profileResult = await getMyProfileAction();
  const staffForMode = "error" in profileResult ? null : (profileResult.staff as StaffPortalStaff);
  const mode = staffForMode ? getStaffPortalMode(staffForMode) : "basic";
  const isBasic = isBasicStaffMode(mode);

  if (isBasic) {
    // Basic staff: schedule-based stats
    const scheduleStatsResult = await getMyMonthlyScheduleStatsAction(year, month);

    if ("error" in scheduleStatsResult) {
      return (
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--cs-text-muted)", fontSize: "0.875rem" }}>
          {scheduleStatsResult.error}
        </div>
      );
    }

    const monthLabel = getMonthLabel(year, month);

    return (
      <>
        {/* Mobile: full-screen stats with bottom nav */}
        <div className="block md:hidden">
          <BasicStaffStats
            stats={scheduleStatsResult as MonthlyScheduleStats}
            monthLabel={monthLabel}
            prevHref={prevHref}
            nextHref={nextHref}
            isFuture={isFuture}
          />
        </div>

        {/* Desktop: inline stats cards */}
        <div className="hidden md:block">
          <BasicStaffStats
            stats={scheduleStatsResult as MonthlyScheduleStats}
            monthLabel={monthLabel}
            prevHref={prevHref}
            nextHref={nextHref}
            isFuture={isFuture}
          />
        </div>
      </>
    );
  }

  // Therapist / driver: booking-based stats (existing behavior)
  const result = (await getMyStatsAction(year, month)) as BookingStatsResult;

  if ("error" in result) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "var(--cs-text-muted)", fontSize: "0.875rem" }}>
        {result.error}
      </div>
    );
  }

  return (
    <BookingStatsView
      stats={result}
      year={year}
      month={month}
      prevHref={prevHref}
      nextHref={nextHref}
      isFuture={isFuture}
    />
  );
}
