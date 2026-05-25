"use client";

/**
 * HomeServiceDispatchWorkspace
 *
 * Three-tab Home-Service Dispatch Center shell.
 *
 * Tabs:
 *   1. Dispatch Flow     — booking queue + selected booking panel + driver assignment
 *   2. Live Map          — active trips list + map placeholder + trip detail
 *   3. Travel Progress   — full trip progress table / card list
 *
 * Always-visible:
 *   - Page header + architecture note
 *   - KPI summary cards (DispatchSummaryCards)
 *   - Dispatch readiness alerts (ReadinessIssueList via buildAlertIssues)
 *   - Emergency Dispatch Actions + Related Tools (bottom)
 *
 * Receives DispatchData from the page server component — no additional queries.
 * The page files (/crm/dispatch, /manager/dispatch) pass `role` for display
 * context only; auth and branch scoping are enforced by the server actions.
 */

import { useState } from "react";
import type { DispatchData } from "@/lib/queries/dispatch-queries";
import { ReadinessIssueList } from "@/components/shared/readiness-issue-list";
import { buildAlertIssues } from "./dispatch-readiness-utils";
import { DispatchSummaryCards } from "./dispatch-summary-cards";
import { DispatchFlowTab } from "./dispatch-flow-tab";
import { DispatchLiveMapTab } from "./dispatch-live-map-tab";
import { DispatchTravelProgressTab } from "./dispatch-travel-progress-tab";
import { DispatchEmergencyActions } from "./dispatch-emergency-actions";
import { DispatchRelatedTools } from "./dispatch-related-tools";

// ── Tab definitions ────────────────────────────────────────────────────────────

type TabId = "flow" | "map" | "progress";

const TABS: { id: TabId; label: string }[] = [
  { id: "flow",     label: "Dispatch Flow" },
  { id: "map",      label: "Live Map" },
  { id: "progress", label: "Travel Progress" },
];

// ── Main export ────────────────────────────────────────────────────────────────

export interface HomeServiceDispatchWorkspaceProps {
  role: string;
  data: DispatchData;
}

export function HomeServiceDispatchWorkspace({
  role,
  data,
}: HomeServiceDispatchWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<TabId>("flow");
  const alertIssues = buildAlertIssues(data.alerts);

  return (
    <section className="space-y-6 p-4 md:p-0">
      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <header className="space-y-1">
        <h1
          className="text-2xl font-bold leading-tight"
          style={{ color: "var(--cs-text)" }}
        >
          Home-Service Dispatch Center
        </h1>
        <p
          className="text-sm"
          style={{ color: "var(--cs-text-secondary)" }}
        >
          Coordinate home-service bookings, drivers, therapist movement,
          customer locations, and dispatch readiness.
        </p>
        <p className="text-xs" style={{ color: "var(--cs-text-muted)" }}>
          {data.today} · {role} view · Home-service uses schedule availability
          plus customer location, driver readiness, travel buffer, therapist
          status, and dispatch workflow. Online booking remains schedule-based.
        </p>
      </header>

      {/* ── Summary cards ────────────────────────────────────────────────────── */}
      <DispatchSummaryCards
        items={data.items}
        stats={data.stats}
        alertCount={data.alerts.length}
      />

      {/* ── Dispatch readiness alerts ─────────────────────────────────────────── */}
      <ReadinessIssueList
        issues={alertIssues}
        compact
        emptyTitle="No active dispatch alerts"
        emptyDescription="All home-service trips are progressing normally."
      />

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <div className="cs-card overflow-hidden">
        {/* Tab bar */}
        <div
          className="flex overflow-x-auto"
          style={{ borderBottom: "1px solid var(--cs-border)" }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "0.75rem 1.25rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                whiteSpace: "nowrap",
                background: "none",
                border: "none",
                borderBottom:
                  activeTab === tab.id
                    ? "2px solid var(--cs-sand)"
                    : "2px solid transparent",
                marginBottom: -1,
                color:
                  activeTab === tab.id
                    ? "var(--cs-text)"
                    : "var(--cs-text-secondary)",
                cursor: "pointer",
                transition: "color 0.15s, border-color 0.15s",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-4 md:p-6">
          {activeTab === "flow" && (
            <DispatchFlowTab data={data} role={role} />
          )}
          {activeTab === "map" && <DispatchLiveMapTab data={data} />}
          {activeTab === "progress" && (
            <DispatchTravelProgressTab data={data} />
          )}
        </div>
      </div>

      {/* ── Emergency actions + related tools ────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">
        <DispatchEmergencyActions />
        <DispatchRelatedTools />
      </div>
    </section>
  );
}
