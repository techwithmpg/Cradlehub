"use client";

import { CountUpNumber } from "./count-up-number";

export function CrmMetricCard({
  label,
  value,
  prefix = "",
  suffix = "",
  color = "var(--cs-text)",
  icon,
  trend,
  href,
  onClick,
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  color?: string;
  icon?: React.ReactNode;
  trend?: string;
  href?: string;
  onClick?: () => void;
}) {
  const Wrapper = href ? "a" : onClick ? "button" : "div";

  return (
    <Wrapper
      {...(href ? { href } : {})}
      {...(onClick && !href ? { onClick, type: "button" } : {})}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "0.75rem",
        cursor: href || onClick ? "pointer" : "default",
        textDecoration: "none",
        color: "inherit",
        background: "var(--cs-surface)",
        border: "1px solid var(--cs-border-soft)",
        borderRadius: "var(--cs-r-xl)",
        padding: "1rem",
        transition: "box-shadow 180ms var(--cs-ease), transform 180ms var(--cs-ease)",
        minHeight: 88,
      }}
      onMouseEnter={(e) => {
        if (href || onClick) {
          (e.currentTarget as HTMLElement).style.boxShadow = "var(--cs-shadow-sm)";
          (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--cs-shadow-xs)";
        (e.currentTarget as HTMLElement).style.transform = "none";
      }}
    >
      {/* Icon circle */}
      {icon && (
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            background: `${color}12`,
            color,
            fontSize: 14,
          }}
        >
          {icon}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <p
          style={{
            fontSize: "0.6875rem",
            fontWeight: 600,
            color: "var(--cs-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            lineHeight: 1.3,
          }}
        >
          {label}
        </p>
        <p
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            lineHeight: 1.1,
            color: "var(--cs-text)",
            fontFamily: "var(--font-display)",
          }}
        >
          <CountUpNumber value={value} prefix={prefix} suffix={suffix} />
        </p>
        {trend && (
          <p style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", marginTop: 2 }}>
            {trend}
          </p>
        )}
      </div>
    </Wrapper>
  );
}
