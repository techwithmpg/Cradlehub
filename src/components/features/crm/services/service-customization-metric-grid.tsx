import { CheckCircle2, CircleAlert, Sparkles, TriangleAlert, UsersRound } from "lucide-react";
import { CrmStatCard, type CrmCardTone } from "@/components/features/crm/shared/crm-cards";
import type { CustomizationRow } from "./customization-rows";

export function ServiceCustomizationMetricGrid({ rows }: { rows: CustomizationRow[] }) {
  const total = rows.length;
  const basicSetupComplete = rows.filter((r) => r.isReady).length;
  const needsProvider = rows.filter((r) => r.isActive && r.providerCount === 0).length;
  const lowCoverage = rows.filter((r) => r.isActive && r.providerCount === 1).length;
  const needsSetup = rows.filter((r) => r.isActive && r.readinessIssues.length > 0).length;

  const cards: Array<{
    label: string;
    value: number;
    icon: typeof Sparkles;
    tone: CrmCardTone;
  }> = [
    {
      label: "Total Services",
      value: total,
      icon: Sparkles,
      tone: "neutral",
    },
    {
      label: "Basic Setup Complete",
      value: basicSetupComplete,
      icon: CheckCircle2,
      tone: "success",
    },
    {
      label: "Needs Provider",
      value: needsProvider,
      icon: TriangleAlert,
      tone: needsProvider > 0 ? "danger" : "neutral",
    },
    {
      label: "Low Coverage",
      value: lowCoverage,
      icon: UsersRound,
      tone: lowCoverage > 0 ? "warning" : "neutral",
    },
    {
      label: "Setup Issues",
      value: needsSetup,
      icon: CircleAlert,
      tone: needsSetup > 0 ? "warning" : "neutral",
    },
  ];

  return (
    <section
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
      aria-label="Service metrics"
    >
      {cards.map(({ label, value, icon: Icon, tone }) => (
        <CrmStatCard
          key={label}
          compact
          title={label}
          value={value}
          tone={tone}
          icon={<Icon className="size-4" aria-hidden="true" />}
        />
      ))}
    </section>
  );
}
