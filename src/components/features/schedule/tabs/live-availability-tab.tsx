"use client";

import useSWR from "swr";
import { SchedulePanel } from "../workspace/schedule-panel";
import { ScheduleEmptyState } from "../workspace/schedule-empty-state";
import { Users, Loader2 } from "lucide-react";
import type { CrmAvailabilitySnapshot } from "@/lib/queries/crm-availability";

async function fetcher(url: string): Promise<CrmAvailabilitySnapshot> {
  const res = await fetch(url, { credentials: "same-origin", cache: "no-store" });
  if (!res.ok) throw new Error(`Availability fetch failed: ${res.status}`);
  return res.json();
}

export function LiveAvailabilityTab({ branchId, date }: { branchId: string; date: string }) {
  const { data: snapshot, isLoading } = useSWR<CrmAvailabilitySnapshot>(
    `/api/crm/availability?branchId=${branchId}&date=${date}`,
    fetcher,
    { revalidateOnFocus: true, revalidateOnMount: true, dedupingInterval: 0 }
  );

  if (isLoading) {
    return (
      <SchedulePanel>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "3rem 1rem" }}>
          <Loader2 size={18} style={{ animation: "spin 1s linear infinite", color: "var(--cs-text-muted)" }} />
          <span style={{ fontSize: "0.875rem", color: "var(--cs-text-muted)" }}>Loading availability…</span>
        </div>
      </SchedulePanel>
    );
  }

  if (!snapshot) {
    return (
      <ScheduleEmptyState
        title="Unable to load availability"
        description="There was a problem fetching live availability data. Please try again."
      />
    );
  }

  const availableNow = snapshot.staff.filter((s) => s.liveStatus === "available_now");
  const busyNow = snapshot.staff.filter((s) => s.liveStatus === "busy_now");
  const notCheckedIn = snapshot.staff.filter((s) => s.liveStatus === "not_checked_in");
  const offToday = snapshot.staff.filter((s) => s.liveStatus === "off_today");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <SchedulePanel title="Available Staff Now">
        {availableNow.length === 0 ? (
          <ScheduleEmptyState
            title="No staff available right now"
            description="All scheduled staff are either busy or not checked in yet."
            icon={<Users size={18} />}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {availableNow.slice(0, 8).map((staff) => (
              <div
                key={staff.staff_id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.5rem 0.625rem",
                  borderRadius: "var(--cs-r-sm)",
                  background: "var(--cs-surface-warm)",
                }}
              >
                <div>
                  <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--cs-text)" }}>
                    {staff.staff_name}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>{staff.staff_type}</div>
                </div>
                <span
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: "var(--cs-r-pill)",
                    background: "var(--cs-success-bg)",
                    color: "var(--cs-success)",
                  }}
                >
                  Available
                </span>
              </div>
            ))}
            {availableNow.length > 8 && (
              <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", textAlign: "center", padding: "0.5rem" }}>
                +{availableNow.length - 8} more staff
              </div>
            )}
          </div>
        )}
      </SchedulePanel>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        <SchedulePanel title="Busy / Assigned">
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--cs-text)", fontFamily: "var(--font-display)" }}>
            {busyNow.length}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>Currently with customers</div>
        </SchedulePanel>
        <SchedulePanel title="Not Checked In">
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--cs-text)", fontFamily: "var(--font-display)" }}>
            {notCheckedIn.length}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>Scheduled but not checked in</div>
        </SchedulePanel>
      </div>

      {offToday.length > 0 && (
        <SchedulePanel title="Off Today">
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {offToday.slice(0, 10).map((staff) => (
              <span
                key={staff.staff_id}
                style={{
                  fontSize: "0.75rem",
                  padding: "4px 10px",
                  borderRadius: "var(--cs-r-pill)",
                  background: "var(--cs-surface-warm)",
                  color: "var(--cs-text-muted)",
                  border: "1px solid var(--cs-border-soft)",
                }}
              >
                {staff.staff_name}
              </span>
            ))}
            {offToday.length > 10 && (
              <span style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", padding: "4px 10px" }}>
                +{offToday.length - 10} more
              </span>
            )}
          </div>
        </SchedulePanel>
      )}
    </div>
  );
}
