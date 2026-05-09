"use client";

import { MapPin } from "lucide-react";
import type { DailyScheduleStaffRow } from "@/lib/queries/schedule";
import type { Database } from "@/types/supabase";

type ResourceRow = Database["public"]["Tables"]["branch_resources"]["Row"];

type ScheduleStaffProfileCardProps = {
  staff: DailyScheduleStaffRow;
  branchResources?: ResourceRow[];
};

function formatStaffLabel(staff: DailyScheduleStaffRow): string {
  if (!staff.staff_tier) return "Staff";
  const tier = staff.staff_tier.toLowerCase();
  if (tier === "senior") return "Senior Therapist";
  if (tier === "mid") return "Therapist";
  if (tier === "junior") return "Junior Therapist";
  return staff.staff_tier.charAt(0).toUpperCase() + staff.staff_tier.slice(1);
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function ScheduleStaffProfileCard({ staff, branchResources }: ScheduleStaffProfileCardProps) {
  const isOff = !staff.work_start || !staff.work_end;
  const assignedResource = branchResources?.find((r) =>
    staff.bookings.some((b) => b.resource_id === r.id)
  );

  return (
    <div
      style={{
        backgroundColor: "var(--cs-surface)",
        border: "1px solid var(--cs-border)",
        borderRadius: 10,
        padding: "1rem 1.125rem",
        display: "flex",
        alignItems: "center",
        gap: "0.875rem",
        minWidth: 0,
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          backgroundColor: isOff ? "#E5E0DB" : "#E8F5E9",
          color: isOff ? "#8A7A6A" : "#4A7C59",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "0.875rem",
          fontWeight: 700,
          flexShrink: 0,
          fontFamily: "var(--font-playfair, serif)",
        }}
      >
        {getInitials(staff.staff_name)}
      </div>

      {/* Info */}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: "0.9375rem",
            fontWeight: 700,
            color: "var(--cs-text)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {staff.staff_name}
        </div>
        <div
          style={{
            fontSize: "0.75rem",
            color: "var(--cs-text-muted)",
            marginTop: 2,
          }}
        >
          {formatStaffLabel(staff)}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginTop: 6,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              backgroundColor: isOff ? "#BDBDBD" : "#4A7C59",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: "0.6875rem",
              fontWeight: 600,
              color: isOff ? "var(--cs-text-muted)" : "#4A7C59",
            }}
          >
            {isOff ? "Off Today" : "Available"}
          </span>
          {assignedResource && (
            <span
              style={{
                fontSize: "0.6875rem",
                color: "var(--cs-text-muted)",
                display: "flex",
                alignItems: "center",
                gap: 3,
              }}
            >
              <MapPin size={11} />
              {assignedResource.name}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
