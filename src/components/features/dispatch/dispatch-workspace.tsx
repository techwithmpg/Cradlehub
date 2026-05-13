"use client";

import { useState } from "react";
import { List, Map, Route, AlertTriangle, CheckSquare } from "lucide-react";
import type { DispatchRole } from "./types";
import type { DispatchData, RealDispatchItem } from "@/lib/queries/dispatch-queries";
import { DispatchQueueTab }        from "./dispatch-queue-tab";
import { DispatchCityMapTab }      from "./dispatch-city-map-tab";
import { DispatchLiveTrackingTab } from "./dispatch-live-tracking-tab";
import { DispatchDelaysAlertsTab } from "./dispatch-delays-alerts-tab";
import { DispatchCompletedTab }    from "./dispatch-completed-tab";

const ACCENT = "#6D28D9";

const TABS = [
  { id: "queue",         label: "Queue",          icon: List },
  { id: "city-map",      label: "City Map",        icon: Map },
  { id: "live-tracking", label: "Live Tracking",   icon: Route },
  { id: "delays-alerts", label: "Delays & Alerts", icon: AlertTriangle },
  { id: "completed",     label: "Completed",       icon: CheckSquare },
] as const;

type TabId = (typeof TABS)[number]["id"];

const ACTIVE_STATUSES = new Set(["ready", "in_route", "arrived_at_customer", "service_started"]);

interface HomeServiceDispatchWorkspaceProps {
  role?: DispatchRole;
  data: DispatchData;
}

export function HomeServiceDispatchWorkspace({ role = "crm", data }: HomeServiceDispatchWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<TabId>("queue");
  const [selectedDispatchId, setSelectedDispatchId] = useState<string | null>(
    data.items[0]?.id ?? null
  );

  const queueItems = data.items.filter(
    (i) => i.dispatchStatus !== "completed" && i.dispatchStatus !== "cancelled"
  );
  const activeItems = data.items.filter((i) => ACTIVE_STATUSES.has(i.dispatchStatus));
  const completedItems = data.items.filter(
    (i) => i.dispatchStatus === "completed" || i.bookingStatus === "completed"
  );

  const selectedItem: RealDispatchItem | null =
    data.items.find((i) => i.id === selectedDispatchId) ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Page header */}
      <div>
        <h1 style={{ fontSize: "1.375rem", fontWeight: 700, color: "var(--cs-text)", margin: 0, lineHeight: 1.2 }}>
          Home Service Dispatch
        </h1>
        <p style={{ fontSize: 13.5, color: "var(--cs-text-muted)", margin: "0.25rem 0 0" }}>
          Live dispatch workspace for home-service bookings — {data.today}.
        </p>
      </div>

      {/* Tab nav */}
      <div>
        <div
          role="tablist"
          aria-label="Dispatch workspace tabs"
          style={{
            display:      "flex",
            gap:          4,
            borderBottom: "1.5px solid var(--cs-border-soft)",
            overflowX:    "auto",
          }}
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display:      "flex",
                  alignItems:   "center",
                  gap:          6,
                  padding:      "10px 14px",
                  fontSize:     13.5,
                  fontWeight:   isActive ? 600 : 400,
                  color:        isActive ? ACCENT : "var(--cs-text-muted)",
                  background:   "none",
                  border:       "none",
                  borderBottom: isActive ? `2px solid ${ACCENT}` : "2px solid transparent",
                  marginBottom: -1.5,
                  cursor:       "pointer",
                  whiteSpace:   "nowrap",
                  transition:   "color 0.15s, border-color 0.15s",
                }}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div style={{ paddingTop: "1rem" }}>
          {activeTab === "queue" && (
            <DispatchQueueTab
              role={role}
              items={queueItems}
              stats={data.stats}
              selectedId={selectedDispatchId}
              onSelect={setSelectedDispatchId}
              selectedItem={selectedItem}
            />
          )}
          {activeTab === "city-map" && (
            <DispatchCityMapTab
              role={role}
              items={data.items}
              selectedId={selectedDispatchId}
              onSelect={setSelectedDispatchId}
              selectedItem={selectedItem}
            />
          )}
          {activeTab === "live-tracking" && (
            <DispatchLiveTrackingTab activeItems={activeItems} />
          )}
          {activeTab === "delays-alerts" && (
            <DispatchDelaysAlertsTab
              alerts={data.alerts}
              onSelectDispatch={(id) => {
                setSelectedDispatchId(id);
                setActiveTab("queue");
              }}
            />
          )}
          {activeTab === "completed" && (
            <DispatchCompletedTab items={completedItems} stats={data.stats} />
          )}
        </div>
      </div>
    </div>
  );
}
