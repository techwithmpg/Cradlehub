"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { ReadinessIssue, ReadinessSeverity, ReadinessScope, ReadinessStatus } from "@/types/readiness";
import { READINESS_SCOPE_META } from "@/types/readiness";
import Link from "next/link";

// ── Severity styles ───────────────────────────────────────────────────────────

type SeverityStyle = {
  icon: string;
  label: string;
  color: string;
  bg: string;
  border: string;
};

const SEVERITY_STYLE: Record<ReadinessSeverity, SeverityStyle> = {
  critical: {
    icon: "⛔",
    label: "Action Required",
    color: "var(--cs-error, #c0392b)",
    bg: "rgba(192,57,43,0.06)",
    border: "rgba(192,57,43,0.22)",
  },
  warning: {
    icon: "⚠️",
    label: "Needs Attention",
    color: "var(--cs-warning, #e67e22)",
    bg: "rgba(230,126,34,0.06)",
    border: "rgba(230,126,34,0.22)",
  },
  info: {
    icon: "ℹ️",
    label: "Notice",
    color: "var(--cs-info, #2980b9)",
    bg: "rgba(41,128,185,0.045)",
    border: "rgba(41,128,185,0.18)",
  },
  success: {
    icon: "✅",
    label: "All Good",
    color: "var(--cs-success, #27ae60)",
    bg: "rgba(39,174,96,0.055)",
    border: "rgba(39,174,96,0.22)",
  },
};

const STATUS_BAR_STYLE: Record<ReadinessStatus, { barBg: string; barBorder: string; icon: string; label: string; color: string }> = {
  critical: {
    barBg: "rgba(192,57,43,0.06)",
    barBorder: "rgba(192,57,43,0.22)",
    icon: "⛔",
    label: "Critical",
    color: "var(--cs-error, #c0392b)",
  },
  warning: {
    barBg: "rgba(230,126,34,0.06)",
    barBorder: "rgba(230,126,34,0.22)",
    icon: "⚠️",
    label: "Warning",
    color: "var(--cs-warning, #e67e22)",
  },
  ok: {
    barBg: "rgba(39,174,96,0.04)",
    barBorder: "rgba(39,174,96,0.18)",
    icon: "✅",
    label: "All Clear",
    color: "var(--cs-success, #27ae60)",
  },
};

// ── Category count helper ─────────────────────────────────────────────────────

type ScopeCounts = Partial<Record<ReadinessScope, number>>;

function buildScopeCounts(issues: ReadinessIssue[]): ScopeCounts {
  const counts: ScopeCounts = {};
  for (const issue of issues) {
    counts[issue.scope] = (counts[issue.scope] ?? 0) + 1;
  }
  return counts;
}

function buildCountParts(issues: ReadinessIssue[]): string[] {
  const critical = issues.filter((i) => i.severity === "critical").length;
  const warning  = issues.filter((i) => i.severity === "warning").length;
  const parts: string[] = [];
  if (critical > 0) parts.push(`Critical: ${critical}`);
  if (warning  > 0) parts.push(`Warning: ${warning}`);
  return parts;
}

// ── Panel — full readiness issue list grouped by scope ────────────────────────

const SCOPE_ORDER: ReadinessScope[] = [
  "daily", "schedule", "dispatch", "payment", "service", "space", "setup", "system",
];

function IssueItem({ issue }: { issue: ReadinessIssue }) {
  const sev = SEVERITY_STYLE[issue.severity] ?? SEVERITY_STYLE.info;
  return (
    <div
      style={{
        padding: "0.75rem 0.875rem",
        borderRadius: "var(--cs-r-sm, 8px)",
        background: sev.bg,
        border: `1px solid ${sev.border}`,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      {/* Badges row */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span
          style={{
            fontSize: "0.625rem",
            fontWeight: 700,
            color: sev.color,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {sev.icon} {sev.label}
        </span>
        {issue.count !== undefined && issue.count > 1 && (
          <span
            style={{
              fontSize: "0.625rem",
              fontWeight: 700,
              color: sev.color,
              background: `${sev.color}15`,
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
          fontSize: "0.8125rem",
          fontWeight: 600,
          color: "var(--cs-text)",
          lineHeight: 1.4,
        }}
      >
        {issue.title}
      </div>

      {/* Problem */}
      {issue.problem && (
        <div style={{ fontSize: "0.75rem", color: "var(--cs-text-secondary)", lineHeight: 1.5 }}>
          {issue.problem}
        </div>
      )}

      {/* Impact + Fix */}
      {issue.impact && (
        <div style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)", lineHeight: 1.4 }}>
          <strong style={{ color: "var(--cs-text-secondary)", fontStyle: "normal" }}>Impact:</strong>{" "}
          {issue.impact}
        </div>
      )}
      {issue.fix && (
        <div style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)", lineHeight: 1.4, fontStyle: "italic" }}>
          <strong style={{ color: "var(--cs-text-secondary)", fontStyle: "normal" }}>Fix:</strong>{" "}
          {issue.fix}
        </div>
      )}

      {/* Action link */}
      {issue.actionHref && (
        <div style={{ marginTop: 4 }}>
          <Link
            href={issue.actionHref}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: "0.75rem",
              fontWeight: 600,
              color: sev.color,
              textDecoration: "none",
              padding: "2px 8px",
              border: `1px solid ${sev.border}`,
              borderRadius: "var(--cs-r-sm, 8px)",
              background: "var(--cs-surface)",
            }}
          >
            {issue.actionLabel ?? "Review"} ›
          </Link>
        </div>
      )}
    </div>
  );
}

function ReadinessPanel({ issues }: { issues: ReadinessIssue[] }) {
  if (issues.length === 0) {
    return (
      <div
        style={{
          padding: "1.5rem 1rem",
          textAlign: "center",
          color: "var(--cs-text-muted)",
          fontSize: "0.875rem",
        }}
      >
        <div style={{ fontSize: 24, marginBottom: 8 }}>✅</div>
        <div style={{ fontWeight: 600, color: "var(--cs-success)", marginBottom: 4 }}>
          All systems look good
        </div>
        <div>No readiness issues were found at this time.</div>
      </div>
    );
  }

  const scopeCounts = buildScopeCounts(issues);
  const scopesWithIssues = SCOPE_ORDER.filter((s) => (scopeCounts[s] ?? 0) > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {scopesWithIssues.map((scope) => {
        const scopeIssues = issues
          .filter((i) => i.scope === scope)
          .sort((a, b) => {
            const order: ReadinessSeverity[] = ["critical", "warning", "info", "success"];
            return order.indexOf(a.severity) - order.indexOf(b.severity);
          });
        const meta = READINESS_SCOPE_META[scope] ?? { label: scope, icon: "📋" };

        return (
          <div key={scope}>
            {/* Section header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: "0.5rem",
                paddingBottom: "0.375rem",
                borderBottom: "1px solid var(--cs-border-soft)",
              }}
            >
              <span style={{ fontSize: "0.75rem" }}>{meta.icon}</span>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "var(--cs-text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {meta.label}
              </span>
              <span
                style={{
                  fontSize: "0.625rem",
                  fontWeight: 700,
                  color: "var(--cs-text-muted)",
                  background: "var(--cs-surface-raised)",
                  border: "1px solid var(--cs-border-soft)",
                  padding: "0px 5px",
                  borderRadius: 4,
                }}
              >
                {scopeIssues.length}
              </span>
            </div>

            {/* Issues */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {scopeIssues.map((issue) => (
                <IssueItem key={issue.id} issue={issue} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── SystemReadinessBar ────────────────────────────────────────────────────────

export type SystemReadinessBarProps = {
  /** All readiness issues from getCrmReadiness(). Pass [] for all-clear. */
  issues: ReadinessIssue[];
  /** Overall status derived from issues. */
  status: ReadinessStatus;
  /** Label for the panel title. Defaults to "System Readiness". */
  label?: string;
};

/**
 * SystemReadinessBar
 *
 * Compact single-line horizontal bar that shows a summary of readiness issues.
 * Clicking "Review issues" opens a Sheet panel with full details grouped by category.
 *
 * Example:
 *   ⚠ System Readiness · 6 issues · Critical: 2 · Warning: 4       Review issues →
 *
 * Client component — needs state for the open/close panel.
 * Props are plain serializable values — safe to pass from server components.
 */
export function SystemReadinessBar({
  issues,
  status,
  label = "System Readiness",
}: SystemReadinessBarProps) {
  const [open, setOpen] = useState(false);

  const barStyle = STATUS_BAR_STYLE[status] ?? STATUS_BAR_STYLE.ok;
  const totalCount = issues.length;
  const countParts = buildCountParts(issues);

  return (
    <>
      {/* ── Compact bar ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "6px 12px",
          background: barStyle.barBg,
          border: `1px solid ${barStyle.barBorder}`,
          borderRadius: "var(--cs-r-sm, 8px)",
          flexWrap: "wrap",
          minHeight: 36,
        }}
      >
        {/* Status icon + label */}
        <span style={{ fontSize: 14, flexShrink: 0 }} aria-hidden="true">
          {barStyle.icon}
        </span>
        <span
          style={{
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: barStyle.color,
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>

        {/* Separator */}
        <span
          style={{ fontSize: "0.8125rem", color: "var(--cs-border)", userSelect: "none" }}
          aria-hidden="true"
        >
          ·
        </span>

        {/* Total count */}
        <span style={{ fontSize: "0.8125rem", color: "var(--cs-text-secondary)", whiteSpace: "nowrap" }}>
          {totalCount === 0 ? "All clear" : `${totalCount} issue${totalCount !== 1 ? "s" : ""}`}
        </span>

        {/* Category counts */}
        {countParts.map((part) => (
          <span key={part} style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
            <span style={{ fontSize: "0.8125rem", color: "var(--cs-border)", userSelect: "none" }} aria-hidden="true">·</span>
            <span style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)", whiteSpace: "nowrap" }}>
              {part}
            </span>
          </span>
        ))}

        {/* Spacer */}
        <div style={{ flex: 1, minWidth: 8 }} />

        {/* Review issues button */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Review ${totalCount} readiness issue${totalCount !== 1 ? "s" : ""}`}
          style={{
            padding: "3px 10px",
            borderRadius: 6,
            background: "var(--cs-surface)",
            border: "1px solid var(--cs-border-soft)",
            color: "var(--cs-text-secondary)",
            fontSize: "0.75rem",
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          Review issues →
        </button>
      </div>

      {/* ── Panel ── */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          style={{ width: "min(480px, 92vw)", overflowY: "auto" }}
          aria-label="System readiness issues"
        >
          <SheetHeader style={{ marginBottom: "1rem" }}>
            <SheetTitle
              style={{
                fontSize: "1rem",
                fontWeight: 700,
                color: "var(--cs-text)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span aria-hidden="true">{barStyle.icon}</span>
              {label}
              {totalCount > 0 && (
                <span
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    color: barStyle.color,
                    background: `${barStyle.color}15`,
                    border: `1px solid ${barStyle.color}40`,
                    padding: "1px 7px",
                    borderRadius: 10,
                  }}
                >
                  {totalCount} issue{totalCount !== 1 ? "s" : ""}
                </span>
              )}
            </SheetTitle>
            <p
              style={{
                fontSize: "0.8125rem",
                color: "var(--cs-text-muted)",
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              Issues are grouped by domain. Resolve critical items first.
            </p>
          </SheetHeader>
          <ReadinessPanel issues={issues} />
        </SheetContent>
      </Sheet>
    </>
  );
}
