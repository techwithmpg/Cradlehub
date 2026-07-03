import Link from "next/link";
import {
  BadgeCheck,
  Building2,
  CalendarCheck,
  ChevronRight,
  ClipboardList,
  FileText,
  PhilippinePeso,
  Sparkles,
  TriangleAlert,
  Users,
  Zap,
} from "lucide-react";
import { BranchPerformanceCard } from "./branch-performance-card";
import { DashboardPanel, EmptyState, SectionError } from "./dashboard-panel";
import { AttendanceScanFeedCard } from "@/components/features/attendance/attendance-scan-feed-card";
import {
  formatCurrency,
  formatCurrencyDelta,
  formatDelta,
} from "./format";
import { RevenueTrendCard } from "./revenue-trend-card";
import { TodayGlanceCard } from "./today-glance-card";
import type { OwnerOverviewDashboardData } from "@/lib/queries/owner-dashboard";
import type { AttendanceScanFeedData } from "@/lib/attendance/types";
import type {
  DashboardLoad,
  OwnerDashboardActionItem,
  OwnerDashboardKpis,
  OwnerDashboardPayrollSnapshot,
  OwnerDashboardStaffSnapshot,
} from "@/lib/owner/dashboard";
import type { LucideIcon } from "lucide-react";

export function OwnerDashboard({
  data,
  attendanceScanFeed,
}: {
  data: OwnerOverviewDashboardData;
  attendanceScanFeed: AttendanceScanFeedData;
}) {
  return (
    <div className="space-y-4">
      <OwnerHero data={data} />
      <AttentionBanner load={data.attention} />
      <KpiGrid load={data.kpis} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
        <TodayGlanceCard load={data.todayGlance} />
        <BranchPerformanceCard load={data.branchPerformance} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(290px,0.85fr)_minmax(320px,1fr)]">
        <div className="space-y-4">
          <RevenueTrendCard load={data.revenueTrend} />
          <PayrollSnapshotCard load={data.payroll} />
        </div>
        <StaffSnapshotCard load={data.staffSnapshot} />
        <div className="space-y-4">
          <AttendanceScanFeedCard
            workspace="owner"
            selectedDate={data.today}
            feed={attendanceScanFeed}
          />
          <QuickActionsCard />
          <PendingActionsCard load={data.pendingActions} />
        </div>
      </div>
    </div>
  );
}

function OwnerHero({ data }: { data: OwnerOverviewDashboardData }) {
  const attentionCount =
    data.attention.status === "ready" ? data.attention.data.length : null;
  const activeBranches =
    data.kpis.status === "ready" ? data.kpis.data.activeBranches : null;
  const activeStaff =
    data.kpis.status === "ready" ? data.kpis.data.activeStaff : null;

  return (
    <section className="relative overflow-hidden rounded-lg bg-[#082f20] px-5 py-6 text-white shadow-sm md:px-7">
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(183,138,66,0.28),transparent_32%),linear-gradient(90deg,transparent,rgba(255,255,255,0.06))]" />
      <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,1fr)_auto] lg:items-center">
        <div>
          <p className="text-sm font-medium text-[#efd8a0]">
            Welcome back, {data.ownerName}
          </p>
          <h1 className="mt-2 font-heading text-3xl font-semibold tracking-normal md:text-4xl">
            Owner&apos;s Suite
          </h1>
          <p className="mt-2 text-sm text-white/80">{data.todayLabel}</p>
        </div>
        <div className="border-white/20 text-sm text-white/90 lg:border-l lg:pl-8">
          <p className="font-semibold text-[#efd8a0]">
            Here&apos;s how your spa is performing today.
          </p>
          <p className="mt-2 leading-6">
            {activeBranches === null || activeStaff === null
              ? "Some dashboard metrics are temporarily unavailable."
              : `${activeBranches} branches are active with ${activeStaff} team members.`}
          </p>
          <p className="leading-6">
            {attentionCount === null
              ? "Attention items are still being checked."
              : `You have ${attentionCount} items that need your attention.`}
          </p>
        </div>
        <Link
          href="/owner/reports"
          className="inline-flex h-10 w-fit items-center gap-2 rounded-full border border-[#c99d53] px-4 text-sm font-semibold text-[#efd8a0] transition hover:bg-white/10"
        >
          View full report
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

function AttentionBanner({
  load,
}: {
  load: DashboardLoad<OwnerDashboardActionItem[]>;
}) {
  if (load.status === "error") {
    return (
      <section className="flex items-start gap-3 rounded-lg border border-[var(--cs-warning)]/30 bg-[var(--cs-warning-bg)] px-4 py-3 text-sm text-[var(--cs-warning-text)]">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-semibold">Attention items could not load.</p>
          <p className="text-[var(--cs-text-muted)]">{load.message}</p>
        </div>
      </section>
    );
  }

  const items = load.data;
  const preview = items.slice(0, 2);

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-[#e4d6bd] bg-[#fffaf2] px-4 py-3 text-sm text-[#7c5727] shadow-sm lg:flex-row lg:items-center">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-[#9b7336] ring-1 ring-[#e4d6bd]">
          <TriangleAlert className="size-4" aria-hidden="true" />
        </span>
        <p className="font-semibold text-[var(--cs-text)]">
          {items.length === 0
            ? "No owner items need your attention"
            : `${items.length} ${items.length === 1 ? "item" : "items"} need your attention`}
        </p>
      </div>
      {preview.length > 0 ? (
        <div className="flex min-w-0 flex-1 flex-wrap gap-x-3 gap-y-1">
          {preview.map((item) => (
            <span key={`${item.source}-${item.id}`} className="truncate">
              {item.title}
            </span>
          ))}
          {items.length > preview.length ? (
            <span>{items.length - preview.length} more</span>
          ) : null}
        </div>
      ) : (
        <p className="flex-1 text-[var(--cs-text-muted)]">
          The queue is clear right now.
        </p>
      )}
      <Link
        href="/owner/notifications"
        className="inline-flex h-9 items-center justify-center rounded-md border border-[#c99d53]/60 bg-white px-4 text-sm font-semibold text-[#0b3b27] transition hover:bg-[#f7eddd]"
      >
        Review now
      </Link>
    </section>
  );
}

function KpiGrid({ load }: { load: DashboardLoad<OwnerDashboardKpis> }) {
  if (load.status === "error") {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {["Today's bookings", "Completed today", "Today's revenue", "Active branches", "Team members"].map(
          (label) => (
            <KpiErrorCard key={label} label={label} message={load.message} />
          )
        )}
      </div>
    );
  }

  const kpis = load.data;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <KpiCard
        icon={CalendarCheck}
        label="Today's Bookings"
        value={kpis.todayBookings.toLocaleString("en-PH")}
        sub={formatDelta(kpis.todayBookings, kpis.yesterdayBookings)}
      />
      <KpiCard
        icon={BadgeCheck}
        label="Completed Today"
        value={kpis.completedToday.toLocaleString("en-PH")}
        sub={formatDelta(kpis.completedToday, kpis.completedYesterday)}
      />
      <KpiCard
        icon={PhilippinePeso}
        label="Today's Revenue"
        value={formatCurrency(kpis.todayRevenue)}
        sub={formatCurrencyDelta(kpis.todayRevenue, kpis.yesterdayRevenue)}
      />
      <KpiCard
        icon={Building2}
        label="Active Branches"
        value={kpis.activeBranches.toLocaleString("en-PH")}
        sub="open for operations"
      />
      <KpiCard
        icon={Users}
        label="Team Members"
        value={kpis.activeStaff.toLocaleString("en-PH")}
        sub={
          kpis.newStaffThisWeek > 0
            ? `+${kpis.newStaffThisWeek} new this week`
            : "on roster"
        }
        positive={kpis.newStaffThisWeek > 0}
      />
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  positive,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  positive?: boolean;
}) {
  return (
    <article className="rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#ede8dc] text-[#0b3b27]">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--cs-text-muted)]">
            {label}
          </p>
          <p className="mt-1 font-heading text-2xl font-semibold text-[var(--cs-text)]">
            {value}
          </p>
          <p
            className={
              positive
                ? "mt-1 text-xs font-medium text-[#0b6b3a]"
                : "mt-1 text-xs text-[var(--cs-text-muted)]"
            }
          >
            {sub}
          </p>
        </div>
      </div>
    </article>
  );
}

function KpiErrorCard({ label, message }: { label: string; message: string }) {
  return (
    <article className="rounded-lg border border-[var(--cs-warning)]/25 bg-[var(--cs-surface)] p-4 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--cs-text-muted)]">
        {label}
      </p>
      <p className="mt-3 font-heading text-lg font-semibold text-[var(--cs-warning-text)]">
        Unavailable
      </p>
      <p className="mt-1 line-clamp-2 text-xs text-[var(--cs-text-muted)]">
        {message}
      </p>
    </article>
  );
}

function StaffSnapshotCard({
  load,
}: {
  load: DashboardLoad<OwnerDashboardStaffSnapshot>;
}) {
  return (
    <DashboardPanel title="Staff Snapshot" icon={Users} className="h-full">
      {load.status === "error" ? (
        <SectionError message={load.message} />
      ) : (
        <div className="px-4 py-4">
          <div className="grid grid-cols-3 gap-3 border-b border-[var(--cs-border-soft)] pb-4">
            <Metric label="Total staff" value={load.data.totalStaff} />
            <Metric label="On shift" value={load.data.onShift} positive />
            <Metric label="Off" value={load.data.offShift} muted />
          </div>

          <div className="mt-5 space-y-4">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--cs-text-muted)]">
              Top Roles On Shift
            </p>
            {load.data.topRoles.length === 0 ? (
              <p className="text-sm text-[var(--cs-text-muted)]">
                No scheduled staff for today.
              </p>
            ) : (
              load.data.topRoles.map((role) => (
                <div
                  key={role.label}
                  className="grid grid-cols-[minmax(0,1fr)_minmax(90px,1fr)_32px] items-center gap-3 text-sm"
                >
                  <span className="truncate text-[var(--cs-text)]">
                    {role.label}
                  </span>
                  <span className="h-2 rounded-full bg-[#eee5d7]">
                    <span
                      className="block h-full rounded-full bg-[#0b3b27]"
                      style={{ width: `${role.percent}%` }}
                    />
                  </span>
                  <span className="text-right text-xs text-[var(--cs-text-muted)]">
                    {role.count}
                  </span>
                </div>
              ))
            )}
          </div>

          <Link
            href="/owner/staff"
            className="mt-7 inline-flex w-full items-center justify-between border-t border-[var(--cs-border-soft)] pt-4 text-sm font-semibold text-[#0b3b27]"
          >
            View staff roster
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      )}
    </DashboardPanel>
  );
}

function PayrollSnapshotCard({
  load,
}: {
  load: DashboardLoad<OwnerDashboardPayrollSnapshot>;
}) {
  return (
    <DashboardPanel
      title="Payroll Snapshot"
      icon={PhilippinePeso}
      action={
        <Link
          href="/owner/payroll"
          className="inline-flex h-8 items-center rounded-md border border-[#c99d53]/60 px-3 text-xs font-semibold text-[#0b3b27] transition hover:bg-[#f7eddd]"
        >
          View payroll
        </Link>
      }
    >
      {load.status === "error" ? (
        <SectionError message={load.message} />
      ) : (
        <div className="px-4 py-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <MoneyMetric label="Est. payroll cost" value={load.data.estimatedCost} />
            <MoneyMetric label="Paid to date" value={load.data.paidToDate} />
            <MoneyMetric label="Pending" value={load.data.pending} />
          </div>
          <div className="mt-4 h-2 rounded-full bg-[#eee5d7]">
            <div
              className="h-full rounded-full bg-[#0b3b27]"
              style={{ width: `${load.data.progress}%` }}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--cs-text-muted)]">
            <span>
              {load.data.paidStaff} paid · {load.data.unpaidStaff} unpaid
            </span>
            <span>Next payroll: {load.data.nextPayrollDateLabel}</span>
          </div>
          {load.data.needsSetup ? (
            <p className="mt-3 rounded-md bg-[#fff6e5] px-3 py-2 text-xs font-medium text-[#8a5b1d]">
              {load.data.missingSalaryCount} team member
              {load.data.missingSalaryCount === 1 ? "" : "s"} need monthly pay setup.
            </p>
          ) : null}
        </div>
      )}
    </DashboardPanel>
  );
}

function QuickActionsCard() {
  const actions = [
    { href: "/owner/staff/new", label: "Invite staff member", icon: Users },
    { href: "/owner/services/new", label: "Add new service", icon: Sparkles },
    { href: "/owner/branches", label: "Manage branches", icon: Building2 },
    { href: "/owner/bookings", label: "View all bookings", icon: ClipboardList },
  ];

  return (
    <DashboardPanel title="Quick Actions" icon={Zap}>
      <div className="divide-y divide-[var(--cs-border-soft)] px-4 py-2">
        {actions.map((action) => (
          <QuickActionLink key={action.href} action={action} />
        ))}
      </div>
    </DashboardPanel>
  );
}

function QuickActionLink({
  action,
}: {
  action: { href: string; label: string; icon: LucideIcon };
}) {
  const Icon = action.icon;

  return (
    <Link
      href={action.href}
      className="flex items-center gap-3 py-3 text-sm font-medium text-[var(--cs-text)] transition hover:text-[#0b3b27]"
    >
      <Icon className="size-4 text-[#9b7336]" aria-hidden="true" />
      <span className="flex-1">{action.label}</span>
      <ChevronRight className="size-4 text-[var(--cs-text-muted)]" aria-hidden="true" />
    </Link>
  );
}

function PendingActionsCard({
  load,
}: {
  load: DashboardLoad<OwnerDashboardActionItem[]>;
}) {
  return (
    <DashboardPanel
      title="Pending Actions"
      icon={FileText}
      action={
        load.status === "ready" && load.data.length > 0 ? (
          <span className="rounded-full bg-[#bd8840] px-2 py-0.5 text-xs font-bold text-white">
            {load.data.length}
          </span>
        ) : null
      }
    >
      {load.status === "error" ? (
        <SectionError message={load.message} />
      ) : load.data.length === 0 ? (
        <EmptyState
          title="No pending actions"
          description="There are no owner workflow tasks or action-required notifications right now."
        />
      ) : (
        <div className="divide-y divide-[var(--cs-border-soft)] px-4 py-2">
          {load.data.slice(0, 4).map((item) => (
            <Link
              key={`${item.source}-${item.id}`}
              href={item.action_href ?? "/owner/notifications"}
              className="flex items-center gap-3 py-3 text-sm transition hover:text-[#0b3b27]"
            >
              <FileText className="size-4 shrink-0 text-[#9b7336]" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-[var(--cs-text)]">
                  {item.title}
                </span>
                {item.body ? (
                  <span className="block truncate text-xs text-[var(--cs-text-muted)]">
                    {item.body}
                  </span>
                ) : null}
              </span>
              <ChevronRight className="size-4 shrink-0 text-[var(--cs-text-muted)]" aria-hidden="true" />
            </Link>
          ))}
          <Link
            href="/owner/notifications"
            className="inline-flex w-full items-center justify-between py-3 text-sm font-semibold text-[#0b3b27]"
          >
            View all actions
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      )}
    </DashboardPanel>
  );
}

function Metric({
  label,
  value,
  positive,
  muted,
}: {
  label: string;
  value: number;
  positive?: boolean;
  muted?: boolean;
}) {
  return (
    <div>
      <p className="font-heading text-2xl font-semibold text-[var(--cs-text)]">
        {value.toLocaleString("en-PH")}
      </p>
      <p
        className={
          positive
            ? "text-xs font-medium text-[#0b6b3a]"
            : muted
              ? "text-xs text-[var(--cs-text-muted)]"
              : "text-xs text-[var(--cs-text)]"
        }
      >
        {label}
      </p>
    </div>
  );
}

function MoneyMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--cs-text-muted)]">
        {label}
      </p>
      <p className="mt-1 font-heading text-xl font-semibold text-[var(--cs-text)]">
        {formatCurrency(value)}
      </p>
    </div>
  );
}
