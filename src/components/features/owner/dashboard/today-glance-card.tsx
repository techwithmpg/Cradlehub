"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import {
  DashboardPanel,
  EmptyState,
  NativeSelect,
  SectionError,
} from "./dashboard-panel";
import { formatTime } from "./format";
import type { DashboardLoad, OwnerDashboardBranch, OwnerDashboardTodayRow } from "@/lib/owner/dashboard";

export function TodayGlanceCard({
  load,
}: {
  load: DashboardLoad<{
    branches: OwnerDashboardBranch[];
    rows: OwnerDashboardTodayRow[];
  }>;
}) {
  const [branchId, setBranchId] = useState("all");
  const rows = useMemo(() => {
    if (load.status !== "ready") return [];
    if (branchId === "all") return load.data.rows;
    return load.data.rows.filter((row) => row.branch_id === branchId);
  }, [branchId, load]);

  return (
    <DashboardPanel
      title="Today at a Glance"
      icon={CalendarDays}
      className="min-h-[300px]"
      action={
        load.status === "ready" ? (
          <div className="flex items-center gap-2">
            <NativeSelect
              label="Filter today bookings by branch"
              value={branchId}
              onChange={setBranchId}
            >
              <option value="all">All branches</option>
              {load.data.branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </NativeSelect>
            <Link
              href="/owner/schedule"
              className="hidden h-8 items-center rounded-md border border-[#b78a42]/50 px-3 text-xs font-semibold text-[#0b3b27] shadow-sm transition hover:bg-[#f4efe5] sm:inline-flex"
            >
              View full schedule
            </Link>
          </div>
        ) : null
      }
    >
      {load.status === "error" ? (
        <SectionError message={load.message} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No bookings scheduled for today"
          description="Enjoy the calm. Use this time to plan, review, or grow."
          action={
            <Link
              href="/owner/bookings"
              className="inline-flex h-9 items-center rounded-md bg-[#07331f] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0d4a2e]"
            >
              Add a booking
            </Link>
          }
        />
      ) : (
        <div className="divide-y divide-[var(--cs-border-soft)] px-4">
          {rows.slice(0, 6).map((row) => (
            <Link
              key={row.id}
              href="/owner/bookings"
              className="grid gap-3 py-3 text-sm transition hover:bg-[var(--cs-surface-muted)] sm:grid-cols-[120px_minmax(0,1fr)_auto]"
            >
              <div className="font-semibold text-[#9b7336]">
                {formatTime(row.startTime)}
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold text-[var(--cs-text)]">
                  {row.customerName}
                </p>
                <p className="truncate text-xs text-[var(--cs-text-muted)]">
                  {row.serviceName} · {row.staffName} · {row.branchName}
                </p>
              </div>
              <span className="w-fit rounded-full bg-[#eef7f1] px-2.5 py-1 text-xs font-semibold capitalize text-[#0b6b3a]">
                {row.status.replaceAll("_", " ")}
              </span>
            </Link>
          ))}
          {rows.length > 6 ? (
            <div className="py-3 text-center text-xs font-medium text-[var(--cs-text-muted)]">
              {rows.length - 6} more bookings on the full schedule
            </div>
          ) : null}
        </div>
      )}
    </DashboardPanel>
  );
}
