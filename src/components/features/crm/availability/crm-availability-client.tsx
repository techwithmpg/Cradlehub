"use client";

import { useState } from "react";
import { CrmAvailabilityBoard } from "./crm-availability-board";
import type { CrmAvailabilitySnapshot } from "@/lib/queries/crm-availability";

type Tab = "all" | "service" | "driver" | "issues";

const TABS: { id: Tab; label: string }[] = [
  { id: "all",     label: "All Staff" },
  { id: "service", label: "Service Providers" },
  { id: "driver",  label: "Drivers" },
  { id: "issues",  label: "Schedule Issues" },
];

type Props = {
  snapshot: CrmAvailabilitySnapshot;
};

export function CrmAvailabilityClient({ snapshot }: Props) {
  const [tab, setTab] = useState<Tab>("all");

  const issueCount = snapshot.staff.filter((s) => s.scheduleStatus === "no_schedule").length;

  return (
    <div>
      {/* Tab bar */}
      <div
        style={{
          display:      "flex",
          gap:          2,
          marginBottom: "1rem",
          borderBottom: "1px solid var(--cs-border-soft)",
          paddingBottom: 0,
        }}
      >
        {TABS.map((t) => {
          const isActive = tab === t.id;
          const badge = t.id === "issues" && issueCount > 0 ? issueCount : null;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                padding:          "8px 14px",
                fontSize:         13,
                fontWeight:       isActive ? 500 : 400,
                color:            isActive ? "var(--cs-text)" : "var(--cs-text-muted)",
                background:       "transparent",
                border:           "none",
                borderBottom:     isActive ? "2px solid var(--cs-sand)" : "2px solid transparent",
                cursor:           "pointer",
                display:          "flex",
                alignItems:       "center",
                gap:              6,
                marginBottom:     -1,
                transition:       "color 0.15s",
              }}
            >
              {t.label}
              {badge !== null && (
                <span
                  style={{
                    display:         "inline-flex",
                    alignItems:      "center",
                    justifyContent:  "center",
                    minWidth:        18,
                    height:          18,
                    borderRadius:    9,
                    background:      "var(--cs-warning)",
                    color:           "var(--cs-text-inverse)",
                    fontSize:        10,
                    fontWeight:      600,
                    padding:         "0 5px",
                  }}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <CrmAvailabilityBoard staff={snapshot.staff} filter={tab} />

      <div
        style={{
          marginTop: "0.75rem",
          fontSize:  11,
          color:     "var(--cs-text-muted)",
        }}
      >
        As of {new Date(snapshot.asOf).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.
        Schedule-based — does not reflect physical check-in.
      </div>
    </div>
  );
}
