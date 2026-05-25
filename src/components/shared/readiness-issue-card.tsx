import Link from "next/link";
import type { ReadinessIssue, ReadinessSeverity } from "@/types/readiness";
import { READINESS_SCOPE_META } from "@/types/readiness";

// ── Severity config ───────────────────────────────────────────────────────────

type SeverityStyle = {
  icon: string;
  badgeLabel: string;
  color: string;
  bg: string;
  border: string;
  actionColor: string;
};

const SEVERITY_STYLE: Record<ReadinessSeverity, SeverityStyle> = {
  critical: {
    icon: "⛔",
    badgeLabel: "Action Required",
    color: "var(--cs-error, #c0392b)",
    bg: "rgba(192, 57, 43, 0.055)",
    border: "rgba(192, 57, 43, 0.22)",
    actionColor: "var(--cs-error, #c0392b)",
  },
  warning: {
    icon: "⚠️",
    badgeLabel: "Needs Attention",
    color: "var(--cs-warning, #e67e22)",
    bg: "rgba(230, 126, 34, 0.055)",
    border: "rgba(230, 126, 34, 0.22)",
    actionColor: "var(--cs-warning, #e67e22)",
  },
  info: {
    icon: "ℹ️",
    badgeLabel: "Notice",
    color: "var(--cs-info, #2980b9)",
    bg: "rgba(41, 128, 185, 0.045)",
    border: "rgba(41, 128, 185, 0.18)",
    actionColor: "var(--cs-info, #2980b9)",
  },
  success: {
    icon: "✅",
    badgeLabel: "All Good",
    color: "var(--cs-success, #27ae60)",
    bg: "rgba(39, 174, 96, 0.055)",
    border: "rgba(39, 174, 96, 0.22)",
    actionColor: "var(--cs-success, #27ae60)",
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

type ReadinessIssueCardProps = {
  issue: ReadinessIssue;
  /** Compact mode: smaller padding, hides fix/problem detail, shows only title + action. */
  compact?: boolean;
};

/**
 * ReadinessIssueCard
 *
 * Displays a single readiness issue with severity badge, scope badge,
 * title, problem, impact, fix advice, and an action link.
 *
 * Server component — uses Link, no client state needed.
 *
 * @example
 * <ReadinessIssueCard issue={issue} />
 * <ReadinessIssueCard issue={issue} compact />
 */
export function ReadinessIssueCard({ issue, compact = false }: ReadinessIssueCardProps) {
  const style = SEVERITY_STYLE[issue.severity] ?? SEVERITY_STYLE.info;
  const scopeMeta = READINESS_SCOPE_META[issue.scope] ?? { label: issue.scope, icon: "📋" };

  return (
    <div
      style={{
        backgroundColor: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: "var(--cs-r-sm, 8px)",
        padding: compact ? "0.625rem 0.875rem" : "0.875rem 1rem",
        display: "flex",
        gap: "0.875rem",
        alignItems: "flex-start",
      }}
    >
      {/* Severity icon */}
      {!compact && (
        <span style={{ fontSize: 18, flexShrink: 0, marginTop: 2 }} aria-hidden="true">
          {style.icon}
        </span>
      )}

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>

        {/* Badges row */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {/* Severity badge */}
          <span
            style={{
              fontSize: "0.625rem",
              fontWeight: 700,
              color: style.color,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            {style.badgeLabel}
          </span>

          {/* Scope badge */}
          <span
            style={{
              fontSize: "0.625rem",
              fontWeight: 600,
              color: "var(--cs-text-muted)",
              background: "var(--cs-surface-raised)",
              border: "1px solid var(--cs-border-soft)",
              padding: "1px 5px",
              borderRadius: 4,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {scopeMeta.icon} {scopeMeta.label}
          </span>

          {/* Count badge (if present) */}
          {issue.count !== undefined && issue.count > 1 && (
            <span
              style={{
                fontSize: "0.625rem",
                fontWeight: 700,
                color: style.color,
                background: `${style.color}15`,
                padding: "1px 5px",
                borderRadius: 4,
              }}
            >
              {issue.count}
            </span>
          )}
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: compact ? "0.8125rem" : "0.875rem",
            fontWeight: 600,
            color: "var(--cs-text)",
            lineHeight: 1.4,
          }}
        >
          {issue.title}
        </div>

        {/* Full detail — hidden in compact mode */}
        {!compact && (
          <>
            {/* Problem */}
            <div
              style={{
                fontSize: "0.8125rem",
                color: "var(--cs-text-secondary)",
                lineHeight: 1.5,
              }}
            >
              {issue.problem}
            </div>

            {/* Impact */}
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--cs-text-muted)",
                lineHeight: 1.4,
              }}
            >
              <strong style={{ color: "var(--cs-text-secondary)", fontWeight: 600 }}>
                Impact:
              </strong>{" "}
              {issue.impact}
            </div>

            {/* Fix advice */}
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--cs-text-muted)",
                lineHeight: 1.4,
                fontStyle: "italic",
              }}
            >
              <strong style={{ color: "var(--cs-text-secondary)", fontWeight: 600, fontStyle: "normal" }}>
                Fix:
              </strong>{" "}
              {issue.fix}
            </div>
          </>
        )}

        {/* Action link */}
        {issue.actionHref && (
          <div style={{ marginTop: compact ? 2 : 6 }}>
            <Link
              href={issue.actionHref}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: style.actionColor,
                textDecoration: "none",
                padding: compact ? "2px 8px" : "4px 10px",
                border: `1px solid ${style.border}`,
                borderRadius: "var(--cs-r-sm, 8px)",
                backgroundColor: "var(--cs-surface)",
              }}
            >
              {issue.actionLabel} ›
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
