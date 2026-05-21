"use client";

import { useTransition } from "react";
import { Check, AlertTriangle, User, ShieldAlert, Star } from "lucide-react";
import type { ScoredStaff } from "@/lib/assignments/recommendation-engine";

// ── Types ──────────────────────────────────────────────────────────────────────

type Props = {
  candidate: ScoredStaff;
  onAssign?: (staffId: string) => void;
  assignLabel?: string;
  isAssigned?: boolean;
};

// ── Status styles ──────────────────────────────────────────────────────────────

function statusStyle(status: ScoredStaff["status"]) {
  switch (status) {
    case "recommended":
      return {
        badgeBg: "var(--cs-success-bg)",
        badgeColor: "var(--cs-success-text)",
        badgeBorder: "rgba(90,138,106,0.25)",
        icon: Star,
        iconColor: "var(--cs-success)",
      };
    case "available":
      return {
        badgeBg: "var(--cs-sand-mist)",
        badgeColor: "var(--cs-sand-dark)",
        badgeBorder: "var(--cs-sand)",
        icon: Check,
        iconColor: "var(--cs-sand)",
      };
    case "warning":
      return {
        badgeBg: "#FFFBEB",
        badgeColor: "#B45309",
        badgeBorder: "#FCD34D",
        icon: AlertTriangle,
        iconColor: "#D97706",
      };
    case "unavailable":
      return {
        badgeBg: "var(--cs-error-bg)",
        badgeColor: "var(--cs-error-text)",
        badgeBorder: "rgba(180,60,60,0.2)",
        icon: ShieldAlert,
        iconColor: "var(--cs-error)",
      };
  }
}

// ── Component ──────────────────────────────────────────────────────────────────

export function AssignmentRecommendationCard({
  candidate,
  onAssign,
  assignLabel = "Assign",
  isAssigned = false,
}: Props) {
  const style = statusStyle(candidate.status);
  const [isPending, startTransition] = useTransition();

  function handleAssign() {
    if (!onAssign || isPending || isAssigned) return;
    startTransition(() => {
      onAssign(candidate.staffId);
    });
  }

  return (
    <div
      style={{
        backgroundColor: "var(--cs-surface)",
        border: "1px solid var(--cs-border-soft)",
        borderRadius: "var(--cs-r-md)",
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              backgroundColor: style.iconColor,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <User size={15} color="#fff" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--cs-text)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={candidate.displayName}
            >
              {candidate.displayName}
            </div>
            <div style={{ fontSize: 11, color: "var(--cs-text-muted)", marginTop: 1 }}>
              {candidate.roleLabel}
              {candidate.tier && ` · ${candidate.tier}`}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              padding: "2px 8px",
              borderRadius: "var(--cs-r-pill)",
              backgroundColor: style.badgeBg,
              color: style.badgeColor,
              border: `1px solid ${style.badgeBorder}`,
            }}
          >
            {candidate.status}
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              fontFamily: "var(--font-mono, monospace)",
              color: "var(--cs-text-muted)",
            }}
          >
            {candidate.score}
          </span>
        </div>
      </div>

      {/* Reasons */}
      {candidate.reasons.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {candidate.reasons.map((reason) => (
            <div key={reason} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <Check size={11} color="var(--cs-success)" />
              <span style={{ fontSize: 11, color: "var(--cs-text-secondary)" }}>{reason}</span>
            </div>
          ))}
        </div>
      )}

      {/* Warnings */}
      {candidate.warnings.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {candidate.warnings.map((warning) => (
            <div key={warning} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <AlertTriangle size={11} color={candidate.status === "unavailable" ? "var(--cs-error)" : "#D97706"} />
              <span style={{ fontSize: 11, color: candidate.status === "unavailable" ? "var(--cs-error-text)" : "#B45309" }}>
                {warning}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Assign button */}
      {onAssign && (
        <button
          type="button"
          onClick={handleAssign}
          disabled={isPending || isAssigned || candidate.status === "unavailable"}
          style={{
            marginTop: 2,
            padding: "5px 10px",
            borderRadius: "var(--cs-r-sm)",
            border: "none",
            backgroundColor: isAssigned ? "var(--cs-success-bg)" : "var(--cs-sand)",
            color: isAssigned ? "var(--cs-success-text)" : "#fff",
            fontSize: 12,
            fontWeight: 600,
            cursor: isAssigned || candidate.status === "unavailable" ? "default" : "pointer",
            opacity: candidate.status === "unavailable" ? 0.5 : 1,
          }}
        >
          {isAssigned ? "Assigned" : isPending ? "Assigning…" : assignLabel}
        </button>
      )}
    </div>
  );
}
