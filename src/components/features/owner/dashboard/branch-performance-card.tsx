"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, ChevronRight } from "lucide-react";
import {
  DashboardPanel,
  NativeSelect,
  SectionError,
} from "./dashboard-panel";
import { formatCurrency } from "./format";
import type {
  DashboardLoad,
  OwnerDashboardBranchPerformance,
  OwnerDashboardPeriod,
} from "@/lib/owner/dashboard";

type BranchPerformanceData = Record<
  OwnerDashboardPeriod,
  OwnerDashboardBranchPerformance[]
>;

export function BranchPerformanceCard({
  load,
}: {
  load: DashboardLoad<BranchPerformanceData>;
}) {
  const [period, setPeriod] = useState<OwnerDashboardPeriod>("today");
  const rows = load.status === "ready" ? load.data[period] : [];

  return (
    <DashboardPanel
      title="Branch Performance"
      icon={Building2}
      className="min-h-[300px]"
      action={
        load.status === "ready" ? (
          <NativeSelect
            label="Select branch performance period"
            value={period}
            onChange={(value) => setPeriod(value as OwnerDashboardPeriod)}
          >
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
          </NativeSelect>
        ) : null
      }
    >
      {load.status === "error" ? (
        <SectionError message={load.message} />
      ) : (
        <div className="px-4 py-2">
          {rows.map((branch) => (
            <div
              key={branch.id}
              className="border-b border-[var(--cs-border-soft)] py-3 last:border-b-0"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--cs-text)]">
                    {branch.name}
                  </p>
                  <p className="mt-1 text-xs text-[var(--cs-text-muted)]">
                    {branch.bookings} bookings · {branch.completed} completed
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-[var(--cs-text)]">
                    {formatCurrency(branch.revenue)}
                  </p>
                  <p className="text-xs font-semibold text-[#0b6b3a]">
                    {branch.revenueSharePercent}%
                  </p>
                </div>
              </div>
              <div className="mt-3 h-2 rounded-full bg-[#eee5d7]">
                <div
                  className="h-full rounded-full bg-[#0b3b27]"
                  style={{ width: `${branch.revenueSharePercent}%` }}
                />
              </div>
            </div>
          ))}
          <Link
            href="/owner/branches"
            className="mt-2 inline-flex w-full items-center justify-between py-2 text-sm font-semibold text-[#0b3b27]"
          >
            View all branches
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      )}
    </DashboardPanel>
  );
}
