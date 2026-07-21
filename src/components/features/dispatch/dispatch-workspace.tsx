"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import {
  CalendarDays,
  ListChecks,  Route,
  Settings2,} from "lucide-react";
import { AttendanceTabPanel, ContextChip } from "@/components/features/attendance/attendance-ui";
import type { DispatchData } from "@/lib/queries/dispatch-queries";
import { refreshDispatchDataAction } from "@/lib/actions/dispatch-data-actions";
import { BOOKINGS_CHANGED_EVENT } from "@/lib/bookings/bookings-client-events";
import { DispatchFlowTab } from "./dispatch-flow-tab";
import { DispatchLiveMapTab } from "./dispatch-live-map-tab";
import { DispatchTravelProgressTab } from "./dispatch-travel-progress-tab";

type TabId = "flow" | "map" | "progress";

const TABS: { id: TabId; label: string }[] = [
  { id: "flow", label: "Dispatch Queue" },
  { id: "map", label: "Live Map" },
  { id: "progress", label: "Travel Progress" },
];

export interface HomeServiceDispatchWorkspaceProps {
  role: string;
  data: DispatchData;
  showHeader?: boolean;
}

function statusText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function DispatchMetric({
  icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: "neutral" | "warning" | "success" | "info" | "purple" | "danger";
}) {
  const toneClass =
    tone === "warning"
      ? "text-amber-700 bg-amber-50 border-amber-100"
      : tone === "success"
        ? "text-emerald-700 bg-emerald-50 border-emerald-100"
        : tone === "info"
          ? "text-blue-700 bg-blue-50 border-blue-100"
          : tone === "purple"
            ? "text-purple-700 bg-purple-50 border-purple-100"
            : tone === "danger"
              ? "text-red-700 bg-red-50 border-red-100"
              : "text-[var(--cs-text)] bg-[var(--cs-surface)] border-[var(--cs-border)]";

  return (
    <div className={`flex items-center justify-between rounded-2xl border px-4 py-3 shadow-sm ${toneClass}`}>
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-xl bg-white/70">
          {icon}
        </div>
        <span className="text-sm font-semibold">{label}</span>
      </div>
      <span className="text-2xl font-bold">{value}</span>
    </div>
  );
}

export function HomeServiceDispatchWorkspace({
  role,
  data: initialData,
  showHeader = true,
}: HomeServiceDispatchWorkspaceProps) {
  const { data = initialData, mutate } = useSWR(
    ["dispatch-workspace", initialData.today],
    async () => {
      const result = await refreshDispatchDataAction(initialData.today);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    {
      fallbackData: initialData,
      keepPreviousData: true,
      revalidateOnFocus: false,
      revalidateOnMount: false,
    }
  );
  const [activeTab, setActiveTab] = useState<TabId>("flow");
  const activeTabIndex = TABS.findIndex((tab) => tab.id === activeTab);

  useEffect(() => {
    const revalidate = () => void mutate();
    window.addEventListener(BOOKINGS_CHANGED_EVENT, revalidate);
    return () => window.removeEventListener(BOOKINGS_CHANGED_EVENT, revalidate);
  }, [mutate]);

  function handleTabKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const lastIndex = TABS.length - 1;
    let nextIndex = activeTabIndex;

    if (event.key === "ArrowRight") nextIndex = activeTabIndex === lastIndex ? 0 : activeTabIndex + 1;
    else if (event.key === "ArrowLeft") nextIndex = activeTabIndex === 0 ? lastIndex : activeTabIndex - 1;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = lastIndex;
    else return;

    event.preventDefault();
    const nextTab = TABS[nextIndex];
    if (nextTab) setActiveTab(nextTab.id);
  }

  const metrics = useMemo(() => {
    const items = data.items;
    const needsSetup = items.filter((item) => {
      const s = statusText(item.dispatchStatus);
      return (
        s === "awaiting_driver" ||
        !item.driverId ||
        !item.therapistId ||
        item.lat === null ||
        item.lng === null
      );
    }).length;

    const ready = items.filter((item) => {
      const s = statusText(item.dispatchStatus);
      return (
        s === "ready" &&
        item.driverId &&
        item.therapistId &&
        item.lat !== null &&
        item.lng !== null
      );
    }).length;

    const scheduled = items.filter((item) => statusText(item.dispatchStatus) === "scheduled").length;
    const released = items.filter((item) =>
      ["released_to_driver", "in_route", "arrived_at_customer", "service_started"].includes(
        statusText(item.dispatchStatus)
      )
    ).length;

    const alerts = items.filter(
      (item) => !item.driverId || !item.therapistId || item.lat === null || item.lng === null
    ).length;

    return { needsSetup, ready, scheduled, released, alerts };
  }, [data.items]);

  return (
    <section className="space-y-5 p-4 md:p-0">
      {showHeader ? (
        <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-2xl font-bold leading-tight text-[var(--cs-text)]">
              Home-Service Dispatch Center
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-[var(--cs-text-secondary)]">
              Coordinate home-service bookings, drivers, therapist movement, customer locations, and dispatch readiness.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <ContextChip icon={<CalendarDays size={16} />}>{data.today}</ContextChip>
            <ContextChip icon={<ListChecks size={16} />}>{role} view</ContextChip>
          </div>
        </header>
      ) : null}

      <div
        role="tablist"
        aria-label="Dispatch workspace tabs"
        onKeyDown={handleTabKeyDown}
        className="flex flex-wrap gap-2 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] p-1 shadow-sm md:w-fit"
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`dispatch-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`dispatch-panel-${tab.id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-5 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active
                  ? "bg-green-50 text-[#155A33] shadow-sm ring-1 ring-green-100"
                  : "text-[var(--cs-text-secondary)] hover:bg-[var(--cs-surface-warm)]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <DispatchMetric
          icon={<ListChecks size={18} />}
          label="Needs setup"
          value={metrics.needsSetup}
          tone="warning"
        />
        <DispatchMetric
          icon={<ListChecks size={18} />}
          label="Ready"
          value={metrics.ready}
          tone="success"
        />
        <DispatchMetric
          icon={<CalendarDays size={18} />}
          label="Scheduled"
          value={metrics.scheduled}
          tone="info"
        />
        <DispatchMetric
          icon={<Route size={18} />}
          label="Released"
          value={metrics.released}
          tone="purple"
        />
        <DispatchMetric
          icon={<Settings2 size={18} />}
          label="Alerts"
          value={metrics.alerts}
          tone={metrics.alerts > 0 ? "danger" : "neutral"}
        />
      </div>

      <AttendanceTabPanel
        id="dispatch-panel-flow"
        labelledBy="dispatch-tab-flow"
        active={activeTab === "flow"}
      >
        {activeTab === "flow" ? (
          <DispatchFlowTab data={data} role={role} onChanged={() => void mutate()} />
        ) : null}
      </AttendanceTabPanel>
      <AttendanceTabPanel
        id="dispatch-panel-map"
        labelledBy="dispatch-tab-map"
        active={activeTab === "map"}
      >
        {activeTab === "map" ? <DispatchLiveMapTab data={data} /> : null}
      </AttendanceTabPanel>
      <AttendanceTabPanel
        id="dispatch-panel-progress"
        labelledBy="dispatch-tab-progress"
        active={activeTab === "progress"}
      >
        {activeTab === "progress" ? (
          <div className="rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] p-5 shadow-sm">
            <DispatchTravelProgressTab data={data} />
          </div>
        ) : null}
      </AttendanceTabPanel>
    </section>
  );
}


