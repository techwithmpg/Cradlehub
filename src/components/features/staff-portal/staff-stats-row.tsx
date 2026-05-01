import { Calendar, CheckCircle2, Clock, Home } from "lucide-react";

type StaffStatsRowProps = {
  total: number;
  completed: number;
  remaining: number;
  homeService: number;
};

function StatPill({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.625rem",
        padding: "0.625rem 0.875rem",
        backgroundColor: "var(--cs-surface)",
        border: "1px solid var(--cs-border-soft)",
        borderRadius: "var(--cs-r-md)",
        flex: 1,
        minWidth: 0,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "var(--cs-r-sm)",
          backgroundColor: `${color}15`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: color,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 17,
            fontWeight: 600,
            color: "var(--cs-text)",
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
        </div>
        <div style={{ fontSize: 11, color: "var(--cs-text-muted)", marginTop: 3, lineHeight: 1 }}>
          {label}
        </div>
      </div>
    </div>
  );
}

export function StaffStatsRow({ total, completed, remaining, homeService }: StaffStatsRowProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: "0.625rem",
      }}
    >
      <StatPill icon={<Calendar size={16} />} label="Total Today" value={total} color="var(--cs-sand)" />
      <StatPill icon={<CheckCircle2 size={16} />} label="Completed" value={completed} color="var(--cs-success)" />
      <StatPill icon={<Clock size={16} />} label="Remaining" value={remaining} color="var(--cs-info)" />
      <StatPill icon={<Home size={16} />} label="Home Service" value={homeService} color="var(--cs-staff-accent)" />
    </div>
  );
}
