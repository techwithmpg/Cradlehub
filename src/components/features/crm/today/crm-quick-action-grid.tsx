"use client";

import Link from "next/link";

export type QuickAction = {
  label: string;
  href: string;
  icon?: React.ReactNode;
  primary?: boolean;
};

export function CrmQuickActionGrid({ actions }: { actions: QuickAction[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: "0.5rem",
      }}
    >
      {actions.map((action) => (
        <Link
          key={action.label}
          href={action.href}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.375rem",
            padding: "0.625rem 0.5rem",
            borderRadius: "var(--cs-r-lg)",
            backgroundColor: action.primary ? "var(--cs-sand)" : "var(--cs-surface-warm)",
            color: action.primary ? "#fff" : "var(--cs-text-secondary)",
            fontSize: "0.75rem",
            fontWeight: 600,
            textDecoration: "none",
            textAlign: "center",
            border: action.primary ? "none" : "1px solid var(--cs-border-soft)",
            transition: "box-shadow 150ms ease, transform 150ms ease",
            minHeight: 64,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = "var(--cs-shadow-sm)";
            (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = "none";
            (e.currentTarget as HTMLElement).style.transform = "none";
          }}
        >
          {action.icon && (
            <span style={{ fontSize: 16, opacity: action.primary ? 0.9 : 0.7 }}>
              {action.icon}
            </span>
          )}
          <span>{action.label}</span>
        </Link>
      ))}
    </div>
  );
}
