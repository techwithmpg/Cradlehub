"use client";

import Link from "next/link";
import type { ReadinessIssue, ReadinessSeverity, ReadinessScope } from "@/types/readiness";
import { READINESS_SCOPE_META } from "@/types/readiness";

const SEVERITY_STYLE: Record<ReadinessSeverity, { icon: string; label: string; color: string; bg: string; border: string }> = {
  critical: { icon: "⛔", label: "Critical", color: "var(--cs-error)", bg: "var(--cs-error-bg)", border: "var(--cs-error)" },
  warning: { icon: "⚠️", label: "Warning", color: "var(--cs-warning)", bg: "var(--cs-warning-bg)", border: "var(--cs-warning)" },
  info: { icon: "ℹ️", label: "Notice", color: "var(--cs-info)", bg: "var(--cs-info-bg)", border: "var(--cs-info)" },
  success: { icon: "✅", label: "OK", color: "var(--cs-success)", bg: "var(--cs-success-bg)", border: "var(--cs-success)" },
};

const SCOPE_ORDER: ReadinessScope[] = [
  "daily", "schedule", "dispatch", "payment", "service", "space", "setup", "system",
];

function IssueItem({ issue }: { issue: ReadinessIssue }) {
  const sev = SEVERITY_STYLE[issue.severity] ?? SEVERITY_STYLE.info;
  return (
    <div
      style={{
        padding: "0.75rem 0.875rem",
        borderRadius: "var(--cs-r-sm)",
        background: sev.bg,
        border: `1px solid ${sev.border}`,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.625rem", fontWeight: 700, color: sev.color, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {sev.icon} {sev.label}
        </span>
        {issue.count !== undefined && issue.count > 1 && (
          <span style={{ fontSize: "0.625rem", fontWeight: 700, color: sev.color, background: `${sev.color}15`, padding: "1px 5px", borderRadius: 4 }}>
            {issue.count}
          </span>
        )}
      </div>
      <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--cs-text)", lineHeight: 1.4 }}>
        {issue.title}
      </div>
      {issue.problem && (
        <div style={{ fontSize: "0.75rem", color: "var(--cs-text-secondary)", lineHeight: 1.5 }}>
          {issue.problem}
        </div>
      )}
      {issue.impact && (
        <div style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)", lineHeight: 1.4 }}>
          <strong style={{ color: "var(--cs-text-secondary)", fontStyle: "normal" }}>Impact:</strong> {issue.impact}
        </div>
      )}
      {issue.fix && (
        <div style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)", lineHeight: 1.4, fontStyle: "italic" }}>
          <strong style={{ color: "var(--cs-text-secondary)", fontStyle: "normal" }}>Fix:</strong> {issue.fix}
        </div>
      )}
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
              borderRadius: "var(--cs-r-sm)",
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

export function CrmReadinessDetail({ issues }: { issues: ReadinessIssue[] }) {
  if (issues.length === 0) {
    return (
      <div style={{ padding: "1.5rem 1rem", textAlign: "center", color: "var(--cs-text-muted)", fontSize: "0.875rem" }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>✅</div>
        <div style={{ fontWeight: 600, color: "var(--cs-success)", marginBottom: 4 }}>All systems look good</div>
        <div>No readiness issues were found at this time.</div>
      </div>
    );
  }

  const scopeCounts: Partial<Record<ReadinessScope, number>> = {};
  for (const issue of issues) {
    scopeCounts[issue.scope] = (scopeCounts[issue.scope] ?? 0) + 1;
  }
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
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--cs-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
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
