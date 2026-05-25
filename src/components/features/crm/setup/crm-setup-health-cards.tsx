import type { CrmSetupHealthData } from "@/lib/queries/crm-setup";

type CardStatus = "ready" | "warning" | "error" | "info";

type HealthCard = {
  icon: string;
  label: string;
  value: string;
  sub: string;
  status: CardStatus;
};

function statusColor(s: CardStatus): string {
  if (s === "ready")   return "var(--cs-success)";
  if (s === "error")   return "var(--cs-error, #c0392b)";
  if (s === "warning") return "var(--cs-warning, #e67e22)";
  return "var(--cs-text-muted)";
}

function statusBg(s: CardStatus): string {
  if (s === "ready")   return "var(--cs-success-bg)";
  if (s === "error")   return "rgba(192,57,43,0.08)";
  if (s === "warning") return "rgba(230,126,34,0.08)";
  return "var(--cs-surface-raised)";
}

function StatusDot({ status }: { status: CardStatus }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        backgroundColor: statusColor(status),
        flexShrink: 0,
      }}
    />
  );
}

function HealthCardView({ card }: { card: HealthCard }) {
  return (
    <div
      style={{
        backgroundColor: statusBg(card.status),
        border: `1px solid ${statusColor(card.status)}33`,
        borderRadius: "var(--cs-r-md, 10px)",
        padding: "1rem 1.125rem",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 18 }}>{card.icon}</span>
        <span
          style={{
            fontSize: "0.6875rem",
            fontWeight: 600,
            color: "var(--cs-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            flex: 1,
          }}
        >
          {card.label}
        </span>
        <StatusDot status={card.status} />
      </div>
      <div
        style={{
          fontSize: "1.375rem",
          fontWeight: 700,
          color: statusColor(card.status),
          lineHeight: 1,
          fontFamily: "var(--font-display)",
        }}
      >
        {card.value}
      </div>
      <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", lineHeight: 1.4 }}>
        {card.sub}
      </div>
    </div>
  );
}

function buildCards(d: CrmSetupHealthData): HealthCard[] {
  const staffStatus: CardStatus =
    d.serviceStaffTotal === 0            ? "warning"
    : d.serviceStaffWithSchedule === d.serviceStaffTotal ? "ready"
    : "warning";

  const servicesStatus: CardStatus =
    d.activeServicesTotal === 0          ? "warning"
    : d.servicesWithStaff === d.activeServicesTotal ? "ready"
    : d.servicesWithStaff === 0          ? "error"
    : "warning";

  const resourcesStatus: CardStatus =
    d.activeResourcesTotal > 0 ? "ready" : "warning";

  const rulesStatus: CardStatus = d.hasCustomRules ? "ready" : "info";

  const homeServiceStatus: CardStatus =
    !d.homeServiceEnabled                      ? "info"
    : d.driversTotal > 0                       ? "ready"
    : "error";

  const unassignedStatus: CardStatus =
    d.unassignedTodayCount === 0 ? "ready" : "error";

  return [
    {
      icon: "👥",
      label: "Service Staff",
      value: `${d.serviceStaffWithSchedule}/${d.serviceStaffTotal}`,
      sub: "therapists with a schedule set up",
      status: staffStatus,
    },
    {
      icon: "✨",
      label: "Active Services",
      value: `${d.servicesWithStaff}/${d.activeServicesTotal}`,
      sub: "services with therapists assigned",
      status: servicesStatus,
    },
    {
      icon: "🏠",
      label: "Rooms & Resources",
      value: String(d.activeResourcesTotal),
      sub: d.activeResourcesTotal === 1 ? "active resource" : "active resources",
      status: resourcesStatus,
    },
    {
      icon: "📋",
      label: "Booking Rules",
      value: d.hasCustomRules ? "Custom" : "Defaults",
      sub: d.hasCustomRules ? "custom rules are saved" : "using system defaults",
      status: rulesStatus,
    },
    {
      icon: "🚗",
      label: "Home Service",
      value: d.homeServiceEnabled ? "Enabled" : "Disabled",
      sub: d.homeServiceEnabled
        ? `${d.driversTotal} driver${d.driversTotal !== 1 ? "s" : ""} on file`
        : "not accepting home-service bookings",
      status: homeServiceStatus,
    },
    {
      icon: "📅",
      label: "Unassigned Today",
      value: String(d.unassignedTodayCount),
      sub: d.unassignedTodayCount === 0
        ? "all confirmed bookings are assigned"
        : "confirmed bookings need a therapist",
      status: unassignedStatus,
    },
  ];
}

export function CrmSetupHealthCards({ data }: { data: CrmSetupHealthData }) {
  const cards = buildCards(data);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
        gap: "0.875rem",
      }}
    >
      {cards.map((card) => (
        <HealthCardView key={card.label} card={card} />
      ))}
    </div>
  );
}
