const ROLE_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  owner: { bg: "var(--ch-owner-bg)", color: "var(--ch-owner-text)", label: "Owner" },
  manager: { bg: "var(--ch-manager-bg)", color: "var(--ch-manager-text)", label: "Manager" },
  crm: { bg: "var(--ch-crm-bg)", color: "var(--ch-crm-text)", label: "CRM" },
  staff: { bg: "var(--ch-staff-bg)", color: "var(--ch-staff-text)", label: "Staff" },
};

export function RoleBadge({ role }: { role: string }) {
  const style = ROLE_STYLES[role] ?? ROLE_STYLES["staff"]!;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 20,
        fontSize: "0.6875rem",
        fontWeight: 600,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        backgroundColor: style.bg,
        color: style.color,
      }}
    >
      {style.label}
    </span>
  );
}
