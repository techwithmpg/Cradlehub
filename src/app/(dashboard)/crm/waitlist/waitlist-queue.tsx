"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { updateWaitlistStatusAction } from "./actions";

type WaitlistRow = {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  visit_type: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  services: { name: string } | { name: string }[] | null;
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  waiting:   { bg: "var(--cs-sand-mist)", color: "var(--cs-sand)" },
  contacted: { bg: "#EFF6FF",             color: "#1D4ED8" },
  converted: { bg: "#ECFDF5",             color: "#065F46" },
  expired:   { bg: "var(--cs-surface-warm)", color: "var(--cs-text-muted)" },
  cancelled: { bg: "#FEF2F2",             color: "#991B1B" },
};

const TABS = ["waiting", "contacted", "converted", "expired", "cancelled"] as const;
type TabKey = typeof TABS[number];

function first<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function StatusButton({
  requestId,
  current,
  target,
  label,
}: {
  requestId: string;
  current: string;
  target: TabKey;
  label: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await updateWaitlistStatusAction({ requestId, status: target });
    });
  }

  if (current === target) return null;

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      style={{
        padding: "3px 8px",
        borderRadius: 4,
        border: "1px solid var(--cs-border)",
        backgroundColor: "transparent",
        fontSize: "0.6875rem",
        fontWeight: 600,
        color: "var(--cs-text-muted)",
        cursor: isPending ? "default" : "pointer",
        opacity: isPending ? 0.5 : 1,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
    >
      {label}
    </button>
  );
}

export function WaitlistQueue({
  initialRows,
}: {
  initialRows: WaitlistRow[];
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("waiting");

  const filtered = initialRows.filter((r) => r.status === activeTab);
  const counts = TABS.reduce<Record<string, number>>((acc, t) => {
    acc[t] = initialRows.filter((r) => r.status === t).length;
    return acc;
  }, {});

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: "1rem", flexWrap: "wrap" }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "4px 10px",
              borderRadius: 20,
              border: "1px solid",
              fontSize: "0.75rem",
              fontWeight: 600,
              cursor: "pointer",
              textTransform: "capitalize",
              borderColor: activeTab === tab ? "var(--cs-sand)" : "var(--cs-border)",
              backgroundColor: activeTab === tab ? "var(--cs-sand-mist)" : "transparent",
              color: activeTab === tab ? "var(--cs-sand)" : "var(--cs-text-muted)",
            }}
          >
            {tab}
            {counts[tab]! > 0 && (
              <span style={{ marginLeft: 5, opacity: 0.75, fontSize: "0.6875rem", fontWeight: 700 }}>
                {counts[tab]}
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div
          style={{
            padding: "2rem",
            textAlign: "center",
            backgroundColor: "var(--cs-surface)",
            border: "1px solid var(--cs-border)",
            borderRadius: 10,
            color: "var(--cs-text-muted)",
            fontSize: "0.875rem",
          }}
        >
          No {activeTab} requests.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          {filtered.map((row) => {
            const svc = first(row.services);
            const style = STATUS_STYLE[row.status] ?? STATUS_STYLE["waiting"]!;

            return (
              <div
                key={row.id}
                className="cs-card"
                style={{ padding: "0.875rem 1rem" }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--cs-text)" }}>
                        {row.customer_name}
                      </span>
                      <span
                        style={{
                          fontSize: "0.625rem", fontWeight: 700, padding: "2px 6px", borderRadius: 3,
                          textTransform: "capitalize", ...style,
                        }}
                      >
                        {row.status}
                      </span>
                    </div>

                    <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)", marginBottom: 4 }}>
                      📞 {row.customer_phone}
                      {row.customer_email && <span style={{ marginLeft: 8 }}>✉ {row.customer_email}</span>}
                    </div>

                    <div style={{ display: "flex", gap: 12, fontSize: "0.8125rem", color: "var(--cs-text-muted)", flexWrap: "wrap" }}>
                      {row.preferred_date && (
                        <span>
                          📅 {new Date(row.preferred_date + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                          {row.preferred_time && ` ${row.preferred_time.substring(0, 5)}`}
                        </span>
                      )}
                      {svc && <span>💆 {svc.name}</span>}
                      {row.visit_type && (
                        <span>{row.visit_type === "home_service" ? "🏠 Home" : "🏢 In-Spa"}</span>
                      )}
                    </div>

                    {row.notes && (
                      <div style={{ marginTop: 6, fontSize: "0.8125rem", color: "var(--cs-text-muted)", fontStyle: "italic" }}>
                        &ldquo;{row.notes}&rdquo;
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0, alignItems: "flex-end" }}>
                    <div style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)", marginBottom: 4 }}>
                      {new Date(row.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                    </div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {row.status === "waiting" && (
                        <>
                          <StatusButton requestId={row.id} current={row.status} target="contacted" label="Mark Contacted" />
                          <StatusButton requestId={row.id} current={row.status} target="expired" label="Expire" />
                        </>
                      )}
                      {row.status === "contacted" && (
                        <>
                          <Link
                            href={`/crm/bookings/new?phone=${encodeURIComponent(row.customer_phone)}&name=${encodeURIComponent(row.customer_name)}`}
                            style={{
                              padding: "3px 8px", borderRadius: 4, border: "none",
                              backgroundColor: "var(--cs-sand)", color: "#fff",
                              fontSize: "0.6875rem", fontWeight: 600, textDecoration: "none",
                              textTransform: "uppercase", letterSpacing: "0.04em",
                            }}
                          >
                            Book
                          </Link>
                          <StatusButton requestId={row.id} current={row.status} target="converted" label="Mark Converted" />
                          <StatusButton requestId={row.id} current={row.status} target="expired" label="Expire" />
                        </>
                      )}
                      {(row.status === "waiting" || row.status === "contacted") && (
                        <StatusButton requestId={row.id} current={row.status} target="cancelled" label="Cancel" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
