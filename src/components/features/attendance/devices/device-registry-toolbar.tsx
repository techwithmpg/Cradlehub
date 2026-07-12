"use client";

import { Button } from "@/components/ui/button";
import {
  ToolbarSearch,
  ToolbarSelect,
  ToolbarShell,
} from "@/components/features/attendance/attendance-ui";
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
    <ToolbarShell
      fieldsClassName="md:grid-cols-[minmax(220px,1.2fr)_minmax(150px,0.75fr)_minmax(150px,0.75fr)_minmax(150px,0.75fr)]"
      actions={<Button type="button" variant="outline" onClick={onClear}>Clear</Button>}
    >
      <ToolbarSearch
        label="Search"
        value={query}
        onChange={onQueryChange}
        placeholder="Search staff or device..."
      />
      {canSwitchBranch ? (
        <ToolbarSelect
          label="Branch"
          value={branchId}
          onChange={onBranchChange}
        >
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>{branch.name}</option>
          ))}
        </ToolbarSelect>
      ) : null}
      <ToolbarSelect
        label="Status"
        value={status}
        onChange={(value) => onStatusChange(value as "all" | AttendanceDeviceStatus)}
      >
        {DEVICE_STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </ToolbarSelect>
      <ToolbarSelect
        label="Staff Type"
        value={staffType}
        onChange={onStaffTypeChange}
      >
        <option value="all">All Staff Types</option>
        {staffTypes.map((type) => (
          <option key={type} value={type}>{type.replaceAll("_", " ")}</option>
        ))}
      </ToolbarSelect>
    </ToolbarShell>
  );
}
