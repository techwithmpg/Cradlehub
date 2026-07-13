import Link from "next/link";
import type { CrmSetupHealthData, SetupIssue } from "@/lib/queries/crm-setup";
import { SetupProgressRing } from "./setup-progress-ring";
import { SetupStatusCard } from "./setup-status-card";
import { SetupActionRow } from "./setup-action-row";
import { SetupShortcutCard } from "./setup-shortcut-card";
import { SetupSectionTitle } from "./setup-section-title";

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeProgress(d: CrmSetupHealthData): number {
  let score = 0;
  let total = 0;

  total++;
  if (d.serviceStaffTotal > 0 && d.serviceStaffWithSchedule === d.serviceStaffTotal) score++;

  total++;
  if (d.activeServicesTotal > 0 && d.servicesWithStaff === d.activeServicesTotal) score++;

  total++;
  if (d.activeResourcesTotal > 0) score++;

  total++;
  if (d.hasCustomRules) score++;

  total++;
  if (!d.homeServiceEnabled || d.driversTotal > 0) score++;

  total++;
  if (d.unassignedTodayCount === 0) score++;

  return total === 0 ? 0 : Math.round((score / total) * 100);
}

function classifyIssueSeverity(issue: SetupIssue): "critical" | "warning" | "info" {
  if (issue.severity === "error") return "critical";
  if (issue.severity === "warning") return "warning";
  return "info";
}

function issueIcon(severity: SetupIssue["severity"]): string {
  if (severity === "error") return "⛔";
  if (severity === "warning") return "⚠️";
  return "ℹ️";
}

type StatusCardData = {
  icon: string;
  label: string;
  value: string;
  sub: string;
  status: import("./setup-status-card").SetupStatus;
  actionLabel?: string;
  actionHref?: string;
};

function buildStatusCards(d: CrmSetupHealthData): StatusCardData[] {
  const missingSchedule = d.serviceStaffTotal - d.serviceStaffWithSchedule;
  const servicesWithoutStaff = d.activeServicesTotal - d.servicesWithStaff;

  return [
    {
      icon: "👥",
      label: "Staff Schedules",
      value: `${d.serviceStaffWithSchedule}/${d.serviceStaffTotal}`,
      sub: d.serviceStaffTotal === 0
        ? "No service staff"
        : missingSchedule === 0
          ? "All staff have schedules"
          : `${missingSchedule} need schedules`,
      status: d.serviceStaffTotal === 0 ? "warning" : missingSchedule === 0 ? "ready" : "warning",
      actionLabel: missingSchedule > 0 ? "Fix Schedules" : undefined,
      actionHref: missingSchedule > 0 ? "/crm/schedule?tab=setup" : undefined,
    },
    {
      icon: "✨",
      label: "Service Coverage",
      value: `${d.servicesWithStaff}/${d.activeServicesTotal}`,
      sub: d.activeServicesTotal === 0
        ? "No active services"
        : servicesWithoutStaff === 0
          ? "All services covered"
          : `${servicesWithoutStaff} need providers`,
      status: d.activeServicesTotal === 0 ? "warning" : servicesWithoutStaff === 0 ? "ready" : "warning",
      actionLabel: servicesWithoutStaff > 0 ? "Assign Therapists" : undefined,
      actionHref: servicesWithoutStaff > 0 ? "/crm/services?tab=providers" : undefined,
    },
    {
      icon: "🏠",
      label: "Rooms & Resources",
      value: String(d.activeResourcesTotal),
      sub: d.activeResourcesTotal === 0
        ? "None configured"
        : `${d.activeResourcesTotal} active`,
      status: d.activeResourcesTotal > 0 ? "ready" : "warning",
      actionLabel: d.activeResourcesTotal === 0 ? "Add Resources" : undefined,
      actionHref: d.activeResourcesTotal === 0 ? "/crm/spaces-rules" : undefined,
    },
    {
      icon: "📋",
      label: "Booking Rules",
      value: d.hasCustomRules ? "Custom" : "Defaults",
      sub: d.hasCustomRules
        ? "Custom rules saved"
        : "Using defaults — optional review",
      status: d.hasCustomRules ? "ready" : "info",
    },
    {
      icon: "🚗",
      label: "Home Service",
      value: d.homeServiceEnabled ? "Enabled" : "Disabled",
      sub: d.homeServiceEnabled
        ? `${d.driversTotal} driver${d.driversTotal !== 1 ? "s" : ""}`
        : "Not accepting home-service",
      status: !d.homeServiceEnabled ? "info" : d.driversTotal > 0 ? "ready" : "error",
      actionLabel: d.homeServiceEnabled && d.driversTotal === 0 ? "Add Drivers" : undefined,
      actionHref: "/crm/staff-applications",
    },
    {
      icon: "📅",
      label: "Today's Assignments",
      value: String(d.unassignedTodayCount),
      sub: d.unassignedTodayCount === 0
        ? "All confirmed bookings assigned"
        : `${d.unassignedTodayCount} need therapist`,
      status: d.unassignedTodayCount === 0 ? "ready" : "error",
      actionLabel: d.unassignedTodayCount > 0 ? "Open Work Queue" : undefined,
      actionHref: "/crm/today?filter=exceptions",
    },
  ];
}

const SHORTCUTS = [
  { icon: "🗓️", label: "Fix Schedules", description: "Set up missing staff schedules", href: "/crm/schedule?tab=setup" },
  { icon: "✨", label: "Assign Therapists", description: "Assign providers to services", href: "/crm/services" },
  { icon: "🏠", label: "Edit Rooms & Rules", description: "Manage rooms and booking rules", href: "/crm/spaces-rules" },
  { icon: "📋", label: "Work Queue", description: "Check today's booking exceptions", href: "/crm/today?filter=exceptions" },
  { icon: "🚗", label: "Open Dispatch", description: "Manage home-service trips", href: "/crm/dispatch" },
  { icon: "📊", label: "Work Queue", description: "Return to today's prioritized CRM queue", href: "/crm/today" },
];

const TIPS = [
  "Set staff schedules to increase online availability.",
  "Assign at least one therapist per service.",
  "Keep booking rules updated for holidays.",
  "Add buffer time to reduce back-to-back bookings.",
];

// ── Component ─────────────────────────────────────────────────────────────────

export function SetupHealthContent({ data }: { data: CrmSetupHealthData }) {
  const progress = computeProgress(data);
  const statusCards = buildStatusCards(data);

  const criticalIssues = data.issues.filter((i) => i.severity === "error");
  const warningIssues = data.issues.filter((i) => i.severity === "warning");
  const topIssues = [...criticalIssues, ...warningIssues].slice(0, 3);

  const isAllClear = data.issues.length === 0;

  return (
    <div className="space-y-6">
      {/* ── Top row: Progress + Critical Actions + Tips ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_300px]">
        {/* Overall Progress */}
        <div className="rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-6 shadow-sm">
          <h3 className="text-sm font-bold text-[var(--cs-text)]">Overall Setup Progress</h3>
          <div className="mt-5 flex items-center gap-5">
            <SetupProgressRing percentage={progress} size={110} strokeWidth={9} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--cs-text)]">
                {progress >= 80
                  ? "Your system is mostly ready."
                  : progress >= 50
                    ? "Getting there — a few items left."
                    : "Several items need attention."}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--cs-text-muted)]">
                {isAllClear
                  ? "Everything needed for booking is ready."
                  : `${data.issues.length} item${data.issues.length !== 1 ? "s" : ""} need${data.issues.length === 1 ? "s" : ""} attention to ensure the best booking experience.`}
              </p>
              {!isAllClear && (
                <Link
                  href="#setup-issues"
                  className="mt-3 inline-flex items-center gap-1 rounded-lg border border-[var(--cs-border-soft)] bg-white px-3.5 py-2 text-xs font-semibold text-[var(--cs-sand)] transition-all hover:border-[var(--cs-sand)] hover:bg-[var(--cs-sand-mist)]"
                >
                  View all issues ›
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Critical Actions */}
        <div className="rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-6 shadow-sm">
          <SetupSectionTitle count={topIssues.length}>Critical Actions</SetupSectionTitle>
          <div className="mt-4 space-y-3">
            {topIssues.length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50/70 p-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 text-lg">✅</span>
                <p className="text-sm font-semibold text-green-800">
                  No critical actions. Everything looks good.
                </p>
              </div>
            ) : (
              topIssues.map((issue) => (
                <SetupActionRow
                  key={issue.id}
                  icon={issueIcon(issue.severity)}
                  title={issue.title}
                  description={issue.impact}
                  actionLabel={issue.fixLabel}
                  actionHref={issue.fixHref}
                  severity={classifyIssueSeverity(issue)}
                />
              ))
            )}
          </div>
        </div>

        {/* Setup Tips */}
        <div className="rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-sm">💡</span>
            <h3 className="text-sm font-bold text-[var(--cs-text)]">Setup Tips</h3>
          </div>
          <ul className="mt-4 space-y-2.5">
            {TIPS.map((tip) => (
              <li key={tip} className="flex items-start gap-2.5 text-xs leading-relaxed text-[var(--cs-text-secondary)]">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--cs-sand)]" />
                {tip}
              </li>
            ))}
          </ul>
          <Link
            href="/crm/setup"
            className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[var(--cs-sand)] transition-colors hover:underline"
          >
            View Setup Guide ›
          </Link>
        </div>
      </div>

      {/* ── Setup Area Status Grid ── */}
      <div>
        <SetupSectionTitle>Setup Area Status</SetupSectionTitle>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {statusCards.map((card) => (
            <SetupStatusCard key={card.label} {...card} />
          ))}
        </div>
      </div>

      {/* ── Quick Fix Shortcuts ── */}
      <div>
        <SetupSectionTitle>Quick Fix Shortcuts</SetupSectionTitle>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {SHORTCUTS.map((s) => (
            <SetupShortcutCard key={s.href} {...s} />
          ))}
        </div>
      </div>
    </div>
  );
}
