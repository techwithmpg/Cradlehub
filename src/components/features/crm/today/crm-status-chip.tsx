"use client";

export function CrmStatusChip({
  label,
  value,
  icon,
  color = "var(--cs-text-secondary)",
  bg = "var(--cs-surface-warm)",
  border = "var(--cs-border-soft)",
  alertDot,
  pulse = false,
  onClick,
  href,
}: {
  label: string;
  value?: string | number;
  icon?: React.ReactNode;
  color?: string;
  bg?: string;
  border?: string;
  alertDot?: boolean;
  pulse?: boolean;
  onClick?: () => void;
  href?: string;
}) {
  const Wrapper = href ? "a" : onClick ? "button" : "div";

  return (
    <Wrapper
      {...(href ? { href } : {})}
      {...(onClick && !href ? { onClick, type: "button" } : {})}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 14px",
        borderRadius: "var(--cs-r-lg)",
        background: bg,
        border: `1px solid ${border}`,
        fontSize: "0.8125rem",
        fontWeight: 500,
        color,
        cursor: onClick || href ? "pointer" : "default",
        textDecoration: "none",
        whiteSpace: "nowrap",
        transition: "box-shadow 150ms ease, transform 150ms ease",
        letterSpacing: "0.01em",
      }}
      onMouseEnter={(e) => {
        if (onClick || href) {
          (e.currentTarget as HTMLElement).style.boxShadow = "var(--cs-shadow-xs)";
          (e.currentTarget as HTMLElement).style.transform = "translateY(-0.5px)";
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
        (e.currentTarget as HTMLElement).style.transform = "none";
      }}
    >
      {icon && (
        <span style={{ display: "inline-flex", alignItems: "center", opacity: 0.8 }}>
          {icon}
        </span>
      )}
      {alertDot && !icon && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: pulse ? "var(--cs-error)" : color,
            animation: pulse ? "soft-pulse 2s ease-in-out infinite" : undefined,
            flexShrink: 0,
          }}
        />
      )}
      <span>{label}</span>
      {value !== undefined && (
        <span style={{ fontWeight: 700, opacity: 0.95 }}>{value}</span>
      )}
    </Wrapper>
  );
}
