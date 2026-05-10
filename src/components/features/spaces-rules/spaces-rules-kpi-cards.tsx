import { Building2, CheckCircle2, ClipboardList, AlertTriangle, CircleDashed } from "lucide-react";

export type KpiData = {
  totalSpaces: number;
  activeSpaces: number;
  activeRules: number;
  conflicts: number;
  missingAssignments: number;
};

export function SpacesRulesKpiCards({
  data,
  showActiveRules = true,
}: {
  data: KpiData;
  showActiveRules?: boolean;
}) {
  const cards = [
    {
      label: "Total Spaces",
      value: data.totalSpaces,
      icon: Building2,
      color: "var(--cs-text)",
    },
    {
      label: "Available Today",
      value: data.activeSpaces,
      icon: CheckCircle2,
      color: "#4A7C59",
    },
    ...(showActiveRules
      ? [
          {
            label: "Active Rules",
            value: data.activeRules,
            icon: ClipboardList,
            color: "var(--cs-sand)",
          },
        ]
      : []),
    {
      label: "Conflicts",
      value: data.conflicts,
      icon: AlertTriangle,
      color: data.conflicts > 0 ? "#EF4444" : "var(--cs-text-muted)",
    },
    {
      label: "Missing Assignments",
      value: data.missingAssignments,
      icon: CircleDashed,
      color: data.missingAssignments > 0 ? "#D97706" : "var(--cs-text-muted)",
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: "0.75rem",
      }}
    >
      {cards.map((card) => (
        <div
          key={card.label}
          className="cs-card"
          style={{
            padding: "0.875rem 1rem",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              backgroundColor: "var(--cs-surface-warm)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <card.icon size={16} style={{ color: card.color }} />
          </div>
          <div>
            <div
              style={{
                fontSize: "1.125rem",
                fontWeight: 700,
                color: card.color,
                lineHeight: 1.2,
              }}
            >
              {card.value}
            </div>
            <div
              style={{
                fontSize: "0.6875rem",
                color: "var(--cs-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {card.label}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
