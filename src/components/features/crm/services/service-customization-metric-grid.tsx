import { Eye, EyeOff, Home, MapPin, Sparkles, Wrench } from "lucide-react";
import type { CustomizationRow } from "./customization-rows";

export function ServiceCustomizationMetricGrid({ rows }: { rows: CustomizationRow[] }) {
  const total = rows.length;
  const publicCount = rows.filter((r) => r.visibility === "public" && r.isActive).length;
  const inSpaCount = rows.filter((r) => r.isActive && r.isInSpa).length;
  const homeServiceCount = rows.filter((r) => r.isActive && r.isHomeService).length;
  const hiddenCount = rows.filter((r) => !r.isActive).length;
  const needsSetup = rows.filter((r) => r.isActive && !r.isReady).length;

  const cards = [
    {
      label: "Total Services",
      value: total,
      icon: Sparkles,
      color: "var(--cs-text)",
      bg: "var(--cs-sand-mist)",
    },
    {
      label: "Public Services",
      value: publicCount,
      icon: Eye,
      color: "#5A8A6A",
      bg: "rgba(90,138,106,0.12)",
    },
    {
      label: "In-Spa Services",
      value: inSpaCount,
      icon: MapPin,
      color: "#7c3aed",
      bg: "rgba(124,58,237,0.1)",
    },
    {
      label: "Home-Service",
      value: homeServiceCount,
      icon: Home,
      color: "#2563eb",
      bg: "rgba(37,99,235,0.1)",
    },
    {
      label: "Hidden",
      value: hiddenCount,
      icon: EyeOff,
      color: "var(--cs-text-muted)",
      bg: "var(--cs-surface-warm)",
    },
    {
      label: "Needs Setup",
      value: needsSetup,
      icon: Wrench,
      color: needsSetup > 0 ? "var(--cs-warning-text)" : "var(--cs-text-muted)",
      bg: needsSetup > 0 ? "var(--cs-warning-bg)" : "var(--cs-surface-warm)",
    },
  ];

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-label="Service metrics">
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
