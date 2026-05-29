import type { StaffScheduleItem } from "./staff-schedule-list";
import type { StaffScheduleGroup } from "@/lib/queries/staff-schedule-groups";

// ── Group definitions ──────────────────────────────────────────────────────────

export type StaffGroupDef = {
  id: string;
  label: string;
  icon: string;
  staffTypes: string[];
};

export const STAFF_GROUPS: StaffGroupDef[] = [
  { id: "therapist",    label: "Therapists",        icon: "👤", staffTypes: ["therapist"] },
  { id: "driver",       label: "Drivers",           icon: "🚗", staffTypes: ["driver"] },
  { id: "csr",          label: "CRM / Front Desk",  icon: "💼", staffTypes: ["csr"] },
  { id: "utility",      label: "Utility",           icon: "🔧", staffTypes: ["utility"] },
  { id: "managerial",   label: "Managers",          icon: "🛡️", staffTypes: ["managerial"] },
  { id: "nail_tech",    label: "Salon / Nail Tech",  icon: "✂️", staffTypes: ["nail_tech", "salon_head"] },
  { id: "aesthetician", label: "Aesthetician",      icon: "🌿", staffTypes: ["aesthetician"] },
];

export function getGroupLabel(groupId: string): string {
  return STAFF_GROUPS.find((g) => g.id === groupId)?.label ?? groupId;
}

// ── Component ──────────────────────────────────────────────────────────────────

type Props = {
  items: StaffScheduleItem[];
  groups: StaffScheduleGroup[];
  selectedGroup: string;
  onSelectGroup: (groupId: string) => void;
};

export function ScheduleGroupCards({ items, groups, selectedGroup, onSelectGroup }: Props) {
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        overflowX: "auto",
        paddingBottom: 4,
      }}
    >
      {STAFF_GROUPS.map((group) => {
        const count = items.filter((i) =>
          group.staffTypes.includes(i.staff.staff_type ?? "")
        ).length;
        const isActive = selectedGroup === group.id;
        const hasGroupData = groups.some((g) => g.group_key === group.id);

        return (
          <button
            key={group.id}
            type="button"
            onClick={() => onSelectGroup(group.id)}
            style={{
              flexShrink: 0,
              padding: "8px 14px",
              borderRadius: "var(--cs-r-lg)",
              border: isActive
                ? "1.5px solid var(--cs-crm-accent)"
                : "1px solid var(--cs-border-soft)",
              background: isActive ? "rgba(90,138,106,0.08)" : "var(--cs-surface)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "all 150ms ease",
              boxShadow: isActive ? "var(--cs-shadow-xs)" : "none",
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLElement).style.background = "var(--cs-surface-warm)";
                (e.currentTarget as HTMLElement).style.borderColor = "var(--cs-border)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLElement).style.background = "var(--cs-surface)";
                (e.currentTarget as HTMLElement).style.borderColor = "var(--cs-border-soft)";
              }
            }}
          >
            <span style={{ fontSize: 15, lineHeight: 1 }}>{group.icon}</span>
            <span
              style={{
                fontSize: "0.8125rem",
                fontWeight: isActive ? 700 : 600,
                color: isActive ? "var(--cs-crm-accent)" : "var(--cs-text)",
                letterSpacing: "0.01em",
              }}
            >
              {group.label}
            </span>
            <span
              style={{
                fontSize: "0.75rem",
                color: isActive ? "var(--cs-crm-accent)" : "var(--cs-text-muted)",
                fontWeight: 700,
                background: isActive ? "rgba(90,138,106,0.12)" : "var(--cs-surface-warm)",
                padding: "1px 7px",
                borderRadius: "var(--cs-r-pill)",
                minWidth: 20,
                textAlign: "center",
              }}
            >
              {count}
            </span>
            {!hasGroupData && count > 0 && (
              <span
                style={{
                  fontSize: "0.625rem",
                  fontWeight: 700,
                  padding: "2px 6px",
                  background: "var(--cs-error-bg)",
                  color: "var(--cs-error)",
                  borderRadius: "var(--cs-r-pill)",
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                }}
              >
                No rules
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
