"use client";

import { useState } from "react";
import { CheckCircle2, Home, Stethoscope } from "lucide-react";
import { TherapistServiceProgressCard } from "./therapist-service-progress-card";
import type { StaffPortalBooking } from "@/components/features/staff-portal/types";
import {
  StaffCard,
  StaffEmptyState,
  StaffScreen,
  StaffScreenHeader,
  StaffSegmentedControl,
  StaffStatTile,
} from "@/components/features/staff-pwa/native-foundation";
import {
  StaffSnapshotRecorder,
  useStaffSafeMemory,
} from "@/components/features/staff-pwa/safe-memory";

type Tab = "active" | "completed";

export function TherapistServiceProgressPage({
  active,
  completed,
}: {
  active: StaffPortalBooking[];
  completed: StaffPortalBooking[];
}) {
  const memory = useStaffSafeMemory();
  const [tab, setTab] = useState<Tab>(() =>
    memory?.readPreference("progressTab") === "completed" ? "completed" : "active"
  );
  const homeServiceCount = [...active, ...completed].filter(
    (booking) => booking.delivery_type === "home_service"
  ).length;

  return (
    <StaffScreen>
      <StaffSnapshotRecorder
        snapshot={{
          screen: "progress",
          label: "Service Progress",
          counts: [
            { label: "Completed", value: completed.length },
            { label: "Active", value: active.length },
            { label: "Home Service", value: homeServiceCount },
          ],
        }}
      />
      <StaffScreenHeader title="Service Progress" subtitle="Today’s work" />
      <StaffSegmentedControl
        label="Service progress"
        value={tab}
        onChange={(next) => {
          setTab(next);
          memory?.writePreference("progressTab", next);
        }}
        options={[
          { value: "active", label: `Active${active.length ? ` (${active.length})` : ""}` },
          {
            value: "completed",
            label: `Completed${completed.length ? ` (${completed.length})` : ""}`,
          },
        ]}
      />

      <StaffCard className="mt-4 p-3.5">
        <h2 className="mb-3 text-sm font-bold text-[#163a2b]">Today’s Summary</h2>
        <div className="grid grid-cols-3 gap-2">
          <StaffStatTile
            value={completed.length}
            label="Completed"
            icon={<CheckCircle2 size={18} className="mb-2 text-[#257a4c]" />}
          />
          <StaffStatTile
            value={active.length}
            label="Active"
            icon={<Stethoscope size={18} className="mb-2 text-[#396e82]" />}
          />
          <StaffStatTile
            value={homeServiceCount}
            label="Home Service"
            icon={<Home size={18} className="mb-2 text-[#956a2c]" />}
          />
        </div>
      </StaffCard>

      <div className="mt-4 space-y-3">
        {tab === "active" ? (
          active.length ? (
            active.map((booking) => (
              <TherapistServiceProgressCard key={booking.id} booking={booking} showControls />
            ))
          ) : (
            <StaffEmptyState
              icon={<Stethoscope size={24} className="shrink-0 text-[#6e8978]" />}
              title="No active service"
              description="Your next active assignment will appear here."
            />
          )
        ) : completed.length ? (
          completed.map((booking) => (
            <TherapistServiceProgressCard key={booking.id} booking={booking} showControls={false} />
          ))
        ) : (
          <StaffEmptyState
            icon={<CheckCircle2 size={24} className="shrink-0 text-[#6e8978]" />}
            title="No completed services"
            description="Finished services will appear here today."
          />
        )}
      </div>
    </StaffScreen>
  );
}
