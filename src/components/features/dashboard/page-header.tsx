type PageHeaderProps = {
  title:        string;
  description?: string;
  action?:      React.ReactNode;
  badge?:       React.ReactNode;
  icon?:        React.ReactNode;
};

export function PageHeader({ title, description, action, badge }: PageHeaderProps) {
  return (
    <div style={{
      display:        "flex",
      alignItems:     "flex-start",
      justifyContent: "space-between",
      gap:            "1rem",
      marginBottom:   "1.25rem",
    }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: description ? "0.2rem" : 0 }}>
          <h2 style={{
            fontSize:   16,
            fontWeight: 600,
            color:      "var(--cs-text)",
            margin:     0,
            lineHeight: 1.25,
          }}>
            {title}
          </h2>
          {badge}
        </div>
        {description && (
          <p style={{
            fontSize:   12.5,
            color:      "var(--cs-text-muted)",
            margin:     0,
            lineHeight: 1.5,
          }}>
            {description}
          </p>
        )}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}
