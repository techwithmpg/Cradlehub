import Link from "next/link";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { StatCard } from "@/components/features/dashboard/stat-card";
import { EmptyState } from "@/components/features/dashboard/empty-state";
import { getMyStatsAction } from "../actions";
import { formatCurrency } from "@/lib/utils";

type StatsResult =
  | { error: string }
  | {
      total_assigned: number;
      completed: number;
      cancelled: number;
      no_show: number;
      revenue_generated: number;
    };

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
  const month = clampMonth(Number.isFinite(monthParam) ? Math.floor(monthParam) : now.getMonth() + 1);

  const result = (await getMyStatsAction(year, month)) as StatsResult;

  const prevDate = new Date(year, month - 2, 1);
  const nextDate = new Date(year, month, 1);
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const isFuture = nextDate > currentMonthStart;

  if ("error" in result) {
    return (
      <div
        style={{
          padding: "2rem",
          textAlign: "center",
          color: "var(--ch-text-muted)",
          fontSize: "0.875rem",
        }}
      >
        {result.error}
      </div>
    );
  }

  const stats = result;
  const completionRate =
    stats.total_assigned > 0 ? Math.round((stats.completed / stats.total_assigned) * 100) : 0;

  return (
    <div>
      <PageHeader title="My Stats" description={getMonthLabel(year, month)} />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          marginBottom: "1.5rem",
        }}
      >
        <Link
          href={`/staff-portal/stats?year=${prevDate.getFullYear()}&month=${prevDate.getMonth() + 1}`}
          style={{
            padding: "5px 12px",
            borderRadius: 6,
            border: "1px solid var(--ch-border)",
            backgroundColor: "var(--ch-surface)",
            color: "var(--ch-text-muted)",
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
            color: "var(--ch-text)",
            minWidth: 140,
            textAlign: "center",
          }}
        >
          {getMonthLabel(year, month)}
        </span>
        {!isFuture && (
          <Link
            href={`/staff-portal/stats?year=${nextDate.getFullYear()}&month=${nextDate.getMonth() + 1}`}
            style={{
              padding: "5px 12px",
              borderRadius: 6,
              border: "1px solid var(--ch-border)",
              backgroundColor: "var(--ch-surface)",
              color: "var(--ch-text-muted)",
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
              backgroundColor: "var(--ch-surface)",
              border: "1px solid var(--ch-border)",
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
              <div style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--ch-text-muted)" }}>
                Completion Rate
              </div>
              <div
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  color:
                    completionRate >= 80
                      ? "var(--ch-staff-text)"
                      : completionRate >= 60
                        ? "var(--ch-accent)"
                        : "var(--ch-crm-text)",
                }}
              >
                {completionRate}%
              </div>
            </div>

            <div
              style={{
                height: 8,
                backgroundColor: "var(--ch-border)",
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
                      ? "var(--ch-staff-text)"
                      : completionRate >= 60
                        ? "var(--ch-accent)"
                        : "var(--ch-crm-text)",
                  transition: "width 0.5s ease",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "0.5rem",
                fontSize: "0.75rem",
                color: "var(--ch-text-subtle)",
              }}
            >
              <span>{stats.completed} completed</span>
              <span>{stats.total_assigned} assigned</span>
            </div>
          </div>

          <div
            style={{
              backgroundColor: "var(--ch-surface)",
              border: "1px solid var(--ch-border)",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            {[
              {
                label: "Completed sessions",
                value: stats.completed,
                color: "var(--ch-staff-text)",
                pct: completionRate,
              },
              {
                label: "Cancellations",
                value: stats.cancelled,
                color: "var(--ch-text-subtle)",
                pct:
                  stats.total_assigned > 0
                    ? Math.round((stats.cancelled / stats.total_assigned) * 100)
                    : 0,
              },
              {
                label: "No shows",
                value: stats.no_show,
                color: "var(--ch-accent)",
                pct:
                  stats.total_assigned > 0
                    ? Math.round((stats.no_show / stats.total_assigned) * 100)
                    : 0,
              },
            ].map((row, i, arr) => (
              <div
                key={row.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.75rem 1rem",
                  borderBottom: i < arr.length - 1 ? "1px solid var(--ch-border)" : "none",
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    backgroundColor: row.color,
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, fontSize: "0.875rem", color: "var(--ch-text)" }}>{row.label}</div>
                <div
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--ch-text-muted)",
                    minWidth: 32,
                    textAlign: "right",
                  }}
                >
                  {row.pct}%
                </div>
                <div
                  style={{
                    fontSize: "0.9375rem",
                    fontWeight: 600,
                    color: "var(--ch-text)",
                    minWidth: 24,
                    textAlign: "right",
                  }}
                >
                  {row.value}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: "0.75rem",
              fontSize: "0.75rem",
              color: "var(--ch-text-subtle)",
              textAlign: "center",
            }}
          >
            Revenue figures based on service prices at time of booking.
          </div>
        </>
      )}
    </div>
  );
}
