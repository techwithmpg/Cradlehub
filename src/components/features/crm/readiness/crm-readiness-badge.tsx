import Link from "next/link";
import type { ReadinessResult, ReadinessStatus } from "@/types/readiness";

// ── Status styles ─────────────────────────────────────────────────────────────

type BadgeStyle = {
  icon: string;
  color: string;
  bg: string;
  border: string;
};

const STATUS_STYLE: Record<ReadinessStatus, BadgeStyle> = {
  critical: {
    icon: "⛔",
    color: "var(--cs-error, #c0392b)",
    bg: "rgba(192, 57, 43, 0.065)",
    border: "rgba(192, 57, 43, 0.25)",
  },
  warning: {
    icon: "⚠️",
    color: "var(--cs-warning, #e67e22)",
    bg: "rgba(230, 126, 34, 0.065)",
    border: "rgba(230, 126, 34, 0.25)",
  },
  ok: {
    icon: "✅",
    color: "var(--cs-success, #27ae60)",
    bg: "rgba(39, 174, 96, 0.055)",
    border: "rgba(39, 174, 96, 0.22)",
  },
};

/** Fallback when readiness could not be loaded. */
const FALLBACK_STYLE: BadgeStyle = {
  icon: "⚠️",
  color: "var(--cs-text-muted)",
  bg: "var(--cs-surface-raised)",
  border: "var(--cs-border-soft)",
};

// ── Count summary ─────────────────────────────────────────────────────────────

function buildCountSummary(criticalCount: number, warningCount: number): string {
  const parts: string[] = [];
  if (criticalCount > 0) parts.push(`${criticalCount} critical`);
  if (warningCount > 0) parts.push(`${warningCount} warning${warningCount !== 1 ? "s" : ""}`);
  return parts.length > 0 ? parts.join(" · ") : "All clear";
}

// ── Component ─────────────────────────────────────────────────────────────────

type CrmReadinessBadgeProps = {
  /** null when getCrmReadiness failed — renders a safe fallback. */
  readiness: ReadinessResult | null;
};

/**
 * CrmReadinessBadge
 *
 * A compact, single-line system health indicator rendered globally across
 * all CRM routes (via /crm/layout.tsx).
 *
 * Displays:
 *   - Severity icon + "System Readiness" label
 *   - Critical / warning count summary  (or "All clear")
 *   - "Review →" affordance that links to /crm/setup
 *
 * Renders a muted fallback when readiness is null (source failure).
 * Server component — uses Link, no client state.
 *
 * Visual states:
 *   critical  → red-tinted pill
 *   warning   → amber-tinted pill
 *   ok        → green-tinted pill
 *   null      → neutral muted pill
 */
export function CrmReadinessBadge({ readiness }: CrmReadinessBadgeProps) {
  const style = readiness
    ? (STATUS_STYLE[readiness.status] ?? STATUS_STYLE.ok)
    : FALLBACK_STYLE;

  const criticalCount =
    readiness?.issues.filter((i) => i.severity === "critical").length ?? 0;
  const warningCount =
    readiness?.issues.filter((i) => i.severity === "warning").length ?? 0;

  const summary = readiness
    ? buildCountSummary(criticalCount, warningCount)
    : "Review needed";

  return (
    <Link
      href="/crm/setup"
      aria-label={`System Readiness — ${summary}. Open Rules & Setup Center.`}
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        rowGap: 2,
        columnGap: 8,
        padding: "6px 12px",
        backgroundColor: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: "var(--cs-r-sm, 8px)",
        textDecoration: "none",
        marginBottom: "1rem",
      }}
    >
      {/* Severity icon */}
      <span style={{ fontSize: 12, flexShrink: 0, lineHeight: 1 }} aria-hidden="true">
        {style.icon}
      </span>

      {/* Label */}
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: style.color,
          whiteSpace: "nowrap",
        }}
      >
        System Readiness
      </span>

      {/* Separator dot */}
      <span style={{ fontSize: 11, color: "var(--cs-text-muted)" }} aria-hidden="true">
        ·
      </span>

      {/* Count summary */}
      <span
        style={{
          fontSize: 12,
          color: readiness?.status === "ok" ? style.color : "var(--cs-text-muted)",
          whiteSpace: "nowrap",
          flex: 1,
          minWidth: 0,
        }}
      >
        {summary}
      </span>

      {/* Review link affordance */}
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: style.color,
          whiteSpace: "nowrap",
          flexShrink: 0,
          marginLeft: "auto",
        }}
      >
        Review →
      </span>
    </Link>
  );
}
