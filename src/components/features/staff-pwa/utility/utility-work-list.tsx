"use client";

import Link from "next/link";
import { ChevronRight, DoorOpen, Sparkles } from "lucide-react";
import {
  StaffCard,
  StaffEmptyState,
  StaffFeedback,
  StaffScreen,
  StaffScreenHeader,
  StaffSegmentedControl,
  StaffStatusChip,
} from "@/components/features/staff-pwa/native-foundation";
import {
  StaffSnapshotRecorder,
  useStaffSafeMemory,
} from "@/components/features/staff-pwa/safe-memory";
import type {
  UtilityRoomTurnoverItem,
  UtilityWorkspaceRuntime,
} from "@/lib/staff-pwa/utility-runtime";

type Filter = "all" | "open" | "in_progress" | "completed";
type Mode = "tasks" | "rooms";

const filters: readonly { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Waiting" },
  { value: "in_progress", label: "Active" },
  { value: "completed", label: "Ready" },
];

function isFilter(value: string | null): value is Filter {
  return filters.some((option) => option.value === value);
}

function itemLabel(item: UtilityRoomTurnoverItem) {
  if (item.status === "completed") return "Ready";
  if (item.status === "in_progress") return "In progress";
  return "Waiting";
}

export function UtilityWorkList({
  runtime,
  mode = "tasks",
}: {
  runtime: UtilityWorkspaceRuntime;
  mode?: Mode;
}) {
  const memory = useStaffSafeMemory();
  const preferenceKey = mode === "rooms" ? "utilityRoomFilter" : "utilityTaskFilter";
  const savedFilter = memory?.readPreference(preferenceKey) ?? null;
  const filter: Filter = isFilter(savedFilter) ? savedFilter : "all";
  const allTasks = [...runtime.turnoverItems, ...runtime.recentCompletedItems];
  const seenRooms = new Set<string>();
  const items =
    mode === "rooms"
      ? allTasks.filter((item) => {
          if (seenRooms.has(item.resourceId)) return false;
          seenRooms.add(item.resourceId);
          return true;
        })
      : allTasks;
  const visible = items.filter((item) => filter === "all" || item.status === filter);
  const waiting = runtime.turnoverItems.filter((item) => item.status === "open").length;
  const active = runtime.turnoverItems.length - waiting;

  return (
    <StaffScreen>
      {!runtime.queueError && !runtime.historyError ? (
        <StaffSnapshotRecorder
          snapshot={{
            screen: mode === "rooms" ? "utilityRooms" : "utilityTasks",
            label: mode === "rooms" ? "Rooms" : "Turnover tasks",
            counts: [
              { label: "Waiting", value: waiting },
              { label: "In progress", value: active },
              { label: "Recent ready", value: runtime.recentCompletedItems.length },
            ],
          }}
        />
      ) : null}
      <StaffScreenHeader
        title={mode === "rooms" ? "Rooms" : "Turnover tasks"}
        subtitle={
          mode === "rooms"
            ? "Rooms with turnover work at your branch"
            : "Open work and recent ready rooms"
        }
      />
      <StaffSegmentedControl
        options={filters}
        value={filter}
        onChange={(next) => {
          memory?.writePreference(preferenceKey, next);
        }}
        label={mode === "rooms" ? "Room status filter" : "Task status filter"}
      />

      {runtime.queueError ? (
        <StaffFeedback error className="mt-4">
          Current room turnover tasks could not be loaded. No room state changed.
        </StaffFeedback>
      ) : null}
      {runtime.historyError && (filter === "all" || filter === "completed") ? (
        <StaffFeedback error className="mt-3">
          Recent ready rooms could not be loaded.
        </StaffFeedback>
      ) : null}

      <div className="mt-4 space-y-3">
        {visible.length === 0 && !runtime.queueError && !runtime.historyError ? (
          <StaffEmptyState
            icon={<Sparkles size={22} />}
            title={
              filter === "completed" ? "No rooms marked ready recently" : "No turnover tasks here"
            }
            description={
              filter === "completed"
                ? "The latest 30 completed tasks from seven days appear here."
                : "New tasks appear when onsite services with assigned rooms finish."
            }
          />
        ) : (
          visible.map((item) => (
            <Link
              key={item.taskId}
              href={`/staff/utility/work/${item.taskId}`}
              className="block rounded-[22px] focus-visible:outline-2 focus-visible:outline-[#c8a96b]"
            >
              <StaffCard className="flex min-h-20 items-center gap-3 p-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#f3e9d6] text-[#76501a]">
                  <DoorOpen size={22} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[#20342c]">
                    {item.roomName}
                  </span>
                  <span className="mt-1 block truncate text-xs text-[#65746b]">
                    {mode === "rooms" ? (item.resourceType ?? "Room") : item.serviceName}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <StaffStatusChip tone={item.status === "open" ? "gold" : "green"}>
                    {itemLabel(item)}
                  </StaffStatusChip>
                  <ChevronRight size={17} className="text-[#65746b]" aria-hidden="true" />
                </span>
              </StaffCard>
            </Link>
          ))
        )}
      </div>
      <p className="mt-5 text-center text-xs text-[#65746b]">
        Room status comes from the server. The Scan tab remains the Staff attendance scanner.
      </p>
    </StaffScreen>
  );
}
