import Link from "next/link";

type ShortcutTile = {
  icon: string;
  label: string;
  description: string;
  href: string;
};

const TILES: ShortcutTile[] = [
  {
    icon: "✨",
    label: "Fix Services",
    description: "Assign providers to active services so customers can book.",
    href: "/crm/services",
  },
  {
    icon: "🗓️",
    label: "Fix Schedules",
    description: "Add weekly schedules, day-offs, and blocked time.",
    href: "/crm/staff-availability",
  },
  {
    icon: "🏠",
    label: "Fix Rooms & Rules",
    description: "Review rooms, resources, booking hours, and home-service windows.",
    href: "/crm/spaces-rules",
  },
  {
    icon: "📋",
    label: "Review Bookings",
    description: "Process pending requests and assign today’s bookings.",
    href: "/crm/today?filter=exceptions",
  },
  {
    icon: "🚗",
    label: "Open Dispatch",
    description: "Review home-service trips and driver assignment.",
    href: "/crm/dispatch",
  },
  {
    icon: "📊",
    label: "Work Queue",
    description: "Return to today’s prioritized CRM queue.",
    href: "/crm/today",
  },
];

export function CrmSetupWorkspaceTiles() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "0.625rem",
      }}
    >
      {TILES.map((tile) => (
        <Link
          key={tile.href}
          href={tile.href}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            padding: "0.875rem 1rem",
            backgroundColor: "var(--cs-surface)",
            border: "1px solid var(--cs-border-soft)",
            borderRadius: "var(--cs-r-md, 10px)",
            textDecoration: "none",
            color: "var(--cs-text)",
            transition: "border-color 0.15s, background 0.15s",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>{tile.icon}</span>
            <span
              style={{
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "var(--cs-text)",
                flex: 1,
              }}
            >
              {tile.label}
            </span>
            <span style={{ color: "var(--cs-text-muted)", fontSize: 14 }}>›</span>
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", lineHeight: 1.5 }}>
            {tile.description}
          </div>
        </Link>
      ))}
    </div>
  );
}
