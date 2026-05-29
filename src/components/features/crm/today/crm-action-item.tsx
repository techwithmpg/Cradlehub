"use client";

import Link from "next/link";
import { CrmLoadingButton } from "./crm-loading-button";

export type ActionItemData = {
  id: string;
  title: string;
  description?: string;
  category: string;
  severity: "critical" | "warning" | "info";
  actionLabel: string;
  actionHref?: string;
  onAction?: () => Promise<void> | void;
};

const SEVERITY_STYLES = {
  critical: {
    dot: "var(--cs-error)",
    border: "var(--cs-error-bg)",
    bg: "var(--cs-error-bg)",
  },
  warning: {
    dot: "var(--cs-warning)",
    border: "var(--cs-warning-bg)",
    bg: "var(--cs-warning-bg)",
  },
  info: {
    dot: "var(--cs-info)",
    border: "var(--cs-info-bg)",
    bg: "var(--cs-info-bg)",
  },
};

export function CrmActionItem({ item }: { item: ActionItemData }) {
  const sev = SEVERITY_STYLES[item.severity];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "0.75rem",
        padding: "0.75rem 1rem",
        borderRadius: "var(--cs-r-md)",
        background: sev.bg,
        border: `1px solid ${sev.border}`,
        transition: "box-shadow 150ms ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--cs-shadow-sm)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: sev.dot,
          marginTop: 5,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--cs-text)",
            marginBottom: 2,
          }}
        >
          {item.title}
        </div>
        {item.description && (
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--cs-text-secondary)",
              lineHeight: 1.4,
              marginBottom: 4,
            }}
          >
            {item.description}
          </div>
        )}
        <div style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {item.category}
        </div>
      </div>

      {item.actionHref ? (
        <Link
          href={item.actionHref}
          style={{
            flexShrink: 0,
            fontSize: "0.75rem",
            fontWeight: 600,
            color: "var(--cs-sand)",
            textDecoration: "none",
            padding: "4px 10px",
            borderRadius: "var(--cs-r-sm)",
            border: "1px solid var(--cs-border)",
            background: "var(--cs-surface)",
            whiteSpace: "nowrap",
          }}
        >
          {item.actionLabel}
        </Link>
      ) : item.onAction ? (
        <CrmLoadingButton
          label={item.actionLabel}
          variant="secondary"
          onClick={item.onAction}
          style={{ flexShrink: 0, whiteSpace: "nowrap" }}
        />
      ) : null}
    </div>
  );
}
