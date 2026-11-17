"use client";

import {DriverTransportJourneys} from "./driver-transport-journeys";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
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
import {
  CrmModuleTabs,
  type CrmModuleTabItem,
} from "@/components/features/crm/shared/crm-module-tabs";
import { CrmStatCard, type CrmCardTone } from "@/components/features/crm/shared/crm-cards";
import { ContextChip, CrmTabPanel } from "@/components/features/crm/shared/crm-workspace-primitives";
import type { DispatchData } from "@/lib/queries/dispatch-queries";
import { refreshDispatchDataAction } from "@/lib/actions/dispatch-data-actions";
import { BOOKINGS_CHANGED_EVENT } from "@/lib/bookings/bookings-client-events";
import { DispatchFlowTab } from "./dispatch-flow-tab";
import { DispatchLiveMapTab } from "./dispatch-live-map-tab";
import { useWorkspaceSWRKey } from "@/components/features/dashboard/workspace-swr-cache";
import { useLiveCrmDispatchData } from "./use-live-crm-dispatch-data";

type TabId = "flow" | "map";

const TABS: CrmModuleTabItem<TabId>[] = [
  { key: "flow", label: "Live Operations", id: "dispatch-tab-flow", controls: "dispatch-panel-flow" },
  { key: "map", label: "Full Map", id: "dispatch-tab-map", controls: "dispatch-panel-map" },
];

export interface HomeServiceDispatchWorkspaceProps {
  role: string;
  data: DispatchData;
  showHeader?: boolean;
  upcoming?: boolean;
  selectedBookingId?: string;
  ownerBranchId?: string;
  initialView?: TabId;
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
  const mappedTone: CrmCardTone = tone === "purple" ? "info" : tone;
  return (
    <CrmStatCard
      title={label}
      value={value}
      icon={icon}
      tone={mappedTone}
      compact
    />
  );
}

export function HomeServiceDispatchWorkspace({
  role,
  data: initialData,
  showHeader = true,
  upcoming = false,
  selectedBookingId,
  ownerBranchId,
  initialView = "flow",
}: HomeServiceDispatchWorkspaceProps) {
  const isCrmRetainedDispatch = !ownerBranchId;
  const ownerKey = useWorkspaceSWRKey(["owner-dispatch", ownerBranchId, initialData.today, upcoming]);
  const ownerMapKey = useWorkspaceSWRKey(["owner-dispatch-map", ownerBranchId, initialData.today]);
  const crmMapKey = useWorkspaceSWRKey(["crm-dispatch-map", initialData.today]);
  const ownerScope = ownerBranchId ? { expectedOwnerBranchId: ownerBranchId } : {};
  const crmDispatch = useLiveCrmDispatchData({
    date: initialData.today,
    upcoming,
    selectedBookingId,
    fallbackData: initialData,
  });
  const legacyDispatch = useSWR(
    isCrmRetainedDispatch
      ? null
      : ownerBranchId
        ? ownerKey
        : ["dispatch-workspace", initialData.today, upcoming],
    async () => {
      const result = await refreshDispatchDataAction(initialData.today, { upcoming, ...ownerScope });
      if (!result.success) throw new Error(result.error);
      if (selectedBookingId && !result.data.items.some((item) => item.id === selectedBookingId)) {
        const exact = await refreshDispatchDataAction(initialData.today, {
          bookingId: selectedBookingId,
          ...ownerScope,
        });
        if (!exact.success) throw new Error(exact.error);
        return {
          ...result.data,
          items: [...result.data.items, ...exact.data.items],
        };
      }
      return result.data;
    },
    {
      fallbackData: initialData,
      keepPreviousData: true,
      revalidateOnFocus: false,
      revalidateOnMount: false,
    }
  );
  const data = isCrmRetainedDispatch
    ? (crmDispatch.data ?? initialData)
    : (legacyDispatch.data ?? initialData);
  const error = isCrmRetainedDispatch ? crmDispatch.error : legacyDispatch.error;
  const [activeTab, setActiveTab] = useState<TabId>(initialView);
  const {
    data: mapData,
    error: mapError,
    mutate: mutateMap,
  } = useSWR(
    activeTab === "map"
      ? ownerBranchId
        ? ownerMapKey
        : isCrmRetainedDispatch
          ? crmMapKey
          : ["dispatch-active-map", initialData.today]
      : null,
    async () => {
      const result = await refreshDispatchDataAction(initialData.today, { scope: "active_map", ...ownerScope });
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    { revalidateOnFocus: false }
  );
  const { mutate: mutateLegacyDispatch } = legacyDispatch;

  useEffect(() => {
    const revalidate = () => {
      // CRM queue reconciliation is generation-driven by the retained workspace provider.
      // Preserve the legacy direct refresh path for Manager/Owner surfaces, which are outside
      // this PERF-5 conversion, and keep the active map current while it is visible.
      if (!isCrmRetainedDispatch) void mutateLegacyDispatch();
      if (activeTab === "map") void mutateMap();
    };
    window.addEventListener(BOOKINGS_CHANGED_EVENT, revalidate);
    return () => window.removeEventListener(BOOKINGS_CHANGED_EVENT, revalidate);
  }, [activeTab, isCrmRetainedDispatch, mutateLegacyDispatch, mutateMap]);

  const metrics = useMemo(() => {
    const count = (status: string) =>
      data.items.filter((item) => statusText(item.dispatchStatus) === status).length;

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
      <DriverTransportJourneys journeys={data.transportJourneys} error={data.transportError}/>
      <nav aria-label="Home Service booking dates" className="flex gap-2">
        <Link
          href="/crm/dispatch?tab=today"
          aria-current={!upcoming ? "page" : undefined}
          className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
            !upcoming
              ? "border-[#1F4E33] bg-[#1F4E33] text-white"
              : "border-[var(--cs-border)] bg-white text-[#1F4E33] hover:bg-[#EEF7F1]"
          }`}
        >
          Today
        </Link>
        <Link
          href="/crm/dispatch?tab=upcoming"
          aria-current={upcoming ? "page" : undefined}
          className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
            upcoming
              ? "border-[#1F4E33] bg-[#1F4E33] text-white"
              : "border-[var(--cs-border)] bg-white text-[#1F4E33] hover:bg-[#EEF7F1]"
          }`}
        >
          Upcoming
        </Link>
      </nav>
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          Home Service could not refresh. Showing the last loaded visits.
        </p>
      ) : null}
      {showHeader ? (
        <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-2xl font-bold leading-tight text-[var(--cs-text)]">
              Home Service Operations
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-[var(--cs-text-secondary)]">
              Monitor today&apos;s home-service visits, travel progress, staff, and customer
              locations.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <ContextChip icon={<CalendarDays size={16} />}>{data.today}</ContextChip>
            <ContextChip icon={<ListChecks size={16} />}>{role} view</ContextChip>
          </div>
        </header>
      ) : null}

      <CrmModuleTabs
        tabs={TABS}
        activeKey={activeTab}
        onChange={setActiveTab}
        ariaLabel="Home Service Operations views"
      />

      {!upcoming ? (
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
      ) : null}
      <CrmTabPanel
        id="dispatch-panel-flow"
        labelledBy="dispatch-tab-flow"
        active={activeTab === "flow"}
      >
        {activeTab === "flow" ? (
          <DispatchFlowTab
            key={selectedBookingId ?? (upcoming ? "upcoming" : "today")}
            data={data}
            role={role}
            onChanged={() => {
              if (isCrmRetainedDispatch) crmDispatch.generation.store?.invalidate("crm-dispatch");
              else void legacyDispatch.mutate();
            }}
            upcoming={upcoming}
            selectedBookingId={selectedBookingId}
          />
        ) : null}
      </CrmTabPanel>
      <CrmTabPanel
        id="dispatch-panel-map"
        labelledBy="dispatch-tab-map"
        active={activeTab === "map"}
      >
        {activeTab === "map" ? (
          mapData ? (
            <DispatchLiveMapTab
              data={mapData}
              selectedBookingId={selectedBookingId}
              branchId={ownerBranchId}
              onRefresh={() => void mutateMap()}
            />
          ) : (
            <p role="status">
              {mapError
                ? "Active Home Service locations are temporarily unavailable."
                : "Loading active Home Service locations…"}
            </p>
          )
        ) : null}
      </CrmTabPanel>
    </section>
  );
}

