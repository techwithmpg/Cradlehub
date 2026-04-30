type PageHeaderProps = {
  title:        string;
  description?: string;
  action?:      React.ReactNode;
  icon?:        string;
};

export function PageHeader({ title, description, action, icon }: PageHeaderProps) {
  return (
    <div style={{
      display:        "flex",
      alignItems:     "flex-start",
      justifyContent: "space-between",
      gap:            "1rem",
      marginBottom:   "1.75rem",
      paddingBottom:  "1.25rem",
      borderBottom:   "1px solid var(--cs-border-light)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
        {icon && (
          <div style={{
            width:           40,
            height:          40,
            borderRadius:    "var(--cs-radius-md)",
            background:      "var(--cs-sand-lighter)",
            display:         "flex",
            alignItems:      "center",
            justifyContent:  "center",
            fontSize:        18,
            flexShrink:      0,
          }}>
            {icon}
          </div>
        )}
        <div>
          <h2 style={{
            fontSize:   "1.125rem",
            fontWeight: 600,
            color:      "var(--cs-text)",
            margin:     0,
            fontFamily: "var(--font-display)",
          }}>
            {title}
          </h2>
          {description && (
            <p style={{
              fontSize:  "0.875rem",
              color:     "var(--cs-text-muted)",
              marginTop: "0.2rem",
              marginBottom: 0,
            }}>
              {description}
            </p>
          )}
        </div>
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}
