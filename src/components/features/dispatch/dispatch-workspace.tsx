"use client";

import {
  useEffect,
  useMemo,
  useState } from "react";
import useSWR from "swr";
import {
  CalendarDays,
  ListChecks,
  Route,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  MapPin,
  Navigation,
} from "lucide-react";
import { AttendanceTabPanel, ContextChip } from "@/components/features/attendance/attendance-ui";
import type { DispatchData } from "@/lib/queries/dispatch-queries";
import { refreshDispatchDataAction } from "@/lib/actions/dispatch-data-actions";
import { BOOKINGS_CHANGED_EVENT } from "@/lib/bookings/bookings-client-events";
import { DispatchFlowTab } from "./dispatch-flow-tab";
import { DispatchLiveMapTab } from "./dispatch-live-map-tab";

type TabId = "flow" | "map";

const TABS: { id: TabId; label: string }[] = [
  { id: "flow", label: "Live Operations" },
  { id: "map", label: "Full Map" },
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
    const count = (status: string) =>
      data.items.filter(
        (item) => statusText(item.dispatchStatus) === status
      ).length;

    const scheduled = count("awaiting_driver");
    const awaitingTravel = count("ready");
    const enRoute = count("in_route");
    const arrived = count("arrived_at_customer");
    const inService = count("service_started");
    const completed = count("completed");

    return {
      scheduled,
      awaitingTravel,
      enRoute,
      arrived,
      inService,
      completed,
      alerts: data.alerts.length,
    };
  }, [data.alerts.length, data.items]);

  return (
    <section className="space-y-5 p-4 md:p-0">
      {showHeader ? (
        <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-2xl font-bold leading-tight text-[var(--cs-text)]">
              Home Service Operations
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-[var(--cs-text-secondary)]">
              Monitor today&apos;s home-service visits, travel progress, staff, and customer locations.
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
        aria-label="Home Service Operations views"
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <DispatchMetric
          icon={<CalendarDays size={18} />}
          label="Scheduled"
          value={metrics.scheduled}
        />
        <DispatchMetric
          icon={<Clock3 size={18} />}
          label="Awaiting Travel"
          value={metrics.awaitingTravel}
          tone="warning"
        />
        <DispatchMetric
          icon={<Navigation size={18} />}
          label="En Route"
          value={metrics.enRoute}
          tone="info"
        />
        <DispatchMetric
          icon={<MapPin size={18} />}
          label="Arrived"
          value={metrics.arrived}
          tone="success"
        />
        <DispatchMetric
          icon={<Route size={18} />}
          label="In Service"
          value={metrics.inService}
          tone="purple"
        />
        <DispatchMetric
          icon={<CheckCircle2 size={18} />}
          label="Completed"
          value={metrics.completed}
          tone="success"
        />
        <DispatchMetric
          icon={<AlertTriangle size={18} />}
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
    </section>
  );
}
