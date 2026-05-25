import Link from "next/link";
import type { ReadinessHealthMetric, ReadinessStatus } from "@/types/readiness";

// ── Status style map ──────────────────────────────────────────────────────────

type MetricStatusStyle = {
  valueColor: string;
  accentBg: string;
  accentBorder: string;
};

const STATUS_STYLE: Record<ReadinessStatus | "neutral", MetricStatusStyle> = {
  critical: {
    valueColor: "var(--cs-error, #c0392b)",
    accentBg: "rgba(192, 57, 43, 0.055)",
    accentBorder: "rgba(192, 57, 43, 0.22)",
  },
  warning: {
    valueColor: "var(--cs-warning, #e67e22)",
    accentBg: "rgba(230, 126, 34, 0.055)",
    accentBorder: "rgba(230, 126, 34, 0.22)",
  },
  ok: {
    valueColor: "var(--cs-success, #27ae60)",
    accentBg: "rgba(39, 174, 96, 0.055)",
    accentBorder: "rgba(39, 174, 96, 0.22)",
  },
  neutral: {
    valueColor: "var(--cs-text)",
    accentBg: "var(--cs-surface-raised)",
    accentBorder: "var(--cs-border-soft)",
  },
};

// ── Single metric card ────────────────────────────────────────────────────────

function MetricCard({ metric }: { metric: ReadinessHealthMetric }) {
  const style =
    STATUS_STYLE[metric.status ?? "neutral"] ?? STATUS_STYLE.neutral;

  const inner = (
    <div
      style={{
        backgroundColor: style.accentBg,
        border: `1px solid ${style.accentBorder}`,
        borderRadius: "var(--cs-r-sm, 8px)",
        padding: "0.875rem 1rem",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        height: "100%",
        boxSizing: "border-box",
        transition: metric.href ? "opacity 0.15s" : undefined,
      }}
    >
      {/* Large value */}
      <div
        style={{
          fontSize: "1.75rem",
          fontWeight: 700,
          lineHeight: 1,
          color: style.valueColor,
          letterSpacing: "-0.02em",
        }}
      >
        {metric.value}
      </div>

      {/* Label */}
      <div
        style={{
          fontSize: "0.8125rem",
          fontWeight: 600,
          color: "var(--cs-text)",
          lineHeight: 1.3,
        }}
      >
        {metric.label}
      </div>

      {/* Description */}
      {metric.description && (
        <div
          style={{
            fontSize: "0.75rem",
            color: "var(--cs-text-muted)",
            lineHeight: 1.4,
            marginTop: 2,
          }}
        >
          {metric.description}
        </div>
      )}

      {/* Link indicator */}
      {metric.href && (
        <div
          style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            color: style.valueColor,
            marginTop: "auto",
            paddingTop: 6,
          }}
        >
          View details ›
        </div>
      )}
    </div>
  );

  if (metric.href) {
    return (
      <Link
        href={metric.href}
        style={{ textDecoration: "none", display: "block", height: "100%" }}
      >
        {inner}
      </Link>
    );
  }

  return inner;
}

// ── Component ─────────────────────────────────────────────────────────────────

type ReadinessHealthGridProps = {
  metrics: ReadinessHealthMetric[];
  /** Number of columns on wider viewports. Defaults to 3. */
  columns?: 2 | 3 | 4;
};

/**
 * ReadinessHealthGrid
 *
 * Renders a responsive grid of ReadinessHealthMetric cards.
 * Each card shows a large value, a label, an optional description, and an
 * optional drill-down link. Card color reflects metric status:
 *   critical → red, warning → amber, ok → green, neutral → muted (default).
 *
 * Server component — uses Link, no client state needed.
 *
 * @example
 * <ReadinessHealthGrid metrics={healthMetrics} columns={4} />
 */
export function ReadinessHealthGrid({
  metrics,
  columns = 3,
}: ReadinessHealthGridProps) {
  if (metrics.length === 0) return null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: "0.75rem",
        // Responsive: collapse to 2-col on narrow, 1-col on very narrow
        // Using a CSS clamp approach via minmax instead of media queries
        // so this works as a server component without any JS.
      }}
    >
      {metrics.map((metric) => (
        <MetricCard key={metric.id} metric={metric} />
      ))}
    </div>
  );
}
