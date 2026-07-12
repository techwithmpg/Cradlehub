"use client";

import { useState } from "react";
import { CheckCircle2, AlertCircle, Clock, Users, ShieldCheck } from "lucide-react";
import type { ScoredStaff } from "@/lib/assignments/recommendation-engine";

const statusStyles: Record<string, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
  recommended: { bg: "var(--cs-success-bg)", text: "var(--cs-success-text)", icon: CheckCircle2 },
  available: { bg: "var(--cs-info-bg)", text: "var(--cs-info-text)", icon: ShieldCheck },
  warning: { bg: "var(--cs-warning-bg)", text: "var(--cs-warning-text)", icon: AlertCircle },
  unavailable: { bg: "var(--cs-error-bg)", text: "var(--cs-error-text)", icon: AlertCircle },
};

const overrideReasons = [
  { value: "customer_requested", label: "Customer requested" },
  { value: "therapist_on_break", label: "Therapist on break" },
  { value: "manager_decision", label: "Manager decision" },
  { value: "skill_or_service_mismatch", label: "Skill or service mismatch" },
  { value: "workload_balance", label: "Workload balance" },
  { value: "other", label: "Other" },
];

type Props = {
  candidate: ScoredStaff;
  onAssign?: (staffId: string, overrideReason?: string) => void;
  assignLabel?: string;
  isAssigned?: boolean;
  topSuggestedId?: string;
};

export function AssignmentRecommendationCard({
  candidate,
  onAssign,
  assignLabel = "Assign",
  isAssigned = false,
  topSuggestedId,
}: Props) {
  const [selectedReason, setSelectedReason] = useState("");
  const [showReason, setShowReason] = useState(false);
  const style = statusStyles[candidate.status] ?? statusStyles.available;
  if (!style) return null;
  const Icon = style.icon;

  const requiresOverrideReason =
    topSuggestedId !== undefined &&
    candidate.staffId !== topSuggestedId &&
    candidate.status !== "unavailable";
  const canAssign = candidate.status !== "unavailable" && !isAssigned;

  const handleAssign = () => {
    if (!canAssign) return;
    if (requiresOverrideReason && !selectedReason) {
      setShowReason(true);
      return;
    }
    onAssign?.(candidate.staffId, selectedReason || undefined);
    setShowReason(false);
  };

  const attendanceLabel =
    candidate.attendanceState === "checked_in"
      ? "Checked in"
      : candidate.attendanceState === "checked_out"
        ? "Clocked out"
        : candidate.attendanceState === "not_arrived"
          ? "Not clocked in"
          : "Attendance unknown";

  return (
    <div
      style={{
        padding: 12,
        borderRadius: "var(--cs-r-sm)",
        backgroundColor: "var(--cs-surface-elevated)",
        border: "1px solid var(--cs-border-soft)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        opacity: candidate.status === "unavailable" ? 0.65 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--cs-text)" }}>{candidate.displayName}</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: "2px 6px",
                borderRadius: 999,
                backgroundColor: style.bg,
                color: style.text,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Icon size={10} />
              {candidate.status}
            </span>
            {candidate.queuePosition !== undefined && candidate.queuePosition !== null && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "2px 6px",
                  borderRadius: 999,
                  backgroundColor: "var(--cs-sand-mist)",
                  color: "var(--cs-sand-dark)",
                }}
              >
                Queue #{candidate.queuePosition}
              </span>
            )}
          </div>

          <div style={{ fontSize: 11, color: "var(--cs-text-muted)", display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span>{candidate.roleLabel}</span>
            {candidate.tier && <span>Tier {candidate.tier}</span>}
            {candidate.workloadCount !== undefined && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                <Users size={10} />
                {candidate.workloadCount} today
              </span>
            )}
            {candidate.checkedInAt && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                <Clock size={10} />
                {attendanceLabel} {formatClockIn(candidate.checkedInAt)}
              </span>
            )}
            {!candidate.checkedInAt && candidate.attendanceState && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                <Clock size={10} />
                {attendanceLabel}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--cs-text)" }}>{candidate.score}</div>
            <div style={{ fontSize: 9, color: "var(--cs-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              score
            </div>
          </div>
          {onAssign && (
            <button
              type="button"
              onClick={handleAssign}
              disabled={!canAssign}
              style={{
                padding: "5px 10px",
                borderRadius: "var(--cs-r-sm)",
                border: "none",
                backgroundColor: isAssigned ? "var(--cs-success-bg)" : "var(--cs-sand)",
                color: isAssigned ? "var(--cs-success-text)" : "var(--cs-sand-dark)",
                fontSize: 11,
                fontWeight: 700,
                cursor: canAssign ? "pointer" : "not-allowed",
                opacity: canAssign || isAssigned ? 1 : 0.55,
              }}
            >
              {isAssigned ? "Assigned" : candidate.status === "unavailable" ? "Unavailable" : assignLabel}
            </button>
          )}
        </div>
      </div>

      {candidate.reasons.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {candidate.reasons.map((reason, idx) => (
            <span
              key={idx}
              style={{
                fontSize: 10,
                color: "var(--cs-success-text)",
                backgroundColor: "var(--cs-success-bg)",
                padding: "2px 6px",
                borderRadius: "var(--cs-r-sm)",
              }}
            >
              {reason}
            </span>
          ))}
        </div>
      )}

      {candidate.warnings.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {candidate.warnings.map((warning, idx) => (
            <span
              key={idx}
              style={{
                fontSize: 10,
                color: "var(--cs-warning-text)",
                backgroundColor: "var(--cs-warning-bg)",
                padding: "2px 6px",
                borderRadius: "var(--cs-r-sm)",
              }}
            >
              {warning}
            </span>
          ))}
        </div>
      )}

      {(showReason || (requiresOverrideReason && isAssigned)) && onAssign && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
          <label style={{ fontSize: 11, color: "var(--cs-text-muted)" }}>
            Override reason required
          </label>
          <select
            value={selectedReason}
            onChange={(e) => setSelectedReason(e.target.value)}
            style={{
              fontSize: 11,
              padding: "6px 8px",
              borderRadius: "var(--cs-r-sm)",
              border: "1px solid var(--cs-border-soft)",
              backgroundColor: "var(--cs-surface-warm)",
              color: "var(--cs-text)",
            }}
          >
            <option value="">Select reason</option>
            {overrideReasons.map((reason) => (
              <option key={reason.value} value={reason.value}>
                {reason.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAssign}
            disabled={!selectedReason}
            style={{
              alignSelf: "flex-start",
              padding: "5px 10px",
              borderRadius: "var(--cs-r-sm)",
              border: "none",
              backgroundColor: selectedReason ? "var(--cs-sand)" : "var(--cs-border-soft)",
              color: selectedReason ? "var(--cs-sand-dark)" : "var(--cs-text-muted)",
              fontSize: 11,
              fontWeight: 700,
              cursor: selectedReason ? "pointer" : "not-allowed",
            }}
          >
            Confirm Override
          </button>
        </div>
      )}
    </div>
  );
}

function formatClockIn(iso?: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  return `at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}
