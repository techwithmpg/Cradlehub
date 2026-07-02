import { canonicalizeSystemRole } from "@/constants/staff-roles";

const ROLE_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  owner:    { bg: "var(--cs-owner-bg)",   color: "var(--cs-owner-text)",   label: "Owner"    },
  manager:  { bg: "var(--cs-manager-bg)", color: "var(--cs-manager-text)", label: "Manager"  },
  crm:      { bg: "var(--cs-crm-bg)",     color: "var(--cs-crm-text)",     label: "CRM"      },
  staff:             { bg: "var(--cs-staff-bg)",   color: "var(--cs-staff-text)",   label: "Therapist"     },
};

export function RoleBadge({ role }: { role: string }) {
  const s = ROLE_STYLES[canonicalizeSystemRole(role)] ?? ROLE_STYLES["staff"]!;
  return (
    <span
      className="cs-badge"
      style={{ backgroundColor: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  );
}
