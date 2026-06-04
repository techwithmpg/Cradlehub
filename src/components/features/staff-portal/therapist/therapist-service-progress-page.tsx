"use client";

import { useState } from "react";
import { CheckCircle2, Stethoscope } from "lucide-react";
import { TherapistServiceProgressCard } from "./therapist-service-progress-card";
import type { StaffPortalBooking } from "@/components/features/staff-portal/types";

type Tab = "active" | "completed";

type TherapistServiceProgressPageProps = {
  active: StaffPortalBooking[];
  completed: StaffPortalBooking[];
};

function EmptyActive() {
  return (
    <div
      style={{
        backgroundColor: "#fff",
        borderRadius: 16,
        border: "1px solid var(--cs-border-soft)",
        padding: "2.5rem 1.5rem",
        textAlign: "center",
        boxShadow: "var(--cs-shadow-xs)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.625rem",
      }}
    >
      <Stethoscope size={30} color="var(--cs-text-muted)" style={{ opacity: 0.35 }} />
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--cs-text)" }}>
        No active service
      </div>
      <div style={{ fontSize: 12.5, color: "var(--cs-text-muted)", lineHeight: 1.5 }}>
        Your active service will appear here when CRM assigns or starts one.
      </div>
    </div>
  );
}

function EmptyCompleted() {
  return (
    <div
      style={{
        backgroundColor: "#fff",
        borderRadius: 16,
        border: "1px solid var(--cs-border-soft)",
        padding: "2rem 1.5rem",
        textAlign: "center",
        boxShadow: "var(--cs-shadow-xs)",
      }}
    >
      <div style={{ fontSize: 13, color: "var(--cs-text-muted)" }}>
        No completed services yet today.
      </div>
    </div>
  );
}

function CompletedCard({ booking }: { booking: StaffPortalBooking }) {
  return (
    <TherapistServiceProgressCard booking={booking} showControls={false} />
  );
}

export function TherapistServiceProgressPage({
  active,
  completed,
}: TherapistServiceProgressPageProps) {
  const [tab, setTab] = useState<Tab>("active");

  const activeCount = active.length;

  return (
    <div
      style={{
        minHeight: "100dvh",
        backgroundColor: "var(--cs-bg)",
      }}
    >
      {/* Sticky header */}
      <div
        style={{
          backgroundColor: "#fff",
          borderBottom: "1px solid var(--cs-border-soft)",
          position: "sticky",
          top: 0,
          zIndex: 30,
        }}
      >
        <div style={{ padding: "0.875rem 1rem 0" }}>
          <h1
            style={{ margin: 0, fontSize: 19, fontWeight: 700, color: "var(--cs-text)" }}
          >
            Service Progress
          </h1>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", padding: "0.5rem 1rem 0", gap: 0 }}>
          {(["active", "completed"] as Tab[]).map((t) => {
            const isActive = tab === t;
            const label = t === "active" ? `Active${activeCount > 0 ? ` (${activeCount})` : ""}` : "Completed";
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                style={{
                  flex: 1,
                  padding: "0.5rem 0 0.625rem",
                  background: "none",
                  border: "none",
                  borderBottom: isActive
                    ? "2px solid var(--cs-staff-accent)"
                    : "2px solid transparent",
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? "var(--cs-staff-accent)" : "var(--cs-text-muted)",
                  cursor: "pointer",
                  transition: "color 120ms ease, border-color 120ms ease",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          padding: "0.875rem 1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          maxWidth: 480,
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        {tab === "active" ? (
          active.length === 0 ? (
            <EmptyActive />
          ) : (
            <>
              {/* Highlight first active as "current service" */}
              {active.map((booking, idx) => (
                <div key={booking.id}>
                  {idx === 0 && (
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: "var(--cs-text-muted)",
                        marginBottom: "0.375rem",
                      }}
                    >
                      {active.length > 1 ? "Current Service" : "Today's Service"}
                    </div>
                  )}
                  {idx === 1 && (
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: "var(--cs-text-muted)",
                        marginBottom: "0.375rem",
                        marginTop: "0.25rem",
                      }}
                    >
                      {"Today's Services"}
                    </div>
                  )}
                  <TherapistServiceProgressCard booking={booking} showControls />
                </div>
              ))}
            </>
          )
        ) : completed.length === 0 ? (
          <EmptyCompleted />
        ) : (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                color: "var(--cs-success)",
                fontWeight: 600,
              }}
            >
              <CheckCircle2 size={14} />
              {completed.length} service{completed.length !== 1 ? "s" : ""} completed today
            </div>
            {completed.map((booking) => (
              <CompletedCard key={booking.id} booking={booking} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
