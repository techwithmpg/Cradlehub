"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AttendanceReviewDrawer } from "@/components/features/attendance/review/attendance-review-drawer";
import type { AttendanceReviewItem } from "@/lib/attendance/crm-review";
import type { AttendanceWorkspaceData } from "@/lib/attendance/types";

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
        `${item.title} ${item.exception.message} ${item.category}`.toLowerCase().includes(query)
    );
  }, [items, search]);
  return (
    <>
      <section className="overflow-hidden rounded-xl border border-[var(--cs-border)] bg-white">
        <div className="flex flex-col gap-3 border-b border-[var(--cs-border-soft)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold">Review queue</h2>
            <p className="mt-0.5 text-xs text-[var(--cs-text-muted)]">
              One row per unresolved incident. Timing statuses stay in Today.
            </p>
          </div>
          <label className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--cs-text-muted)]" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full pl-9 sm:w-64"
              placeholder="Search incidents"
            />
            <span className="sr-only">Search incidents</span>
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--cs-surface-warm)] text-xs uppercase tracking-wide text-[var(--cs-text-muted)]">
              <tr>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Incident</th>
                <th className="px-4 py-3">Detected</th>
                <th className="px-4 py-3">Recommended</th>
                <th className="px-4 py-3">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  className="border-t border-[var(--cs-border-soft)] hover:bg-[var(--cs-surface-warm)]"
                >
                  <td className="px-4 py-3">
                    <span
                      className={
                        item.priority === "critical"
                          ? "text-red-700"
                          : item.priority === "high"
                            ? "text-amber-700"
                            : "text-[var(--cs-text-muted)]"
                      }
                    >
                      {item.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{item.title}</div>
                    <div className="mt-0.5 max-w-md truncate text-xs text-[var(--cs-text-muted)]">
                      {item.exception.message}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--cs-text-muted)]">
                    {new Intl.DateTimeFormat("en-US", {
                      timeZone: data.timezone,
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    }).format(new Date(item.exception.detected_at))}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold">{item.recommendedAction}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => setSelected(item)}>
                      Review
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <p className="font-semibold">No incidents need review</p>
            <p className="mt-1 text-sm text-[var(--cs-text-muted)]">
              Clock-in timing and arrival statuses are tracked in Today.
            </p>
          </div>
        ) : null}
      </section>
      <AttendanceReviewDrawer
        data={data}
        item={selected}
        onClose={() => setSelected(null)}
        onRefresh={onRefresh}
        onManagePhone={onManagePhone}
      />
    </>
  );
}
