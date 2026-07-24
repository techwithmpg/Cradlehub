"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AttendanceIssueModalRouter } from "@/components/features/attendance/review/attendance-issue-modal-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AttendanceReviewItem } from "@/lib/attendance/crm-review";
import type { AttendanceWorkspaceData } from "@/lib/attendance/types";

function ownerLabel(owner: AttendanceReviewItem["diagnostic"]["resolutionOwner"]): string {
  if (owner === "technical_support") return "Technical";
  if (owner === "automatic" || owner === "system") return "System";
  if (owner === "manager") return "Manager";
  if (owner === "staff") return "Staff";
  return "CRM";
}

export function AttendanceReviewView({
  data,
  items,
  onRefresh,
  onManagePhone,
}: {
  data: AttendanceWorkspaceData;
  items: AttendanceReviewItem[];
  onRefresh: () => void;
  onManagePhone: (staffId: string | null) => void;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AttendanceReviewItem | null>(null);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter(
      (item) =>
        !query ||
        `${item.title} ${item.exception.message} ${item.diagnostic.code} ${item.recommendedAction}`
          .toLowerCase()
          .includes(query)
    );
  }, [items, search]);

  return (
    <>
      <section className="overflow-hidden rounded-xl border border-[var(--cs-border)] bg-white">
        <div className="flex flex-col gap-3 border-b border-[var(--cs-border-soft)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold">Attendance incident queue</h2>
            <p className="mt-0.5 text-xs text-[var(--cs-text-muted)]">
              Every row shows the exact problem, who owns it, how to fix it, and how to prevent it.
            </p>
          </div>
          <label className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--cs-text-muted)]" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full pl-9 sm:w-72"
              placeholder="Search staff, problem, code, action"
            />
            <span className="sr-only">Search Attendance incidents</span>
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--cs-surface-warm)] text-xs uppercase tracking-wide text-[var(--cs-text-muted)]">
              <tr>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Incident</th>
                <th className="px-4 py-3">Detected</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Prevention</th>
                <th className="px-4 py-3">
                  <span className="sr-only">Resolve</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  className="border-t border-[var(--cs-border-soft)] align-top hover:bg-[var(--cs-surface-warm)]"
                >
                  <td className="px-4 py-3">
                    <span
                      className={
                        item.priority === "critical"
                          ? "font-semibold text-red-700"
                          : item.priority === "high"
                            ? "font-semibold text-amber-700"
                            : "text-[var(--cs-text-muted)]"
                      }
                    >
                      {item.priority}
                    </span>
                    {item.recurrenceCount > 1 ? (
                      <Badge
                        variant="outline"
                        className="mt-2 block w-fit text-[10px] text-amber-700"
                      >
                        {item.recurrenceCount} occurrences
                      </Badge>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{item.title}</div>
                    <div className="mt-1 max-w-lg text-xs leading-5 text-[var(--cs-text-muted)]">
                      {item.diagnostic.crmSummary}
                    </div>
                    <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--cs-text-muted)]">
                      {item.diagnostic.code}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--cs-text-muted)]">
                    {new Intl.DateTimeFormat("en-US", {
                      timeZone: data.timezone,
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    }).format(
                      new Date(item.exception.last_detected_at ?? item.exception.detected_at)
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="font-semibold">
                      Attendance changed: {item.diagnostic.attendanceChanged ? "Yes" : "No"}
                    </div>
                    <div className="mt-1 text-[var(--cs-text-muted)]">{item.recurrenceLabel}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{ownerLabel(item.diagnostic.resolutionOwner)}</Badge>
                  </td>
                  <td className="max-w-xs px-4 py-3 text-xs leading-5 text-[var(--cs-text-muted)]">
                    {item.diagnostic.preventionAction}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" onClick={() => setSelected(item)}>
                      {item.recommendedAction}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <p className="font-semibold">No Attendance incidents need review</p>
            <p className="mt-1 text-sm text-[var(--cs-text-muted)]">
              Resolved incidents and harmless duplicate scans are not kept in the active queue.
            </p>
          </div>
        ) : null}
      </section>

      <AttendanceIssueModalRouter
        data={data}
        item={selected}
        onClose={() => setSelected(null)}
        onRefresh={onRefresh}
        onManagePhone={onManagePhone}
      />
    </>
  );
}
