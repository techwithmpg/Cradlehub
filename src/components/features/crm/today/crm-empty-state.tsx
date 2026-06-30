"use client";

import Link from "next/link";

export function CrmEmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  action,
  icon,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: "2.5rem 1.5rem",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.5rem",
      }}
    >
      {icon ? (
        <div style={{ fontSize: 28, marginBottom: 4, color: "var(--cs-text-muted)" }}>
          {icon}
        </div>
      ) : (
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "var(--cs-surface-warm)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 4,
            fontSize: 18,
          }}
        >
          ✓
        </div>
      )}
      <div
        style={{
          fontSize: "0.9375rem",
          fontWeight: 600,
          color: "var(--cs-text-secondary)",
        }}
      >
        {title}
      </div>
      {description && (
        <div
          style={{
            fontSize: "0.8125rem",
            color: "var(--cs-text-muted)",
            lineHeight: 1.5,
            maxWidth: 320,
          }}
        >
          {description}
        </div>
      )}
      {action ? (
        action
      ) : actionLabel && actionHref ? (
        <Link
          href={actionHref}
          style={{
            marginTop: 4,
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--cs-sand)",
            textDecoration: "none",
          }}
        >
          {actionLabel} →
        </Link>
      ) : null}
    </div>
  );
}
