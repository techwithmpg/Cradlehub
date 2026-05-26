import {
  Building2,
  CheckCircle2,
  ClipboardList,
  AlertTriangle,
  CircleDashed,
  Users,
  Ban,
} from "lucide-react";
import type { CrmOperationalKpiData } from "./spaces-rules-utils";

// ── Original KPI Cards (Owner/Manager) ─────────────────────────────────────────

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

// ── CRM Operational KPI Strip ──────────────────────────────────────────────────

type CrmKpiCard = {
  key: string;
  label: string;
  value: number;
  icon: typeof Building2;
  color: string;
  bgTint?: string;
};

export function CrmOperationalKpiStrip({ data }: { data: CrmOperationalKpiData }) {
  const cards: CrmKpiCard[] = [
    {
      key: "total",
      label: "Total Spaces",
      value: data.totalSpaces,
      icon: Building2,
      color: "var(--cs-text)",
    },
    {
      key: "available",
      label: "Available Now",
      value: data.availableToday,
      icon: CheckCircle2,
      color: "#4A7C59",
      bgTint: "rgba(74, 124, 89, 0.06)",
    },
    {
      key: "occupied",
      label: "Occupied",
      value: data.occupiedNow,
      icon: Users,
      color: "#B08850",
      bgTint: data.occupiedNow > 0 ? "rgba(176, 136, 80, 0.06)" : undefined,
    },
    {
      key: "conflicts",
      label: "Conflicts",
      value: data.conflicts,
      icon: AlertTriangle,
      color: data.conflicts > 0 ? "#DC2626" : "var(--cs-text-muted)",
      bgTint: data.conflicts > 0 ? "rgba(220, 38, 38, 0.06)" : undefined,
    },
    {
      key: "missing",
      label: "Missing Room",
      value: data.missingAssignments,
      icon: CircleDashed,
      color: data.missingAssignments > 0 ? "#D97706" : "var(--cs-text-muted)",
      bgTint: data.missingAssignments > 0 ? "rgba(217, 119, 6, 0.06)" : undefined,
    },
    {
      key: "blocked",
      label: "Blocked / Off",
      value: data.blocked,
      icon: Ban,
      color: data.blocked > 0 ? "var(--cs-text-secondary)" : "var(--cs-text-muted)",
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(6, 1fr)",
        gap: "0.5rem",
      }}
      className="crm-kpi-strip"
    >
      {cards.map((card) => (
        <div
          key={card.key}
          style={{
            padding: "0.75rem 0.875rem",
            borderRadius: "var(--cs-r-md)",
            border: "1px solid var(--cs-border-soft)",
            backgroundColor: card.bgTint ?? "var(--cs-surface)",
            display: "flex",
            alignItems: "center",
            gap: "0.625rem",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              backgroundColor: "var(--cs-surface-warm)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <card.icon size={14} style={{ color: card.color }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: "1rem",
                fontWeight: 700,
                color: card.color,
                lineHeight: 1.2,
              }}
            >
              {card.value}
            </div>
            <div
              style={{
                fontSize: "0.625rem",
                color: "var(--cs-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                whiteSpace: "nowrap",
              }}
            >
              {card.label}
            </div>
          </div>
        </div>
      ))}

      <style>{`
        @media (max-width: 1100px) {
          .crm-kpi-strip {
            grid-template-columns: repeat(3, 1fr) !important;
          }
        }
        @media (max-width: 640px) {
          .crm-kpi-strip {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>
    </div>
  );
}
