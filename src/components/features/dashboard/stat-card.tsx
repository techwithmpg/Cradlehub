type StatCardProps = {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
};

export function StatCard({ label, value, sub, accent }: StatCardProps) {
  return (
    <div
      style={{
        backgroundColor: "var(--ch-surface)",
        border: "1px solid var(--ch-border)",
        borderLeft: accent ? "3px solid var(--ch-accent)" : "1px solid var(--ch-border)",
        borderRadius: 10,
        padding: "1rem 1.25rem",
      }}
    >
      <div
        style={{
          fontSize: "0.75rem",
          fontWeight: 500,
          color: "var(--ch-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "0.375rem",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "1.75rem",
          fontWeight: 600,
          color: "var(--ch-text)",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontSize: "0.75rem",
            color: "var(--ch-text-subtle)",
            marginTop: "0.25rem",
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
