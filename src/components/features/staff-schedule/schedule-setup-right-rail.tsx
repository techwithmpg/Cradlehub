import type { ReactNode } from "react";
import { CalendarCheck, ChevronRight, Target, Users, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StaffScheduleItem } from "./staff-schedule-list";
import type { StaffGroupScheduleRule } from "@/lib/queries/staff-schedule-groups";
import {
  countDiffDays,
  getGroupScheduleConfig,
  getVisibleShiftKinds,
  hasActiveIndividualSchedule,
  rulesToPatternForGroup,
  schedulesToPatternForGroup,
  type ShiftKind,
} from "./schedule-rule-builder-utils";

type ScheduleSetupRightRailProps = {
  selectedGroup: string;
  groupItems: StaffScheduleItem[];
  groupRules: StaffGroupScheduleRule[];
  onSelectTab?: (tab: "individual" | "overrides" | "coverage") => void;
};

function todayLabel(): string {
  const date = new Date();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
  return `${months[date.getMonth()] ?? "Jan"} ${date.getDate()}, ${date.getFullYear()}`;
}

function percent(count: number, total: number): number {
  if (total === 0) return 0;
  return Math.min(100, Math.round((count / total) * 100));
}

function widthClass(value: number): string {
  if (value <= 0) return "w-0";
  if (value <= 20) return "w-1/5";
  if (value <= 40) return "w-2/5";
  if (value <= 60) return "w-3/5";
  if (value <= 80) return "w-4/5";
  return "w-full";
}

function railShiftLabel(kind: ShiftKind): string {
  if (kind === "opening") return "Opening Coverage";
  if (kind === "closing") return "Closing Coverage";
  return "Regular Coverage";
}

function RailCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white/85 p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="grid size-9 place-items-center rounded-full bg-emerald-50 text-emerald-900">
          {icon}
        </div>
        <h3 className="text-sm font-bold text-stone-950">{title}</h3>
      </div>
      {children}
    </section>
  );
}

export function CoverageTodayCard({
  selectedGroup,
  groupItems,
  onSelectTab,
}: ScheduleSetupRightRailProps) {
  const visibleKinds = getVisibleShiftKinds(selectedGroup);
  const todayDow = new Date().getDay();
  const totalStaff = groupItems.length;
  const scheduledToday = groupItems.filter((item) =>
    item.schedules.some((schedule) => schedule.day_of_week === todayDow && schedule.is_active)
  ).length;

  return (
    <RailCard title="Coverage Today" icon={<Target className="size-4" />}>
      <div className="mb-4 flex items-center justify-between text-xs">
        <span className="font-medium text-stone-500">{todayLabel()}</span>
        <span className="rounded-full bg-amber-50 px-2 py-0.5 font-bold text-amber-800">
          Moderate
        </span>
      </div>
      <div className="space-y-4">
        {visibleKinds.map((kind) => {
          const count = groupItems.filter((item) =>
            item.schedules.some(
              (schedule) =>
                schedule.day_of_week === todayDow &&
                schedule.is_active &&
                schedule.shift_type === (kind === "regular" ? "single" : kind)
            )
          ).length;
          const fill = percent(count, totalStaff);

          return (
            <div key={kind}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-semibold text-stone-600">{railShiftLabel(kind)}</span>
                <span className="font-black text-stone-950">
                  {count} / {totalStaff || 0} staff
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                <div
                  className={cn(
                    "h-full rounded-full",
                    widthClass(fill),
                    kind === "closing"
                      ? "bg-blue-800"
                      : kind === "regular"
                        ? "bg-amber-700"
                        : "bg-emerald-800"
                  )}
                />
              </div>
            </div>
          );
        })}
        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-semibold text-stone-600">Total Scheduled</span>
            <span className="font-black text-stone-950">
              {scheduledToday} / {totalStaff || 0} staff
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-stone-100">
            <div
              className={cn(
                "h-full rounded-full bg-stone-700",
                widthClass(percent(scheduledToday, totalStaff))
              )}
            />
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onSelectTab?.("coverage")}
        className="mt-5 flex h-10 items-center justify-center rounded-xl border border-stone-200 bg-stone-50 text-sm font-bold text-stone-800 hover:bg-stone-100"
      >
        View Coverage Issues
      </button>
    </RailCard>
  );
}

export function GroupScheduleSummaryCard({
  selectedGroup,
  groupItems,
  groupRules,
}: ScheduleSetupRightRailProps) {
  const config = getGroupScheduleConfig(selectedGroup);
  const visibleKinds = getVisibleShiftKinds(selectedGroup);
  const groupPattern = rulesToPatternForGroup(groupRules, selectedGroup);
  const totalStaff = groupItems.length;
  const withCustomSchedule = groupItems.filter((item) => {
    if (!hasActiveIndividualSchedule(item)) return false;
    return countDiffDays(
      schedulesToPatternForGroup(item.schedules, selectedGroup),
      groupPattern,
      visibleKinds
    ) > 0;
  }).length;
  const today = new Date().toISOString().slice(0, 10);
  const onLeaveToday = groupItems.filter((item) =>
    item.overrides.some((override) => override.override_date === today && override.is_day_off)
  ).length;
  const followingDefault = Math.max(totalStaff - withCustomSchedule, 0);
  const ruleCount = groupRules.filter((rule) => rule.is_active).length;

  return (
    <RailCard title="Group Summary" icon={<Users className="size-4" />}>
      <div className="mb-4 flex items-center justify-between text-xs">
        <span className="font-medium text-stone-500">{config.label}</span>
        <span className="font-bold text-stone-900">{totalStaff} staff</span>
      </div>
      <div className="space-y-3 text-sm">
        <SummaryRow label="Following Default" value={`${followingDefault} (${percent(followingDefault, totalStaff)}%)`} tone="success" />
        <SummaryRow label="With Custom Schedule" value={`${withCustomSchedule} (${percent(withCustomSchedule, totalStaff)}%)`} tone="warning" />
        <SummaryRow label="On Leave Today" value={`${onLeaveToday} (${percent(onLeaveToday, totalStaff)}%)`} tone="danger" />
      </div>
      <div className="mt-5 flex items-center justify-between rounded-xl border border-stone-100 bg-stone-50 px-4 py-3 text-sm">
        <span className="font-bold text-emerald-900">{ruleCount} active rules</span>
        <ChevronRight className="size-4 text-stone-400" />
      </div>
    </RailCard>
  );
}

function SummaryRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "success" | "warning" | "danger";
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-stone-500">{label}</span>
      <span
        className={
          tone === "success"
            ? "font-black text-emerald-800"
            : tone === "warning"
              ? "font-black text-amber-800"
              : "font-black text-red-700"
        }
      >
        {value}
      </span>
    </div>
  );
}

export function QuickActionsCard({
  onSelectTab,
}: {
  onSelectTab?: (tab: "individual" | "overrides" | "coverage") => void;
}) {
  const links = [
    { label: "View Coverage Issues", tab: "coverage" as const },
    { label: "Open Individual Adjustments", tab: "individual" as const },
    { label: "Open Overrides", tab: "overrides" as const },
  ];

  return (
    <RailCard title="Quick Actions" icon={<Zap className="size-4" />}>
      <div className="space-y-2">
        {links.map((link) => (
          <button
            key={link.tab}
            type="button"
            onClick={() => onSelectTab?.(link.tab)}
            className="flex h-11 items-center justify-between rounded-xl border border-stone-100 bg-stone-50 px-4 text-sm font-bold text-stone-800 hover:bg-amber-50 hover:text-amber-900"
          >
            {link.label}
            <ChevronRight className="size-4" />
          </button>
        ))}
      </div>
    </RailCard>
  );
}

export function ScheduleSetupRightRail(props: ScheduleSetupRightRailProps) {
  return (
    <div className="space-y-4">
      <CoverageTodayCard {...props} />
      <GroupScheduleSummaryCard {...props} />
      <QuickActionsCard onSelectTab={props.onSelectTab} />
      <section className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5 text-sm text-emerald-950">
        <div className="mb-2 flex items-center gap-2 font-bold">
          <CalendarCheck className="size-4" />
          Rule Builder
        </div>
        <p className="leading-6">
          Group rules set the default. Individual Adjustments override these defaults only for selected staff.
        </p>
      </section>
    </div>
  );
}
