import Link from "next/link";
import { ReadinessIssueList } from "@/components/shared/readiness-issue-list";
import type { ReadinessResult, ReadinessStatus } from "@/types/readiness";

// ── Status style helpers ──────────────────────────────────────────────────────

type StatusStyle = {
  color: string;
  bg: string;
  border: string;
  label: string;
  icon: string;
};

const STATUS_STYLE: Record<ReadinessStatus, StatusStyle> = {
  critical: {
    color: "var(--cs-error, #c0392b)",
    bg: "rgba(192, 57, 43, 0.055)",
    border: "rgba(192, 57, 43, 0.22)",
    label: "Critical",
    icon: "⛔",
  },
  warning: {
    color: "var(--cs-warning, #e67e22)",
    bg: "rgba(230, 126, 34, 0.055)",
    border: "rgba(230, 126, 34, 0.22)",
    label: "Warning",
    icon: "⚠️",
  },
  ok: {
    color: "var(--cs-success, #27ae60)",
    bg: "rgba(39, 174, 96, 0.055)",
    border: "rgba(39, 174, 96, 0.22)",
    label: "All Clear",
    icon: "✅",
  },
};

// ── Failure state ─────────────────────────────────────────────────────────────

function ReadinessUnavailable() {
  return (
    <div
      style={{
        padding: "0.875rem 1rem",
        backgroundColor: "var(--cs-surface-raised)",
        border: "1px solid var(--cs-border-soft)",
        borderRadius: "var(--cs-r-sm, 8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
        flexWrap: "wrap",
      }}
    >
      <div>
        <div
          style={{
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "var(--cs-text)",
            marginBottom: 2,
          }}
        >
          System readiness unavailable
        </div>
        <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)" }}>
          Open Rules &amp; Setup Center to review setup conditions manually.
        </div>
      </div>
      <Link
        href="/crm/setup"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: "0.8125rem",
          fontWeight: 600,
          color: "var(--cs-text-secondary)",
          textDecoration: "none",
          padding: "4px 12px",
          border: "1px solid var(--cs-border-soft)",
          borderRadius: "var(--cs-r-sm, 8px)",
          backgroundColor: "var(--cs-surface)",
          flexShrink: 0,
        }}
      >
        Open Rules &amp; Setup ›
      </Link>
    </div>
  );
}

// ── Count summary text ────────────────────────────────────────────────────────

function buildCountSummary(criticalCount: number, warningCount: number): string {
  const parts: string[] = [];
  if (criticalCount > 0)
    parts.push(`${criticalCount} critical`);
  if (warningCount > 0)
    parts.push(`${warningCount} warning${warningCount !== 1 ? "s" : ""}`);
  return parts.length > 0 ? parts.join(" · ") : "All clear";
}

// ── Component ─────────────────────────────────────────────────────────────────

type TodayReadinessStripProps = {
  /** null when getCrmReadiness failed — renders a safe fallback. */
  readiness: ReadinessResult | null;
};

/**
 * TodayReadinessStrip
 *
 * A compact strip for /crm/today that surfaces the top readiness issues
 * from getCrmReadiness().  Shows:
 *   - Overall status badge (Critical / Warning / All Clear)
 *   - Critical + warning issue counts
 *   - Up to 3 issues in compact mode via ReadinessIssueList
 *   - "View all setup issues" link to /crm/setup
 *
 * Renders a safe fallback when readiness is null (source failure).
 * Server component — no client state needed.
 */
export function TodayReadinessStrip({ readiness }: TodayReadinessStripProps) {
  // ── Failure fallback ──────────────────────────────────────────────────────
  if (readiness === null) {
    return (
      <div style={{ marginBottom: "1.25rem" }}>
        <div
          style={{
            fontSize: "0.9375rem",
            fontWeight: 600,
            color: "var(--cs-text)",
            fontFamily: "var(--font-display)",
            marginBottom: "0.5rem",
          }}
        >
          System Readiness
        </div>
        <ReadinessUnavailable />
      </div>
    );
  }

  const style = STATUS_STYLE[readiness.status] ?? STATUS_STYLE.ok;
  const criticalCount = readiness.issues.filter((i) => i.severity === "critical").length;
  const warningCount  = readiness.issues.filter((i) => i.severity === "warning").length;
  const totalCount    = readiness.issues.length;
  const countSummary  = buildCountSummary(criticalCount, warningCount);

  return (
    <div style={{ marginBottom: "1.25rem" }}>
      {/* ── Header row ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: "0.5rem",
          flexWrap: "wrap",
        }}
      >
        {/* Section label */}
        <div
          style={{
            fontSize: "0.9375rem",
            fontWeight: 600,
            color: "var(--cs-text)",
            fontFamily: "var(--font-display)",
          }}
        >
          System Readiness
        </div>

        {/* Status badge */}
        <span
          style={{
            fontSize: "0.6875rem",
            fontWeight: 700,
            color: style.color,
            background: style.bg,
            border: `1px solid ${style.border}`,
            padding: "2px 8px",
            borderRadius: 10,
            whiteSpace: "nowrap",
          }}
        >
          {style.icon} {style.label}
        </span>

        {/* Count summary — only when there are issues */}
        {totalCount > 0 && (
          <span
            style={{
              fontSize: "0.8125rem",
              color: "var(--cs-text-muted)",
            }}
          >
            {countSummary}
          </span>
        )}

        {/* Spacer + "View all" link */}
        <Link
          href="/crm/setup"
          style={{
            marginLeft: "auto",
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--cs-text-muted)",
            textDecoration: "none",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          View all issues ›
        </Link>
      </div>

      {/* ── Issue list (max 3, compact) ── */}
      <ReadinessIssueList
        issues={readiness.issues}
        compact
        maxItems={3}
        emptyTitle="System readiness looks good"
        emptyDescription="No urgent readiness issues were found for today."
      />
    </div>
  );
}
