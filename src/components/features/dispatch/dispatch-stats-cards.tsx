import type { ReactNode } from "react";
import { StatCard } from "@/components/features/dashboard/stat-card";

export interface DispatchStat {
  label: string;
  value: string | number;
  icon?: ReactNode;
  accentColor?: string;
}

interface DispatchStatsCardsProps {
  stats: DispatchStat[];
}

const ACCENT = "#6D28D9";

export function DispatchStatsCards({ stats }: DispatchStatsCardsProps) {
  return (
    <div
      style={{
        display:             "grid",
        gridTemplateColumns: `repeat(${Math.min(stats.length, 4)}, 1fr)`,
        gap:                 "0.75rem",
        marginBottom:        "1rem",
      }}
    >
      {stats.map((stat) => (
        <StatCard
          key={stat.label}
          label={stat.label}
          value={stat.value}
          icon={stat.icon}
          accentColor={stat.accentColor ?? ACCENT}
        />
      ))}
    </div>
  );
}
