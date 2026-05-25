import { ReadinessIssueCard } from "@/components/shared/readiness-issue-card";
import { ReadinessIssueList } from "@/components/shared/readiness-issue-list";
import type { StaffScheduleItem } from "./staff-schedule-list";
import type { StaffGroupScheduleRule } from "@/lib/queries/staff-schedule-groups";
import {
  buildNoGroupOrIndividualIssue,
  buildNoActiveScheduleIssue,
  buildNoOpeningShiftIssue,
  buildOnLeaveTodayIssue,
} from "./schedule-readiness-utils";

type Props = { items: StaffScheduleItem[]; rulesByGroup?: Record<string, StaffGroupScheduleRule[]> };

export function ScheduleCoverageIssues({ items, rulesByGroup }: Props) {
  const today = new Date().toISOString().split("T")[0]!;
  const todayDow = new Date().getDay();

  const noSchedule = items.filter((i) => !i.schedules.some((s) => s.is_active));
  const noOpeningToday = items.filter(
    (i) =>
      i.schedules.some((s) => s.day_of_week === todayDow && s.is_active) &&
      !i.schedules.some((s) => s.day_of_week === todayDow && s.is_active && s.shift_type === "opening")
  );
  const onLeaveToday = items.filter((i) =>
    i.overrides.some((o) => o.override_date === today && o.is_day_off)
  );

  // Staff with no individual schedule AND no group rules
  const noGroupOrIndividual = items.filter((i) => {
    const hasIndividual = i.schedules.some((s) => s.is_active);
    if (hasIndividual) return false;
    const staffType = i.staff.staff_type ?? "";
    const groupKey =
      staffType === "therapist" ? "therapist"
      : staffType === "driver" ? "driver"
      : staffType === "csr" ? "csr"
      : staffType === "utility" ? "utility"
      : staffType === "managerial" ? "managerial"
      : staffType === "nail_tech" || staffType === "salon_head" ? "nail_tech"
      : staffType === "aesthetician" ? "aesthetician"
      : "";
    const groupRules = groupKey ? (rulesByGroup?.[groupKey] ?? []) : [];
    const hasGroupRules = groupRules.some((r) => r.is_active && !r.is_day_off);
    return !hasGroupRules;
  });

  const totalIssues = noSchedule.length + noGroupOrIndividual.length;

  // ── Empty state ───────────────────────────────────────────────────────────────
  if (totalIssues === 0 && noOpeningToday.length === 0 && onLeaveToday.length === 0) {
    return (
      <ReadinessIssueList
        issues={[]}
        emptyTitle="Schedule coverage looks good"
        emptyDescription="No urgent schedule issues found. All staff have weekly schedule coverage configured."
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

      {/* ── No group rules or individual schedule (critical) ── */}
      {noGroupOrIndividual.length > 0 && (
        <IssueGroup>
          <ReadinessIssueCard
            issue={buildNoGroupOrIndividualIssue(noGroupOrIndividual.length)}
            compact
          />
          <StaffGrid>
            {noGroupOrIndividual.map((item) => (
              <IssueCard key={item.staff.id} item={item} tag="No rules" tagColor="var(--cs-error)" />
            ))}
          </StaffGrid>
        </IssueGroup>
      )}

      {/* ── No active individual schedule (warning) ── */}
      {noSchedule.length > 0 && (
        <IssueGroup>
          <ReadinessIssueCard
            issue={buildNoActiveScheduleIssue(noSchedule.length)}
            compact
          />
          <StaffGrid>
            {noSchedule.map((item) => (
              <IssueCard key={item.staff.id} item={item} tag="No schedule" tagColor="var(--cs-warning)" />
            ))}
          </StaffGrid>
        </IssueGroup>
      )}

      {/* ── No opening shift today (warning) ── */}
      {noOpeningToday.length > 0 && (
        <IssueGroup>
          <ReadinessIssueCard
            issue={buildNoOpeningShiftIssue(noOpeningToday.length)}
            compact
          />
          <StaffGrid>
            {noOpeningToday.map((item) => (
              <IssueCard key={item.staff.id} item={item} tag="No opening" tagColor="var(--cs-info)" />
            ))}
          </StaffGrid>
        </IssueGroup>
      )}

      {/* ── On leave today (info) ── */}
      {onLeaveToday.length > 0 && (
        <IssueGroup>
          <ReadinessIssueCard
            issue={buildOnLeaveTodayIssue(onLeaveToday.length)}
            compact
          />
          <StaffGrid>
            {onLeaveToday.map((item) => (
              <IssueCard key={item.staff.id} item={item} tag="Day off" tagColor="var(--cs-text-muted)" />
            ))}
          </StaffGrid>
        </IssueGroup>
      )}

    </div>
  );
}

// ── Layout helpers ─────────────────────────────────────────────────────────────

function IssueGroup({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
      {children}
    </div>
  );
}

function StaffGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: "0.625rem",
        paddingLeft: "0.25rem",
      }}
    >
      {children}
    </div>
  );
}

// ── Per-staff detail card ──────────────────────────────────────────────────────

function IssueCard({
  item,
  tag,
  tagColor,
}: {
  item: StaffScheduleItem;
  tag: string;
  tagColor: string;
}) {
  return (
    <div style={{
      background: "var(--cs-surface)",
      border: "1px solid var(--cs-border-soft)",
      borderRadius: "var(--cs-r-md)",
      padding: "11px 13px",
    }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--cs-text)" }}>{item.staff.full_name}</div>
      <div style={{ fontSize: 10, color: "var(--cs-text-muted)", marginTop: 2, textTransform: "capitalize" }}>
        {(item.staff.staff_type ?? "staff").replace("_", " ")}
        {item.staff.tier ? ` · ${item.staff.tier}` : ""}
      </div>
      <div style={{ marginTop: 7 }}>
        <span style={{
          display: "inline-block", padding: "2px 7px", borderRadius: 10,
          fontSize: 10, fontWeight: 500, background: `${tagColor}20`, color: tagColor,
        }}>{tag}</span>
      </div>
    </div>
  );
}
