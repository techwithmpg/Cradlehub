import Link from "next/link";
import type { SetupIssue } from "@/lib/queries/crm-setup";

// ── Grouping rules ─────────────────────────────────────────────────────────────

type IssueGroupKey = "booking_blockers" | "daily_ops" | "optional";

type IssueGroupMeta = {
  key: IssueGroupKey;
  label: string;
  icon: string;
  color: string;
  border: string;
  bg: string;
};

const GROUP_META: Record<IssueGroupKey, IssueGroupMeta> = {
  booking_blockers: {
    key: "booking_blockers",
    label: "Critical Booking Blockers",
    icon: "⛔",
    color: "var(--cs-error, #c0392b)",
    border: "rgba(192,57,43,0.22)",
    bg: "rgba(192,57,43,0.04)",
  },
  daily_ops: {
    key: "daily_ops",
    label: "Daily Operations Attention",
    icon: "⚠️",
    color: "var(--cs-warning, #e67e22)",
    border: "rgba(230,126,34,0.22)",
    bg: "rgba(230,126,34,0.04)",
  },
  optional: {
    key: "optional",
    label: "Optional Review",
    icon: "ℹ️",
    color: "var(--cs-text-muted)",
    border: "var(--cs-border-soft)",
    bg: "var(--cs-surface-raised)",
  },
};

function classifyIssue(issue: SetupIssue): IssueGroupKey {
  switch (issue.id) {
    case "no-staff-for-service":
      return "booking_blockers";
    case "no-drivers":
      return "daily_ops";
    case "unassigned-bookings":
      return "daily_ops";
    case "no-schedule":
      return "booking_blockers";
    case "no-resources":
      return "booking_blockers";
    case "default-rules":
      return "optional";
    default:
      return issue.severity === "error" ? "booking_blockers" : issue.severity === "warning" ? "daily_ops" : "optional";
  }
}

// ── Compact issue row ──────────────────────────────────────────────────────────

const SEVERITY_DOT: Record<SetupIssue["severity"], string> = {
  error:   "var(--cs-error, #c0392b)",
  warning: "var(--cs-warning, #e67e22)",
  info:    "var(--cs-text-muted)",
};

function IssueRow({ issue }: { issue: SetupIssue }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "0.625rem",
        padding: "8px 10px",
        background: "var(--cs-surface)",
        border: "1px solid var(--cs-border-soft)",
        borderRadius: "var(--cs-r-sm, 8px)",
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: SEVERITY_DOT[issue.severity],
          flexShrink: 0,
          marginTop: 5,
        }}
      />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--cs-text)", lineHeight: 1.4 }}>
          {issue.title}
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--cs-text-secondary)", lineHeight: 1.4 }}>
          {issue.impact}
        </div>
      </div>
      <Link
        href={issue.fixHref}
        style={{
          flexShrink: 0,
          fontSize: "0.75rem",
          fontWeight: 600,
          color: "var(--cs-sand)",
          textDecoration: "none",
          padding: "3px 10px",
          border: "1px solid var(--cs-border-soft)",
          borderRadius: "var(--cs-r-sm, 6px)",
          background: "var(--cs-surface-warm)",
          whiteSpace: "nowrap",
          alignSelf: "center",
        }}
      >
        {issue.fixLabel} ›
      </Link>
    </div>
  );
}

// ── Issue group section ────────────────────────────────────────────────────────

function IssueGroupSection({ meta, issues }: { meta: IssueGroupMeta; issues: SetupIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 10px",
          background: meta.bg,
          border: `1px solid ${meta.border}`,
          borderRadius: "var(--cs-r-sm, 8px)",
        }}
      >
        <span style={{ fontSize: 13 }}>{meta.icon}</span>
        <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: meta.color }}>
          {meta.label}
        </span>
        <span
          style={{
            fontSize: "0.625rem",
            fontWeight: 700,
            color: "var(--cs-text-muted)",
            background: "var(--cs-surface-raised)",
            border: "1px solid var(--cs-border-soft)",
            padding: "1px 6px",
            borderRadius: 4,
            marginLeft: "auto",
          }}
        >
          {issues.length}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        {issues.map((issue) => (
          <IssueRow key={issue.id} issue={issue} />
        ))}
      </div>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

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
        No setup blockers detected. Everything looks ready for today&apos;s operations.
      </div>
    );
  }

  const bookingBlockers = issues.filter((i) => classifyIssue(i) === "booking_blockers");
  const dailyOps = issues.filter((i) => classifyIssue(i) === "daily_ops");
  const optional = issues.filter((i) => classifyIssue(i) === "optional");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
      <IssueGroupSection meta={GROUP_META.booking_blockers} issues={bookingBlockers} />
      <IssueGroupSection meta={GROUP_META.daily_ops} issues={dailyOps} />
      <IssueGroupSection meta={GROUP_META.optional} issues={optional} />
    </div>
  );
}
