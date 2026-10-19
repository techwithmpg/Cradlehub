import { CheckCircle2, CircleAlert, Sparkles, TriangleAlert, UsersRound } from "lucide-react";
import type { CustomizationRow } from "./customization-rows";

export function ServiceCustomizationMetricGrid({ rows }: { rows: CustomizationRow[] }) {
  const total = rows.length;
  const basicSetupComplete = rows.filter((r) => r.isReady).length;
  const needsProvider = rows.filter((r) => r.isActive && r.providerCount === 0).length;
  const lowCoverage = rows.filter((r) => r.isActive && r.providerCount === 1).length;
  const needsSetup = rows.filter((r) => r.isActive && r.readinessIssues.length > 0).length;

  const cards = [
    {
      label: "Total Services",
      value: total,
      icon: Sparkles,
      color: "var(--cs-text)",
      bg: "var(--cs-sand-mist)",
    },
    {
      label: "Basic Setup Complete",
      value: basicSetupComplete,
      icon: CheckCircle2,
      color: "#5A8A6A",
      bg: "rgba(90,138,106,0.12)",
    },
    {
      label: "Needs Provider",
      value: needsProvider,
      icon: TriangleAlert,
      color: "var(--cs-warning-text)",
      bg: "var(--cs-warning-bg)",
    },
    {
      label: "Low Coverage",
      value: lowCoverage,
      icon: UsersRound,
      color: "var(--cs-warning-text)",
      bg: "var(--cs-warning-bg)",
    },
    {
      label: "Setup Issues",
      value: needsSetup,
      icon: CircleAlert,
      color: needsSetup > 0 ? "var(--cs-warning-text)" : "var(--cs-text-muted)",
      bg: needsSetup > 0 ? "var(--cs-warning-bg)" : "var(--cs-surface-warm)",
    },
  ];

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="Service metrics">
      {cards.map(({ label, value, icon: Icon, color, bg }) => (
        <div
          key={label}
          className="rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-4 shadow-[var(--cs-shadow-xs)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="m-0 text-xs font-medium text-[var(--cs-text-muted)]">{label}</p>
              <p className="mt-2 text-3xl font-semibold leading-none" style={{ color }}>
                {value}
              </p>
            </div>
            <div
              className="flex size-8 items-center justify-center rounded-lg"
              style={{ background: bg, color }}
            >
              <Icon className="size-4" aria-hidden="true" />
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}
