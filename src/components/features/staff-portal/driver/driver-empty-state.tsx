import type { LucideIcon } from "lucide-react";

type DriverEmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export function DriverEmptyState({ icon: Icon, title, description }: DriverEmptyStateProps) {
  return (
    <div
      style={{
        alignItems: "center",
        backgroundColor: "#fff",
        border: "1px solid var(--cs-border-soft)",
        borderRadius: 16,
        boxShadow: "var(--cs-shadow-xs)",
        display: "flex",
        flexDirection: "column",
        gap: "0.625rem",
        padding: "2.5rem 1.5rem",
        textAlign: "center",
      }}
    >
      <Icon size={30} color="var(--cs-text-muted)" style={{ opacity: 0.35 }} />
      <div style={{ color: "var(--cs-text)", fontSize: 14, fontWeight: 600 }}>{title}</div>
      <div style={{ color: "var(--cs-text-muted)", fontSize: 12.5, lineHeight: 1.5 }}>{description}</div>
    </div>
  );
}
