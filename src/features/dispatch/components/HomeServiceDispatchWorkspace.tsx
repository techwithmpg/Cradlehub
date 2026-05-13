"use client";

import { useMemo, useState } from "react";
import { Tabs } from "@/components/ui/tabs";
import {
  queueDispatchItems,
} from "../data/mockDispatchData";
import type { DispatchItem, DispatchRole, DispatchTabId } from "../types";
import { canViewAllDispatches } from "../types";
import { DispatchCityMapTab } from "./DispatchCityMapTab";
import { DispatchCompletedTab } from "./DispatchCompletedTab";
import { DispatchDelaysAlertsTab } from "./DispatchDelaysAlertsTab";
import { DispatchLiveTrackingTab } from "./DispatchLiveTrackingTab";
import { DispatchQueueTab } from "./DispatchQueueTab";
import { DispatchTabs } from "./DispatchTabs";

export interface HomeServiceDispatchWorkspaceProps {
  role?: DispatchRole;
}

function getVisibleDispatchItems(role: DispatchRole): DispatchItem[] {
  if (canViewAllDispatches(role)) {
    return queueDispatchItems;
  }

  if (role === "driver") {
    return queueDispatchItems.filter((item) => item.driverName === "Mark Reyes");
  }

  return queueDispatchItems.filter((item) => item.therapistName === "Ana Lopez");
}

export function HomeServiceDispatchWorkspace({
  role = "crm",
}: HomeServiceDispatchWorkspaceProps) {
  const firstDispatch = queueDispatchItems[0];
  const [activeTab, setActiveTab] = useState<DispatchTabId>("queue");
  const [selectedQueueId, setSelectedQueueId] = useState(firstDispatch?.id ?? "");
  const [selectedCityNumber, setSelectedCityNumber] = useState("#002");

  const visibleDispatchItems = useMemo(() => getVisibleDispatchItems(role), [role]);

  if (!firstDispatch) {
    return null;
  }

  const selectedQueueItem =
    visibleDispatchItems.find((item) => item.id === selectedQueueId) ??
    visibleDispatchItems[0] ??
    firstDispatch;

  function selectQueueItem(item: DispatchItem) {
    setSelectedQueueId(item.id);
  }

  function viewAlertDispatch(dispatchNumber: string) {
    const nextItem =
      visibleDispatchItems.find((item) => item.number === dispatchNumber) ??
      queueDispatchItems.find((item) => item.number === dispatchNumber);

    if (nextItem) {
      setSelectedQueueId(nextItem.id);
    }

    setActiveTab("queue");
  }

  function renderActiveTab() {
    switch (activeTab) {
      case "queue":
        return (
          <DispatchQueueTab
            role={role}
            items={visibleDispatchItems}
            selectedItem={selectedQueueItem}
            onSelect={selectQueueItem}
          />
        );
      case "city-map":
        return (
          <DispatchCityMapTab
            role={role}
            items={visibleDispatchItems}
            selectedNumber={selectedCityNumber}
            onSelectNumber={setSelectedCityNumber}
          />
        );
      case "live-tracking":
        return <DispatchLiveTrackingTab />;
      case "delays-alerts":
        return <DispatchDelaysAlertsTab onViewDispatch={viewAlertDispatch} />;
      case "completed":
        return <DispatchCompletedTab />;
      default:
        return null;
    }
  }

  return (
    <section className="space-y-4 p-4 md:p-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold leading-tight text-[var(--cs-text)]">
          Home Service Dispatch
        </h1>
        <p className="max-w-4xl text-sm leading-6 text-[var(--cs-text-secondary)]">
          Shared dispatch workspace with role-based actions for CRM, Driver,
          Therapist, Manager, and Owner.
        </p>
      </header>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as DispatchTabId)}
        className="gap-0"
      >
        <DispatchTabs />
        <div className="pt-4" role="tabpanel" aria-label={`${activeTab} dispatch tab`}>
          {renderActiveTab()}
        </div>
      </Tabs>
    </section>
  );
}
