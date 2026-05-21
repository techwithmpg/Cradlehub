import type { StaffScheduleItem } from "./staff-schedule-list";

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
  selectedGroup: string;
  onSelectGroup: (groupId: string) => void;
};

export function ScheduleGroupCards({ items, selectedGroup, onSelectGroup }: Props) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        overflowX: "auto",
        paddingBottom: 4,
        marginBottom: "1rem",
      }}
    >
      {STAFF_GROUPS.map((group) => {
        const count = items.filter((i) =>
          group.staffTypes.includes(i.staff.staff_type ?? "")
        ).length;
        const isActive = selectedGroup === group.id;

        return (
          <button
            key={group.id}
            type="button"
            onClick={() => onSelectGroup(group.id)}
            style={{
              flexShrink: 0,
              minWidth: 130,
              padding: "11px 14px",
              borderRadius: "var(--cs-r-md)",
              border: isActive
                ? "2px solid var(--cs-sand)"
                : "1px solid var(--cs-border-soft)",
              background: isActive ? "var(--cs-sand-tint)" : "var(--cs-surface)",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div style={{ fontSize: 18, marginBottom: 6 }}>{group.icon}</div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: isActive ? "var(--cs-sand-dark)" : "var(--cs-text)",
              }}
            >
              {group.label}
            </div>
            <div style={{ fontSize: 11, color: "var(--cs-text-muted)", marginTop: 2 }}>
              {count} Staff
            </div>
          </button>
        );
      })}
    </div>
  );
}
