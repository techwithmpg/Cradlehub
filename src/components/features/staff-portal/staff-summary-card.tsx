"use client";

import { Activity } from "lucide-react";
import type { StaffPortalStaff } from "./types";
import { STAFF_TYPE_LABELS } from "@/constants/staff";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function tierLabel(tier: string | null): string {
  if (tier === "senior") return "Senior";
  if (tier === "mid") return "Mid";
  if (tier === "junior") return "Amateur";
  return tier ?? "";
}

type StaffSummaryCardProps = {
  staff: StaffPortalStaff;
  totalAppointments: number;
  nextAppointmentTime: string | null;
};

export function StaffSummaryCard({ staff, totalAppointments, nextAppointmentTime }: StaffSummaryCardProps) {
  const firstName = staff.full_name.split(" ")[0];
  const roleLabel = STAFF_TYPE_LABELS[staff.staff_type as keyof typeof STAFF_TYPE_LABELS] ?? "Staff";
  const tier = tierLabel(staff.tier);
  const todayLabel = new Date().toLocaleDateString("en-PH", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <div
      className="cs-card"
      style={{
        padding: "1rem 1.125rem",
        borderLeft: "4px solid var(--cs-staff-accent)",
        display: "flex",
        alignItems: "center",
        gap: "0.875rem",
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: "linear-gradient(135deg, var(--cs-staff-accent), var(--cs-sand))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          fontWeight: 700,
          color: "#fff",
          flexShrink: 0,
        }}
      >
        {staff.full_name.charAt(0).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--cs-text)", lineHeight: 1.3 }}>
          Good {getGreeting()}, {firstName}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--cs-text-muted)", marginTop: 2, lineHeight: 1.4 }}>
          {todayLabel}
          <span style={{ marginLeft: 5 }}>&middot; {roleLabel}</span>
          {tier && <span style={{ marginLeft: 5 }}>&middot; {tier}</span>}
          <span style={{ marginLeft: 5 }}>&middot; {totalAppointments} appointment{totalAppointments !== 1 ? "s" : ""} today</span>
          {nextAppointmentTime && (
            <span style={{ marginLeft: 5 }}>&middot; Next at {nextAppointmentTime}</span>
          )}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          fontSize: 11,
          fontWeight: 500,
          color: "var(--cs-success)",
          backgroundColor: "var(--cs-success-bg)",
          padding: "3px 8px",
          borderRadius: "var(--cs-r-pill)",
          flexShrink: 0,
        }}
      >
        <Activity size={12} />
        Live
      </div>
    </div>
  );
}
