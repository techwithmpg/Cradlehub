"use client";

import { CalendarX2, Clock, AlertCircle } from "lucide-react";
import type { StaffScheduleItem } from "./staff-schedule-types";
import { getStaffAdminName } from "@/lib/staff/display-name";

type Props = {
  items: StaffScheduleItem[];
};

export function ScheduleOverridesView({ items }: Props) {
  const staffWithOverrides = items.filter((i) => i.overrides.length > 0);
  const staffWithBlocks = items.filter((i) => i.blockedTimes.length > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Info banner */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 14px",
          background: "var(--cs-info-bg)",
          border: "1px solid var(--cs-info-bg)",
          borderRadius: "var(--cs-r-md)",
        }}
      >
        <AlertCircle size={14} style={{ color: "var(--cs-info)", flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: "var(--cs-info-text)" }}>
          One-time changes and blocked time stay tied to the selected staff member&apos;s
          individual schedule.
        </span>
      </div>

      {/* Day-off overrides */}
      <div
        style={{
          background: "var(--cs-surface)",
          border: "1px solid var(--cs-border-soft)",
          borderRadius: "var(--cs-r-lg)",
          padding: "16px 20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <CalendarX2 size={15} style={{ color: "var(--cs-warning)" }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--cs-text)" }}>
            Day-Off Overrides
          </span>
          <span
            style={{
              marginLeft: "auto",
              fontSize: 11,
              fontWeight: 600,
              color: "var(--cs-text-muted)",
              background: "var(--cs-bg)",
              padding: "2px 8px",
              borderRadius: "var(--cs-r-pill)",
            }}
          >
            {staffWithOverrides.length} staff
          </span>
        </div>

        {staffWithOverrides.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--cs-text-muted)", padding: "12px 0" }}>
            No upcoming day-off overrides.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {staffWithOverrides.map((item) => (
              <div
                key={item.staff.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 10px",
                  background: "var(--cs-surface-warm)",
                  borderRadius: "var(--cs-r-sm)",
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--cs-text)" }}>
                    {getStaffAdminName(item.staff)}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--cs-text-muted)", marginTop: 2 }}>
                    {(item.staff.staff_type ?? "staff").replace("_", " ")}
                    {item.staff.tier ? ` · ${item.staff.tier}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, textAlign: "right" }}>
                  {item.overrides.map((o) => (
                    <span key={o.id} style={{ fontSize: 11, color: "var(--cs-text-secondary)" }}>
                      {o.override_date}{" "}
                      {o.is_day_off ? (
                        <span style={{ color: "var(--cs-warning)", fontWeight: 500 }}>Day off</span>
                      ) : (
                        <span>
                          {o.start_time ?? "—"} – {o.end_time ?? "—"}
                        </span>
                      )}
                      {o.reason ? ` · ${o.reason}` : ""}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Blocked times */}
      <div
        style={{
          background: "var(--cs-surface)",
          border: "1px solid var(--cs-border-soft)",
          borderRadius: "var(--cs-r-lg)",
          padding: "16px 20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Clock size={15} style={{ color: "var(--cs-error)" }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--cs-text)" }}>
            Blocked Times
          </span>
          <span
            style={{
              marginLeft: "auto",
              fontSize: 11,
              fontWeight: 600,
              color: "var(--cs-text-muted)",
              background: "var(--cs-bg)",
              padding: "2px 8px",
              borderRadius: "var(--cs-r-pill)",
            }}
          >
            {staffWithBlocks.length} staff
          </span>
        </div>

        {staffWithBlocks.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--cs-text-muted)", padding: "12px 0" }}>
            No upcoming blocked times.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {staffWithBlocks.map((item) => (
              <div
                key={item.staff.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 10px",
                  background: "var(--cs-surface-warm)",
                  borderRadius: "var(--cs-r-sm)",
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--cs-text)" }}>
                    {getStaffAdminName(item.staff)}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--cs-text-muted)", marginTop: 2 }}>
                    {(item.staff.staff_type ?? "staff").replace("_", " ")}
                    {item.staff.tier ? ` · ${item.staff.tier}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, textAlign: "right" }}>
                  {item.blockedTimes.map((b) => (
                    <span key={b.id} style={{ fontSize: 11, color: "var(--cs-text-secondary)" }}>
                      {b.block_date} · {b.start_time} – {b.end_time}
                      {b.reason ? ` · ${b.reason}` : ""}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
