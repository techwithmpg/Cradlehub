"use client";

import { useState } from "react";
import { Truck } from "lucide-react";
import { DriverMobileBottomNav } from "./driver-mobile-bottom-nav";
import { DriverDispatchCard } from "./driver-dispatch-card";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

type Tab = "upcoming" | "history";

type DriverDispatchPageProps = {
  upcoming: RealDispatchItem[];
  history: RealDispatchItem[];
};

function EmptyUpcoming() {
  return (
    <div style={{ backgroundColor: "#fff", borderRadius: 16, border: "1px solid var(--cs-border-soft)", padding: "2.5rem 1.5rem", textAlign: "center", boxShadow: "var(--cs-shadow-xs)", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.625rem" }}>
      <Truck size={30} color="var(--cs-text-muted)" style={{ opacity: 0.35 }} />
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--cs-text)" }}>No dispatch assigned</div>
      <div style={{ fontSize: 12.5, color: "var(--cs-text-muted)", lineHeight: 1.5 }}>
        CRM-assigned jobs will appear here once dispatched.
      </div>
    </div>
  );
}

function EmptyHistory() {
  return (
    <div style={{ backgroundColor: "#fff", borderRadius: 16, border: "1px solid var(--cs-border-soft)", padding: "2rem 1.5rem", textAlign: "center", boxShadow: "var(--cs-shadow-xs)" }}>
      <div style={{ fontSize: 13, color: "var(--cs-text-muted)" }}>No past jobs found.</div>
    </div>
  );
}

export function DriverDispatchPage({ upcoming, history }: DriverDispatchPageProps) {
  const [tab, setTab] = useState<Tab>("upcoming");
  const upCount = upcoming.length;

  return (
    <div style={{ minHeight: "100dvh", backgroundColor: "var(--cs-bg)", paddingBottom: 96 }}>
      <div style={{ backgroundColor: "#fff", borderBottom: "1px solid var(--cs-border-soft)", position: "sticky", top: 0, zIndex: 30 }}>
        <div style={{ padding: "0.875rem 1rem 0" }}>
          <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: "var(--cs-text)" }}>Dispatch</h1>
        </div>
        <div style={{ display: "flex", padding: "0.5rem 1rem 0" }}>
          {(["upcoming", "history"] as Tab[]).map((t) => {
            const isActive = tab === t;
            const label = t === "upcoming" ? `Upcoming${upCount > 0 ? ` (${upCount})` : ""}` : "History";
            return (
              <button key={t} type="button" onClick={() => setTab(t)} style={{ flex: 1, padding: "0.5rem 0 0.625rem", background: "none", border: "none", borderBottom: isActive ? "2px solid var(--cs-staff-accent)" : "2px solid transparent", fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? "var(--cs-staff-accent)" : "var(--cs-text-muted)", cursor: "pointer", transition: "color 120ms, border-color 120ms" }}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: "0.875rem 1rem", display: "flex", flexDirection: "column", gap: "0.625rem", maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
        {tab === "upcoming"
          ? upcoming.length === 0
            ? <EmptyUpcoming />
            : upcoming.map((item) => <DriverDispatchCard key={item.id} item={item} />)
          : history.length === 0
          ? <EmptyHistory />
          : history.map((item) => <DriverDispatchCard key={item.id} item={item} />)
        }
      </div>

      <DriverMobileBottomNav />
    </div>
  );
}
