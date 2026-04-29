type EmptyStateProps = {
  title: string;
  description: string;
  action?: React.ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "3rem 1rem",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          backgroundColor: "var(--ch-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "1rem",
          fontSize: 22,
        }}
      >
        ○
      </div>
      <div
        style={{
          fontSize: "0.9375rem",
          fontWeight: 500,
          color: "var(--ch-text)",
          marginBottom: "0.375rem",
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: "0.875rem",
          color: "var(--ch-text-muted)",
          maxWidth: 360,
          marginBottom: action ? "1.25rem" : 0,
        }}
      >
        {description}
      </div>
      {action}
    </div>
  );
}
