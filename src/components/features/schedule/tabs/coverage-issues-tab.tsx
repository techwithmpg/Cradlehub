"use client";

import useSWR from "swr";
import { useRouter, useSearchParams } from "next/navigation";
import { SchedulePanel } from "../workspace/schedule-panel";
import { ScheduleEmptyState } from "../workspace/schedule-empty-state";
import { ScheduleActionTile } from "../workspace/schedule-action-tile";
import { Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import type { StaffAvailabilityItem } from "@/lib/queries/staff";
import { getStaffAdminName } from "@/lib/staff/display-name";

type CoverageData = {
  items: StaffAvailabilityItem[];
  rulesByGroup: Record<string, { day_of_week: number; shift_type: string; start_time: string; end_time: string }[]>;
};

async function fetcher(url: string): Promise<CoverageData> {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`Coverage fetch failed: ${res.status}`);
  return res.json();
}

export function CoverageIssuesTab({ branchId }: { branchId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, isLoading } = useSWR<CoverageData>(
    `/api/crm/staff-schedule/overview?branchId=${branchId}`,
    fetcher,
    { revalidateOnFocus: true, dedupingInterval: 30_000 }
  );

  if (isLoading) {
    return (
      <SchedulePanel>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "3rem 1rem" }}>
          <Loader2 size={18} style={{ animation: "spin 1s linear infinite", color: "var(--cs-text-muted)" }} />
          <span style={{ fontSize: "0.875rem", color: "var(--cs-text-muted)" }}>Loading coverage issues…</span>
        </div>
      </SchedulePanel>
    );
  }

  if (!data) {
    return (
      <ScheduleEmptyState
        title="Unable to load coverage data"
        description="There was a problem fetching schedule coverage information. Please try again."
      />
    );
  }

  const todayDow = new Date().getDay();
  const noSchedule = data.items.filter((i) => i.schedules.length === 0);
  const noOpeningToday = data.items.filter((i) => {
    if (i.schedules.length === 0) return false;
    const todaySched = i.schedules.filter((s) => s.day_of_week === todayDow && s.is_active);
    return todaySched.length > 0 && !todaySched.some((s) => s.shift_type === "opening");
  });
  const onLeaveToday = data.items.filter((i) =>
    i.overrides.some((o) => o.override_date === new Date().toISOString().split("T")[0] && o.is_day_off)
  );

  const totalIssues = noSchedule.length + noOpeningToday.length;

  function switchTab(tab: "setup" | "staff") {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  if (totalIssues === 0 && onLeaveToday.length === 0) {
    return (
      <ScheduleEmptyState
        title="No coverage issues for this week"
        description="Schedules and staff assignments look healthy. All staff have schedules and opening coverage is in place."
        icon={<ShieldCheck size={18} />}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {totalIssues > 0 && (
        <SchedulePanel title={`Coverage Issues (${totalIssues})`}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {noSchedule.length > 0 && (
              <div
                style={{
                  padding: "0.75rem",
                  borderRadius: "var(--cs-r-md)",
                  background: "var(--cs-error-bg)",
                  border: "1px solid var(--cs-error)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <AlertTriangle size={14} style={{ color: "var(--cs-error)" }} />
                  <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--cs-error)" }}>
                    {noSchedule.length} staff have no weekly schedule
                  </span>
                </div>
                <p style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", margin: 0 }}>
                  These staff cannot be assigned to bookings until a schedule is configured.
                </p>
              </div>
            )}

            {noOpeningToday.length > 0 && (
              <div
                style={{
                  padding: "0.75rem",
                  borderRadius: "var(--cs-r-md)",
                  background: "var(--cs-warning-bg)",
                  border: "1px solid var(--cs-warning)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <AlertTriangle size={14} style={{ color: "var(--cs-warning)" }} />
                  <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--cs-warning)" }}>
                    {noOpeningToday.length} staff with no opening shift today
                  </span>
                </div>
                <p style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", margin: 0 }}>
                  Early morning coverage may be insufficient.
                </p>
              </div>
            )}
          </div>
        </SchedulePanel>
      )}

      {onLeaveToday.length > 0 && (
        <SchedulePanel title={`On Leave Today (${onLeaveToday.length})`}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {onLeaveToday.map((i) => (
              <span
                key={i.staff.id}
                style={{
                  fontSize: "0.75rem",
                  padding: "4px 10px",
                  borderRadius: "var(--cs-r-pill)",
                  background: "var(--cs-info-bg)",
                  color: "var(--cs-info)",
                  border: "1px solid var(--cs-info)",
                }}
              >
                {getStaffAdminName(i.staff)}
              </span>
            ))}
          </div>
        </SchedulePanel>
      )}

      <SchedulePanel title="Quick Actions">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <ScheduleActionTile label="Open Schedule Setup" onClick={() => switchTab("setup")} primary />
          <ScheduleActionTile label="View Staff List" onClick={() => switchTab("staff")} />
          <ScheduleActionTile label="Add Override" onClick={() => switchTab("staff")} />
        </div>
      </SchedulePanel>
    </div>
  );
}
