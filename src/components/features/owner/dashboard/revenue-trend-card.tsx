"use client";

import { useMemo, useState } from "react";
import { ChartLine } from "lucide-react";
import {
  DashboardPanel,
  NativeSelect,
  SectionError,
} from "./dashboard-panel";
import { formatCompactCurrency, formatCurrency } from "./format";
import type {
  DashboardLoad,
  OwnerDashboardRevenuePeriod,
  OwnerDashboardRevenuePoint,
} from "@/lib/owner/dashboard";

type RevenueTrendData = Record<OwnerDashboardRevenuePeriod, OwnerDashboardRevenuePoint[]>;
const EMPTY_POINTS: OwnerDashboardRevenuePoint[] = [];

export function RevenueTrendCard({
  load,
}: {
  load: DashboardLoad<RevenueTrendData>;
}) {
  const [period, setPeriod] = useState<OwnerDashboardRevenuePeriod>("week");
  const points = load.status === "ready" ? load.data[period] : EMPTY_POINTS;
  const total = points.reduce((sum, point) => sum + point.revenue, 0);
  const max = Math.max(0, ...points.map((point) => point.revenue));
  const sampledPoints = useMemo(() => samplePoints(points), [points]);

  return (
    <DashboardPanel
      title="Revenue Trend"
      icon={ChartLine}
      action={
        load.status === "ready" ? (
          <NativeSelect
            label="Select revenue trend period"
            value={period}
            onChange={(value) => setPeriod(value as OwnerDashboardRevenuePeriod)}
          >
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="last30">Last 30 days</option>
          </NativeSelect>
        ) : null
      }
    >
      {load.status === "error" ? (
        <SectionError message={load.message} />
      ) : (
        <div className="px-4 py-4">
          <p className="font-heading text-2xl font-semibold text-[var(--cs-text)]">
            {formatCurrency(total)}
          </p>
          <p className="text-xs text-[var(--cs-text-muted)]">Paid revenue</p>

          <div className="mt-5 grid h-36 grid-cols-[48px_minmax(0,1fr)] gap-3">
            <div className="flex flex-col justify-between text-right text-[10px] text-[var(--cs-text-muted)]">
              <span>{formatCompactCurrency(max)}</span>
              <span>{formatCompactCurrency(max / 2)}</span>
              <span>{formatCurrency(0)}</span>
            </div>
            <div className="flex items-end gap-1 border-b border-l border-[var(--cs-border)] px-2 pb-1">
              {sampledPoints.map((point) => (
                <div
                  key={point.date}
                  className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2"
                  title={`${point.label}: ${formatCurrency(point.revenue)}`}
                >
                  <div
                    className="w-full max-w-5 rounded-t-full bg-[#0b3b27]"
                    style={{
                      height: max > 0 ? `${Math.max(6, (point.revenue / max) * 96)}px` : "6px",
                      opacity: point.revenue > 0 ? 1 : 0.35,
                    }}
                  />
                  <span className="truncate text-[10px] text-[var(--cs-text-muted)]">
                    {point.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </DashboardPanel>
  );
}

function samplePoints(points: OwnerDashboardRevenuePoint[]) {
  if (points.length <= 8) return points;
  const interval = Math.ceil(points.length / 8);
  return points.filter((_, index) => index % interval === 0 || index === points.length - 1);
}
