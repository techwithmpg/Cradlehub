type EmptyStateProps = {
  title:       string;
  description: string;
  action?:     React.ReactNode;
  icon?:       React.ReactNode;
};

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div style={{
      display:        "flex",
      flexDirection:  "column",
      alignItems:     "center",
      justifyContent: "center",
      padding:        "3rem 1rem",
      textAlign:      "center",
    }}>
      {icon && (
        <div style={{
          width:           44,
          height:          44,
          borderRadius:    "var(--cs-r-md)",
          backgroundColor: "var(--cs-sand-mist)",
          display:         "flex",
          alignItems:      "center",
          justifyContent:  "center",
          marginBottom:    "1rem",
          color:           "var(--cs-sand)",
        }}>
          {icon}
        </div>
      )}
      <div style={{
        fontSize:     14,
        fontWeight:   500,
        color:        "var(--cs-text)",
        marginBottom: "0.3rem",
      }}>
        {title}
      </div>
      <div style={{
        fontSize:     12.5,
        color:        "var(--cs-text-muted)",
        maxWidth:     320,
        lineHeight:   1.6,
        marginBottom: action ? "1.25rem" : 0,
      }}>
        {description}
      </div>
      {action}
    </div>
  );
}
