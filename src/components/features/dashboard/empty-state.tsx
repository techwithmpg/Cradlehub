type EmptyStateProps = {
  title:       string;
  description: string;
  action?:     React.ReactNode;
  icon?:       string;
};

export function EmptyState({ title, description, action, icon = "🌿" }: EmptyStateProps) {
  return (
    <div style={{
      display:        "flex",
      flexDirection:  "column",
      alignItems:     "center",
      justifyContent: "center",
      padding:        "3.5rem 1rem",
      textAlign:      "center",
    }}>
      <div style={{
        width:           56,
        height:          56,
        borderRadius:    "var(--cs-radius-lg)",
        backgroundColor: "var(--cs-sand-lighter)",
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "center",
        marginBottom:    "1.125rem",
        fontSize:        24,
      }}>
        {icon}
      </div>
      <div style={{
        fontSize:     "1rem",
        fontWeight:   600,
        color:        "var(--cs-text)",
        marginBottom: "0.375rem",
        fontFamily:   "var(--font-display)",
      }}>
        {title}
      </div>
      <div style={{
        fontSize:     "0.875rem",
        color:        "var(--cs-text-muted)",
        maxWidth:     360,
        lineHeight:   1.6,
        marginBottom: action ? "1.25rem" : 0,
      }}>
        {description}
      </div>
      {action}
    </div>
  );
}
