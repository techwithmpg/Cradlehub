const ROLE_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  owner:             { bg: "#F5EDE3", color: "#7A5233", label: "Owner"          },
  manager:           { bg: "#EDF3F8", color: "#4A6B82", label: "Manager"        },
  assistant_manager: { bg: "#EDF3F8", color: "#4A6B82", label: "Asst. Manager"  },
  store_manager:     { bg: "#EDF3F8", color: "#4A6B82", label: "Store Manager"  },
  crm:               { bg: "#EAF0EA", color: "#4A6B52", label: "CRM"            },
  csr:               { bg: "#FAF0E4", color: "#7A5A34", label: "Front Desk"     },
  staff:             { bg: "#F5F0EA", color: "#6B5A4A", label: "Therapist"      },
};

export function RoleBadge({ role }: { role: string }) {
  const s = ROLE_STYLES[role] ?? ROLE_STYLES["staff"]!;
  return (
    <span style={{
      display:         "inline-block",
      padding:         "2px 8px",
      borderRadius:    "var(--cs-radius-pill)",
      fontSize:        "0.6875rem",
      fontWeight:      600,
      letterSpacing:   "0.04em",
      textTransform:   "uppercase" as const,
      backgroundColor: s.bg,
      color:           s.color,
    }}>
      {s.label}
    </span>
  );
}
