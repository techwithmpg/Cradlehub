"use client";

import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AttendanceDeviceStatus } from "@/lib/attendance/types";

export const DEVICE_STATUS_OPTIONS: Array<{ value: "all" | AttendanceDeviceStatus; label: string }> = [
  { value: "all", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "never_used", label: "Never used" },
  { value: "recovery_pending", label: "Recovery pending" },
  { value: "revoked", label: "Revoked" },
  { value: "no_device", label: "No device" },
  { value: "inactive_staff", label: "Inactive staff" },
];

export function DeviceRegistryToolbar({
  query,
  onQueryChange,
  branchId,
  onBranchChange,
  branches,
  canSwitchBranch,
  status,
  onStatusChange,
  staffType,
  onStaffTypeChange,
  staffTypes,
  onClear,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  branchId: string;
  onBranchChange: (value: string) => void;
  branches: Array<{ id: string; name: string }>;
  canSwitchBranch: boolean;
  status: "all" | AttendanceDeviceStatus;
  onStatusChange: (value: "all" | AttendanceDeviceStatus) => void;
  staffType: string;
  onStaffTypeChange: (value: string) => void;
  staffTypes: string[];
  onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-stone-200 bg-white p-3">
      <label className="flex h-9 min-w-64 flex-1 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3">
        <Search className="size-4 text-stone-500" />
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search staff or device..."
          className="h-7 border-0 px-0 shadow-none focus-visible:ring-0"
        />
      </label>
      {canSwitchBranch ? (
        <select
          value={branchId}
          onChange={(event) => onBranchChange(event.target.value)}
          className="h-9 rounded-lg border border-stone-200 bg-white px-3 text-sm font-semibold"
        >
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>{branch.name}</option>
          ))}
        </select>
      ) : null}
      <select
        value={status}
        onChange={(event) => onStatusChange(event.target.value as "all" | AttendanceDeviceStatus)}
        className="h-9 rounded-lg border border-stone-200 bg-white px-3 text-sm font-semibold"
      >
        {DEVICE_STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <select
        value={staffType}
        onChange={(event) => onStaffTypeChange(event.target.value)}
        className="h-9 rounded-lg border border-stone-200 bg-white px-3 text-sm font-semibold"
      >
        <option value="all">All Staff Types</option>
        {staffTypes.map((type) => (
          <option key={type} value={type}>{type.replaceAll("_", " ")}</option>
        ))}
      </select>
      <Button type="button" variant="outline" onClick={onClear}>Clear</Button>
    </div>
  );
}
