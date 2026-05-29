export function CrmPanel({
  title,
  action,
  children,
  className = "",
  style,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`cs-card ${className}`}
      style={{
        padding: "1rem 1.125rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        borderRadius: "var(--cs-r-xl)",
        ...style,
      }}
    >
      {(title || action) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
          }}
        >
          {title && (
            <div
              style={{
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "var(--cs-text)",
                fontFamily: "var(--font-display)",
                letterSpacing: "0.01em",
              }}
            >
              {title}
            </div>
          )}
          {action && <div style={{ flexShrink: 0 }}>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
