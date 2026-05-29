"use client";

import { Shield, Users, AlertTriangle, DoorOpen, AlertOctagon } from "lucide-react";
import { CrmStatusChip } from "@/components/features/crm/today/crm-status-chip";
import type { ReadinessIssue, ReadinessStatus } from "@/types/readiness";
import type { ScheduleTabKey } from "./schedule-workspace-tabs";

export function ScheduleStatusChipRow({
  readinessStatus,
  readinessIssues,
  availableStaffCount,
  coverageIssueCount,
  roomsAvailable,
  totalRooms,
  conflictCount,
  onSwitchTab,
}: {
  readinessStatus: ReadinessStatus;
  readinessIssues: ReadinessIssue[];
  availableStaffCount: number;
  coverageIssueCount: number;
  roomsAvailable: number;
  totalRooms: number;
  conflictCount: number;
  onSwitchTab: (tab: ScheduleTabKey) => void;
}) {
  const criticalCount = readinessIssues.filter((i) => i.severity === "critical").length;
  const warningCount = readinessIssues.filter((i) => i.severity === "warning").length;

  const readinessValue =
    readinessStatus === "ok"
      ? "All Clear"
      : criticalCount > 0
      ? `${criticalCount} Critical`
      : warningCount > 0
      ? `${warningCount} Warning`
      : `${readinessIssues.length} Issue`;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0.625rem",
        marginBottom: "1.25rem",
        alignItems: "center",
      }}
    >
      <CrmStatusChip
        label="Schedule Ready"
        value={readinessValue}
        icon={<Shield size={14} />}
        color={
          readinessStatus === "ok"
            ? "var(--cs-success)"
            : readinessStatus === "critical"
            ? "var(--cs-error)"
            : "var(--cs-warning)"
        }
        bg={
          readinessStatus === "ok"
            ? "var(--cs-success-bg)"
            : readinessStatus === "critical"
            ? "var(--cs-error-bg)"
            : "var(--cs-warning-bg)"
        }
        border={
          readinessStatus === "ok"
            ? "var(--cs-success)"
            : readinessStatus === "critical"
            ? "var(--cs-error)"
            : "var(--cs-warning)"
        }
      />

      <CrmStatusChip
        label="Available Staff"
        value={availableStaffCount}
        icon={<Users size={14} />}
        color="var(--cs-crm-accent)"
        bg="var(--cs-success-bg)"
        border="var(--cs-success)"
        onClick={() => onSwitchTab("availability")}
      />

      {coverageIssueCount > 0 && (
        <CrmStatusChip
          label="Coverage Issues"
          value={coverageIssueCount}
          icon={<AlertTriangle size={14} />}
          color="var(--cs-warning)"
          bg="var(--cs-warning-bg)"
          border="var(--cs-warning)"
          onClick={() => onSwitchTab("coverage")}
        />
      )}

      <CrmStatusChip
        label="Rooms Available"
        value={`${roomsAvailable}/${totalRooms}`}
        icon={<DoorOpen size={14} />}
        color="var(--cs-info)"
        bg="var(--cs-info-bg)"
        border="var(--cs-info)"
      />

      {conflictCount > 0 && (
        <CrmStatusChip
          label="Conflicts"
          value={conflictCount}
          icon={<AlertOctagon size={14} />}
          color="var(--cs-error)"
          bg="var(--cs-error-bg)"
          border="var(--cs-error)"
        />
      )}

      {readinessStatus === "ok" && coverageIssueCount === 0 && conflictCount === 0 && (
        <CrmStatusChip
          label="All systems healthy"
          icon={<Shield size={14} />}
          color="var(--cs-success)"
          bg="var(--cs-success-bg)"
          border="var(--cs-success)"
        />
      )}
    </div>
  );
}
