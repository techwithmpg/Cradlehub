"use client";

/**
 * Schedule Density Context
 *
 * Provides density mode (comfortable | compact | ultra-compact) to all schedule
 * sub-components. Affects row heights, header heights, padding, and font sizes.
 *
 * Used by DailyScheduleBoard, ScheduleStaffRow, ScheduleStaffCell,
 * ScheduleTimeHeader, and ScheduleBookingBlock.
 */

import { createContext, useContext, useState, useCallback } from "react";

export type ScheduleDensity = "comfortable" | "compact" | "ultra-compact";

export type DensityMetrics = {
  rowHeight: number;
  headerHeight: number;
  staffCellPadding: number;
  avatarSize: number;
  fontSize: number;
  gap: number;
};

export const DENSITY_MAP: Record<ScheduleDensity, DensityMetrics> = {
  comfortable: {
    rowHeight: 76,
    headerHeight: 48,
    staffCellPadding: 12,
    avatarSize: 36,
    fontSize: 0.8125,
    gap: 10,
  },
  compact: {
    rowHeight: 56,
    headerHeight: 40,
    staffCellPadding: 8,
    avatarSize: 30,
    fontSize: 0.75,
    gap: 8,
  },
  "ultra-compact": {
    rowHeight: 42,
    headerHeight: 32,
    staffCellPadding: 6,
    avatarSize: 24,
    fontSize: 0.6875,
    gap: 6,
  },
};

export function getDensityMetrics(density: ScheduleDensity): DensityMetrics {
  return DENSITY_MAP[density];
}

type ScheduleDensityContextValue = {
  density: ScheduleDensity;
  metrics: DensityMetrics;
  setDensity: (d: ScheduleDensity) => void;
};

const ScheduleDensityContext = createContext<ScheduleDensityContextValue | null>(null);

export function useScheduleDensity(): ScheduleDensityContextValue {
  const ctx = useContext(ScheduleDensityContext);
  if (!ctx) {
    // Fallback to compact if used outside provider
    return {
      density: "compact",
      metrics: DENSITY_MAP["compact"],
      setDensity: () => {},
    };
  }
  return ctx;
}

export function ScheduleDensityProvider({
  children,
  defaultDensity = "compact",
}: {
  children: React.ReactNode;
  defaultDensity?: ScheduleDensity;
}) {
  const [density, setDensity] = useState<ScheduleDensity>(defaultDensity);
  const metrics = DENSITY_MAP[density];

  const handleSetDensity = useCallback((d: ScheduleDensity) => {
    setDensity(d);
  }, []);

  return (
    <ScheduleDensityContext.Provider
      value={{ density, metrics, setDensity: handleSetDensity }}
    >
      {children}
    </ScheduleDensityContext.Provider>
  );
}

// ── Toggle component ──────────────────────────────────────────────────────────

export function ScheduleDensityToggle() {
  const { density, setDensity } = useScheduleDensity();

  const options: { id: ScheduleDensity; label: string }[] = [
    { id: "comfortable", label: "Comfortable" },
    { id: "compact", label: "Compact" },
    { id: "ultra-compact", label: "Ultra" },
  ];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span
        style={{
          fontSize: "0.6875rem",
          fontWeight: 600,
          color: "var(--cs-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          marginRight: 4,
        }}
      >
        Density
      </span>
      {options.map((opt) => {
        const isActive = density === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => setDensity(opt.id)}
            style={{
              padding: "3px 8px",
              borderRadius: 5,
              border: `1px solid ${isActive ? "var(--cs-sand)" : "var(--cs-border-soft)"}`,
              background: isActive ? "var(--cs-sand-mist)" : "transparent",
              color: isActive ? "var(--cs-sand)" : "var(--cs-text-muted)",
              fontSize: "0.6875rem",
              fontWeight: isActive ? 600 : 400,
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 0.15s",
            }}
            aria-pressed={isActive}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
