"use client";

import {
  ChevronRight,
  Clock3,
  Filter,
  HelpCircle,
  Link2,
  ShieldCheck,
  Smartphone,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill, formatAttendanceDateTime } from "@/components/features/attendance/attendance-ui";
import type {
  RecoveryIssue,
  RecoveryIssueCategory,
} from "@/components/features/attendance/recovery/recovery-issue-types";

const GROUPS: Array<{
  category: RecoveryIssueCategory;
  label: string;
  icon: typeof Smartphone;
}> = [
  { category: "device_access", label: "Device Access Issues", icon: Smartphone },
  { category: "scan_recovery", label: "Scan Recovery Issues", icon: Clock3 },
  { category: "staff_day_repair", label: "Staff Day Repair", icon: UserRound },
  { category: "rules_safety", label: "Rules & Safety", icon: ShieldCheck },
];

function priorityTone(priority: RecoveryIssue["priority"]): "bad" | "warn" | "neutral" {
  if (priority === "high") return "bad";
  if (priority === "medium") return "warn";
  return "neutral";
}

function groupIconClass(category: RecoveryIssueCategory): string {
  if (category === "device_access") return "bg-red-50 text-red-700";
  if (category === "scan_recovery") return "bg-amber-50 text-amber-700";
  if (category === "staff_day_repair") return "bg-blue-50 text-blue-700";
  return "bg-emerald-50 text-emerald-700";
}

export function RecoveryIssueQueue({
  activeCategory,
  issues,
  onCategoryChange,
  onSelectIssue,
  selectedIssueId,
}: {
  activeCategory: RecoveryIssueCategory | "all";
  issues: RecoveryIssue[];
  onCategoryChange: (category: RecoveryIssueCategory | "all") => void;
  onSelectIssue: (issue: RecoveryIssue) => void;
  selectedIssueId: string | null;
}) {
  const visibleGroups = GROUPS.map((group) => ({
    ...group,
    issues: issues.filter((issue) => issue.category === group.category),
  }));

  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-4">
        <div>
          <h2 className="text-base font-bold text-foreground">Issue Queue</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Review and resolve attendance issues.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onCategoryChange(activeCategory === "all" ? "device_access" : "all")}
        >
          <Filter className="mr-2 size-4" />
          {activeCategory === "all" ? "All Categories" : "Filtered"}
        </Button>
      </div>

      <div className="max-h-[720px] overflow-y-auto px-4 py-3">
        <div className="grid gap-4">
          {visibleGroups.map((group) => {
            const Icon = group.icon;
            const showGroup = activeCategory === "all" || activeCategory === group.category;

            if (!showGroup || group.issues.length === 0) return null;

            return (
              <div key={group.category} className="grid gap-2">
                <button
                  type="button"
                  onClick={() => onCategoryChange(group.category)}
                  className="flex items-center justify-between gap-3 text-left"
                >
                  <span className="flex items-center gap-2 text-sm font-bold text-foreground">
                    {group.label}
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">
                      {group.issues.length}
                    </span>
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>

                <div className="grid gap-2">
                  {group.issues.slice(0, 8).map((issue) => {
                    const selected = selectedIssueId === issue.id;

                    return (
                      <button
                        key={issue.id}
                        type="button"
                        onClick={() => onSelectIssue(issue)}
                        className={`grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border px-3 py-3 text-left transition hover:border-primary ${
                          selected
                            ? "border-red-300 bg-red-50"
                            : "border-border bg-card hover:bg-muted/30"
                        }`}
                      >
                        <span
                          className={`flex size-10 items-center justify-center rounded-full ${groupIconClass(
                            group.category
                          )}`}
                        >
                          <Icon className="size-4" />
                        </span>

                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold text-foreground">
                            {issue.title}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {issue.subtitle}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            {formatAttendanceDateTime(issue.detectedAt)}
                          </span>
                        </span>

                        <span className="flex items-center gap-2">
                          <StatusPill value={issue.priority} tone={priorityTone(issue.priority)} />
                          <ChevronRight className="size-4 text-muted-foreground" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {issues.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center">
              <HelpCircle className="mx-auto mb-2 size-7 text-muted-foreground" />
              <div className="font-bold text-foreground">No open recovery issues</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Blocked scans, device issues, and staff-day repair items will appear here.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="border-t border-border px-4 py-3">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={activeCategory === "all"}
          onClick={() => onCategoryChange("all")}
        >
          <Link2 className="mr-2 size-4" />
          View all issues ({issues.length})
        </Button>
      </div>
    </section>
  );
}
