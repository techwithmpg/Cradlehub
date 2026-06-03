"use client";

import { useState } from "react";
import { BriefcaseBusiness } from "lucide-react";
import { DriverMobileBottomNav } from "./driver-mobile-bottom-nav";
import { DriverJobCard } from "./driver-job-card";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

type Tab = "today" | "all";

type DriverJobsListPageProps = {
  today: RealDispatchItem[];
  recent: RealDispatchItem[];
};

function SummaryStrip({ items }: { items: RealDispatchItem[] }) {
  const total = items.length;
  const completed = items.filter((i) => i.dispatchStatus === "completed").length;
  const inProgress = items.filter((i) => ["in_route", "arrived_at_customer", "service_started"].includes(i.dispatchStatus)).length;
  const upcoming = items.filter((i) => ["ready", "awaiting_driver"].includes(i.dispatchStatus)).length;

  return (
    <div style={{ display: "flex", gap: "0.75rem", padding: "0.75rem 0", flexWrap: "wrap" }}>
      {[{ label: "Total", value: total, color: "var(--cs-text)" },
        { label: "Completed", value: completed, color: "var(--cs-success)" },
        { label: "In Progress", value: inProgress, color: "#7C3AED" },
        { label: "Upcoming", value: upcoming, color: "#92700A" },
      ].map(({ label, value, color }) => (
        <div key={label} style={{ textAlign: "center", minWidth: 52 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{value}</div>
          <div style={{ fontSize: 10, color: "var(--cs-text-muted)", marginTop: 1 }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

function EmptyJobs() {
  return (
    <div style={{ backgroundColor: "#fff", borderRadius: 16, border: "1px solid var(--cs-border-soft)", padding: "2.5rem 1.5rem", textAlign: "center", boxShadow: "var(--cs-shadow-xs)", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.625rem" }}>
      <BriefcaseBusiness size={30} color="var(--cs-text-muted)" style={{ opacity: 0.35 }} />
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--cs-text)" }}>No jobs assigned</div>
      <div style={{ fontSize: 12.5, color: "var(--cs-text-muted)", lineHeight: 1.5 }}>
        Your assigned dispatch jobs will appear here.
      </div>
    </div>
  );
}

export function DriverJobsListPage({ today, recent }: DriverJobsListPageProps) {
  const [tab, setTab] = useState<Tab>("today");

  const items = tab === "today" ? today : recent;

  return (
    <div style={{ minHeight: "100dvh", backgroundColor: "var(--cs-bg)", paddingBottom: 96 }}>
      <div style={{ backgroundColor: "#fff", borderBottom: "1px solid var(--cs-border-soft)", position: "sticky", top: 0, zIndex: 30 }}>
        <div style={{ padding: "0.875rem 1rem 0" }}>
          <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: "var(--cs-text)" }}>Jobs</h1>
        </div>
        <div style={{ display: "flex", padding: "0.5rem 1rem 0" }}>
          {(["today", "all"] as Tab[]).map((t) => {
            const isActive = tab === t;
            const label = t === "today" ? `Today (${today.length})` : "All";
            return (
              <button key={t} type="button" onClick={() => setTab(t)} style={{ flex: 1, padding: "0.5rem 0 0.625rem", background: "none", border: "none", borderBottom: isActive ? "2px solid var(--cs-staff-accent)" : "2px solid transparent", fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? "var(--cs-staff-accent)" : "var(--cs-text-muted)", cursor: "pointer", transition: "color 120ms, border-color 120ms" }}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: "0 1rem", maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
        <SummaryStrip items={items} />
      </div>

      <div style={{ padding: "0 1rem 0.875rem", display: "flex", flexDirection: "column", gap: "0.625rem", maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
        {items.length === 0 ? <EmptyJobs /> : items.map((item) => <DriverJobCard key={item.id} item={item} />)}
      </div>

      <DriverMobileBottomNav />
    </div>
  );
}
