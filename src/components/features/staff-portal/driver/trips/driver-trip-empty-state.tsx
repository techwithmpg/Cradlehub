import type { LucideIcon } from "lucide-react";

type DriverTripEmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export function DriverTripEmptyState({ icon: Icon, title, description }: DriverTripEmptyStateProps) {
  return (
    <div
      style={{
        alignItems: "center",
        backgroundColor: "#fff",
        border: "1px solid var(--cs-border-soft)",
        borderRadius: 18,
        boxShadow: "var(--cs-shadow-xs)",
        display: "flex",
        flexDirection: "column",
        gap: "0.625rem",
        padding: "2.25rem 1.5rem",
        textAlign: "center",
      }}
    >
      <div
        style={{
          alignItems: "center",
          backgroundColor: "var(--cs-surface-warm)",
          borderRadius: 16,
          display: "flex",
          height: 48,
          justifyContent: "center",
          width: 48,
        }}
      >
        <Icon size={24} color="var(--cs-staff-accent)" strokeWidth={1.8} />
      </div>
      <div style={{ color: "var(--cs-text)", fontSize: 15, fontWeight: 700 }}>{title}</div>
      <div style={{ color: "var(--cs-text-muted)", fontSize: 12.5, lineHeight: 1.5, maxWidth: 260 }}>
        {description}
      </div>
    </div>
  );
}
