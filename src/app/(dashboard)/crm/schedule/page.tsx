import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { DailyScheduleBoard } from "@/components/features/schedule/daily-schedule-board";
import { getDailySchedule } from "@/lib/queries/schedule";
import { getManagerDashboardStats } from "@/lib/queries/bookings";
import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled, getDevBypassLayoutStaff } from "@/lib/dev-bypass";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

async function getCsrContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("staff")
    .select("branch_id, branches(name)")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .single();

  if (!me && isDevAuthBypassEnabled()) {
    const mock = getDevBypassLayoutStaff();
    return {
      branchId: mock.branch_id,
      branchName: mock.branches.name,
    };
  }

  if (!me?.branch_id) redirect("/login");
  return {
    branchId: me.branch_id as string,
    branchName: (me.branches as { name: string } | null)?.name ?? "Your Branch",
  };
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0]!;
}

export default async function CrmSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { branchId, branchName } = await getCsrContext();
  const params = await searchParams;

  const today = new Date().toISOString().split("T")[0]!;
  const selectedDate = params.date ?? today;

  const [scheduleRows, stats] = await Promise.all([
    getDailySchedule({ branchId, date: selectedDate }),
    getManagerDashboardStats(branchId, selectedDate),
  ]);

  const isToday = selectedDate === today;
  const formattedDate = new Date(selectedDate + "T00:00:00").toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div>
      <PageHeader
        title="Schedule"
        description={`${branchName} · ${formattedDate}`}
        icon="📅"
        action={
          <Link
            href="/crm/bookings"
            className="cs-btn cs-btn-primary cs-btn-sm"
            style={{ display: "inline-flex", alignItems: "center" }}
          >
            View Bookings
          </Link>
        }
      />

      {/* Date navigator + stats */}
      <div
        className="cs-card"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.625rem 0.875rem",
          marginBottom: "1.25rem",
          flexWrap: "wrap",
        }}
      >
        <Link
          href={`/crm/schedule?date=${shiftDate(selectedDate, -1)}`}
          className="cs-btn cs-btn-ghost cs-btn-sm"
          aria-label="Previous day"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--cs-text)",
            flex: 1,
            justifyContent: "center",
          }}
        >
          <CalendarDays className="h-4 w-4" style={{ color: "var(--cs-sand)" }} />
          {formattedDate}
          {isToday && (
            <span
              style={{
                fontSize: "0.625rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                padding: "2px 8px",
                borderRadius: 100,
                background: "var(--cs-success-bg)",
                color: "var(--cs-success)",
              }}
            >
              Today
            </span>
          )}
        </div>

        {!isToday && (
          <Link
            href="/crm/schedule"
            className="cs-btn cs-btn-ghost cs-btn-sm"
          >
            Today
          </Link>
        )}

        <Link
          href={`/crm/schedule?date=${shiftDate(selectedDate, 1)}`}
          className="cs-btn cs-btn-ghost cs-btn-sm"
          aria-label="Next day"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>

        {/* Stats inline */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            marginLeft: "auto",
            paddingLeft: "0.75rem",
            borderLeft: "1px solid var(--cs-border)",
          }}
        >
          {[
            { label: "Total", value: stats.total },
            { label: "Confirmed", value: stats.confirmed },
            { label: "In Progress", value: stats.in_progress },
            { label: "Completed", value: stats.completed },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: "center", minWidth: 48 }}>
              <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--cs-text)" }}>
                {s.value}
              </div>
              <div style={{ fontSize: "0.625rem", color: "var(--cs-text-muted)" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      <DailyScheduleBoard
        branchId={branchId}
        date={selectedDate}
        staffRows={scheduleRows}
      />
    </div>
  );
}
