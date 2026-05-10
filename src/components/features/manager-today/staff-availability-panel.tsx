"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import type { StaffAvailability } from "./manager-today-utils";

export function StaffAvailabilityPanel({
  staff,
}: {
  staff: StaffAvailability[];
}) {
  const available = staff.filter((s) => s.status === "available");
  const inService = staff.filter((s) => s.status === "in_service");
  const offDuty = staff.filter((s) => s.status === "off_duty");

  return (
    <div className="cs-card" style={{ padding: "1.25rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Users size={16} style={{ color: "var(--cs-manager-accent)" }} />
          <div
            style={{
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: "var(--cs-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Staff Availability
          </div>
        </div>
        <Link
          href="/manager/staff"
          style={{
            fontSize: "0.75rem",
            color: "var(--cs-sand)",
            textDecoration: "none",
            fontWeight: 500,
          }}
        >
          View All →
        </Link>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        {staff.slice(0, 8).map((s) => {
          const statusColor =
            s.status === "available"
              ? "#4A7C59"
              : s.status === "in_service"
              ? "var(--cs-sand)"
              : "var(--cs-text-muted)";
          const statusBg =
            s.status === "available"
              ? "var(--cs-success-bg)"
              : s.status === "in_service"
              ? "var(--cs-sand-mist)"
              : "var(--cs-surface-warm)";
          const statusLabel =
            s.status === "available"
              ? "Available"
              : s.status === "in_service"
              ? "In Service"
              : "Off Duty";

          return (
            <div
              key={s.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.5rem 0.625rem",
                borderRadius: "var(--cs-r-sm)",
                backgroundColor: "var(--cs-surface-warm)",
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  backgroundColor: "var(--cs-border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontWeight: 600,
                  color: "var(--cs-text-muted)",
                  flexShrink: 0,
                }}
              >
                {s.full_name.charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    color: "var(--cs-text)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {s.full_name}
                </div>
                {s.currentBooking && (
                  <div style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)" }}>
                    {s.currentBooking.service_name} · {s.currentBooking.start_time.slice(0, 5)}
                  </div>
                )}
              </div>
              <span
                style={{
                  fontSize: "0.625rem",
                  fontWeight: 600,
                  padding: "2px 6px",
                  borderRadius: 3,
                  backgroundColor: statusBg,
                  color: statusColor,
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                  flexShrink: 0,
                }}
              >
                {statusLabel}
              </span>
            </div>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          marginTop: "0.75rem",
          paddingTop: "0.75rem",
          borderTop: "1px solid var(--cs-border)",
        }}
      >
        {[
          { label: "Available", count: available.length, color: "#4A7C59" },
          { label: "In Service", count: inService.length, color: "var(--cs-sand)" },
          { label: "Off Duty", count: offDuty.length, color: "var(--cs-text-muted)" },
        ].map((stat) => (
          <div key={stat.label} style={{ textAlign: "center", flex: 1 }}>
            <div style={{ fontSize: "0.875rem", fontWeight: 700, color: stat.color }}>
              {stat.count}
            </div>
            <div style={{ fontSize: "0.625rem", color: "var(--cs-text-muted)", textTransform: "uppercase" }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
