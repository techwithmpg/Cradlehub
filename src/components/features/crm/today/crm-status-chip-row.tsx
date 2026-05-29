"use client";

import { Shield, AlertTriangle, CalendarDays, MessageSquare } from "lucide-react";
import { CrmStatusChip } from "./crm-status-chip";
import type { ReadinessIssue, ReadinessStatus } from "@/types/readiness";

export function CrmStatusChipRow({
  readinessStatus,
  readinessIssues,
  pendingPaymentsCount,
  actionRequiredCount,
  onOpenReadiness,
  onSwitchTab,
}: {
  readinessStatus: ReadinessStatus;
  readinessIssues: ReadinessIssue[];
  pendingPaymentsCount: number;
  actionRequiredCount: number;
  onOpenReadiness: () => void;
  onSwitchTab: (tab: "payments" | "actions") => void;
}) {
  const setupIssues = readinessIssues.filter((i) => i.scope === "setup").length;
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
        label="System Readiness"
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
        onClick={onOpenReadiness}
      />

      {setupIssues > 0 && (
        <CrmStatusChip
          label="Setup issues"
          value={setupIssues}
          icon={<AlertTriangle size={14} />}
          color="var(--cs-warning)"
          bg="var(--cs-warning-bg)"
          border="var(--cs-warning)"
          href="/crm/setup"
        />
      )}

      {pendingPaymentsCount > 0 && (
        <CrmStatusChip
          label="Payment pending"
          value={pendingPaymentsCount}
          icon={<CalendarDays size={14} />}
          color="var(--cs-error)"
          bg="var(--cs-error-bg)"
          border="var(--cs-error)"
          onClick={() => onSwitchTab("payments")}
        />
      )}

      {actionRequiredCount > 0 && (
        <CrmStatusChip
          label="Action Required"
          value={actionRequiredCount}
          icon={<MessageSquare size={14} />}
          color="var(--cs-error)"
          bg="var(--cs-error-bg)"
          border="var(--cs-error)"
          onClick={() => onSwitchTab("actions")}
        />
      )}

      {readinessStatus === "ok" && pendingPaymentsCount === 0 && actionRequiredCount === 0 && (
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
