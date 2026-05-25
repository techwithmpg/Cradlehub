import Link from "next/link";
import type { SetupIssue } from "@/lib/queries/crm-setup";

const SEVERITY_META: Record<SetupIssue["severity"], { icon: string; color: string; bg: string; border: string; label: string }> = {
  error:   { icon: "⛔", color: "var(--cs-error, #c0392b)",   bg: "rgba(192,57,43,0.06)",  border: "rgba(192,57,43,0.25)",  label: "Action Required" },
  warning: { icon: "⚠️", color: "var(--cs-warning, #e67e22)", bg: "rgba(230,126,34,0.06)", border: "rgba(230,126,34,0.25)", label: "Needs Attention"  },
  info:    { icon: "ℹ️",  color: "var(--cs-text-muted)",       bg: "var(--cs-surface-raised)", border: "var(--cs-border-soft)", label: "Notice"     },
};

function IssueCard({ issue }: { issue: SetupIssue }) {
  const meta = SEVERITY_META[issue.severity];
  return (
    <div
      style={{
        backgroundColor: meta.bg,
        border: `1px solid ${meta.border}`,
        borderRadius: "var(--cs-r-sm, 8px)",
        padding: "0.875rem 1rem",
        display: "flex",
        gap: "0.875rem",
        alignItems: "flex-start",
      }}
    >
      <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{meta.icon}</span>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: "0.6875rem",
              fontWeight: 700,
              color: meta.color,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {meta.label}
          </span>
        </div>
        <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--cs-text)" }}>
          {issue.title}
        </div>
        <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-secondary)", lineHeight: 1.5 }}>
          {issue.detail}
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", lineHeight: 1.4 }}>
          <strong style={{ color: "var(--cs-text-secondary)" }}>Impact:</strong> {issue.impact}
        </div>
        <div style={{ marginTop: 6 }}>
          <Link
            href={issue.fixHref}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: meta.color,
              textDecoration: "none",
              padding: "4px 10px",
              border: `1px solid ${meta.border}`,
              borderRadius: "var(--cs-r-sm, 8px)",
              backgroundColor: "var(--cs-surface)",
            }}
          >
            {issue.fixLabel} ›
          </Link>
        </div>
      </div>
    </div>
  );
}

export function CrmSetupIssuesList({ issues }: { issues: SetupIssue[] }) {
  if (issues.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "1rem 1.125rem",
          backgroundColor: "var(--cs-success-bg)",
          border: "1px solid rgba(39,174,96,0.3)",
          borderRadius: "var(--cs-r-sm, 8px)",
          fontSize: "0.875rem",
          color: "var(--cs-success)",
          fontWeight: 500,
        }}
      >
        <span style={{ fontSize: 20 }}>✅</span>
        No setup issues detected. Everything looks ready for today&apos;s operations.
      </div>
    );
  }

  const errors   = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const infos    = issues.filter((i) => i.severity === "info");
  const ordered  = [...errors, ...warnings, ...infos];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {ordered.map((issue) => (
        <IssueCard key={issue.id} issue={issue} />
      ))}
    </div>
  );
}
