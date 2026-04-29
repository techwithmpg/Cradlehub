type PageHeaderProps = {
  title: string;
  description?: string;
  action?: React.ReactNode; // CTA button, goes top-right
};

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "1rem",
        marginBottom: "1.5rem",
      }}
    >
      <div>
        <h2
          style={{
            fontSize: "1.125rem",
            fontWeight: 600,
            color: "var(--ch-text)",
            margin: 0,
          }}
        >
          {title}
        </h2>
        {description && (
          <p
            style={{
              fontSize: "0.875rem",
              color: "var(--ch-text-muted)",
              marginTop: "0.25rem",
              marginBottom: 0,
            }}
          >
            {description}
          </p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
