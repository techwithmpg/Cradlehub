"use client";

import React, { useState, useId } from "react";
import { formatPesoCompact, formatPeso } from "@/lib/owner/reports";

export interface LineChartSeries {
  key: string;
  name: string;
  color: string;
  strokeWidth?: number;
}

export interface LineChartProps {
  data: Array<{ date: string; [key: string]: string | number | undefined }>;
  series: LineChartSeries[];
  height?: number;
  valueFormatter?: (val: number) => string;
  emptyMessage?: string;
  ariaLabel?: string;
}

export function LineChart({
  data,
  series,
  height = 240,
  valueFormatter = formatPeso,
  emptyMessage = "No activity recorded in this period",
  ariaLabel = "Time-series line chart",
}: LineChartProps) {
  const chartId = useId();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-stone-200 bg-stone-50/50 text-sm text-stone-500"
        style={{ height }}
      >
        {emptyMessage}
      </div>
    );
  }

  // Find max value across all series
  let maxValue = 0;
  for (const d of data) {
    for (const s of series) {
      const val = Number(d[s.key] ?? 0);
      if (val > maxValue) maxValue = val;
    }
  }

  // Handle all 0 values
  const effectiveMax = maxValue === 0 ? 100 : Math.ceil(maxValue * 1.15);

  const padding = { top: 20, right: 24, bottom: 32, left: 56 };
  const chartWidth = 600;
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  // Compute points for each series
  const getX = (idx: number) => {
    if (data.length <= 1) return padding.left + innerWidth / 2;
    return padding.left + (idx / (data.length - 1)) * innerWidth;
  };

  const getY = (val: number) => {
    const ratio = Math.max(0, Math.min(1, val / effectiveMax));
    return padding.top + innerHeight - ratio * innerHeight;
  };

  // Generate 4 Y-axis tick values
  const yTicks = [
    0,
    Math.round(effectiveMax * 0.33),
    Math.round(effectiveMax * 0.66),
    effectiveMax,
  ];

  // Pick X-axis ticks (up to 6 dates)
  const xTickIndices: number[] = [];
  if (data.length <= 6) {
    for (let i = 0; i < data.length; i++) xTickIndices.push(i);
  } else {
    const step = (data.length - 1) / 5;
    for (let i = 0; i < 6; i++) {
      xTickIndices.push(Math.round(i * step));
    }
  }

  const hoveredData = hoveredIndex !== null ? data[hoveredIndex] : null;

  return (
    <div className="relative w-full select-none" role="img" aria-label={ariaLabel}>
      {/* Legend */}
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs">
        {series.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <span className="font-medium text-stone-600">{s.name}</span>
          </div>
        ))}
      </div>

      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${chartWidth} ${height}`}
          className="w-full overflow-visible"
          style={{ height }}
          preserveAspectRatio="none"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <defs>
            {series.map((s) => (
              <linearGradient
                key={s.key}
                id={`${chartId}-grad-${s.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={s.color} stopOpacity="0.25" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0.0" />
              </linearGradient>
            ))}
          </defs>

          {/* Grid lines */}
          {yTicks.map((tick, i) => {
            const y = getY(tick);
            return (
              <g key={i}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={chartWidth - padding.right}
                  y2={y}
                  stroke="#E5E7EB"
                  strokeDasharray={i === 0 ? "none" : "3 3"}
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="10"
                  fill="#9CA3AF"
                  className="font-mono"
                >
                  {formatPesoCompact(tick)}
                </text>
              </g>
            );
          })}

          {/* X-axis labels */}
          {xTickIndices.map((idx) => {
            const d = data[idx];
            if (!d) return null;
            const x = getX(idx);
            // Format short date (e.g. Oct 4)
            const dateStr = d.date;
            const parts = dateStr.split("-");
            const label = parts.length === 3 ? `${Number(parts[1])}/${Number(parts[2])}` : dateStr;

            return (
              <text
                key={idx}
                x={x}
                y={height - 8}
                textAnchor="middle"
                fontSize="10"
                fill="#9CA3AF"
                className="font-mono"
              >
                {label}
              </text>
            );
          })}

          {/* Series Areas & Lines */}
          {series.map((s) => {
            if (data.length === 0) return null;

            // Build path
            const points = data.map((d, i) => ({
              x: getX(i),
              y: getY(Number(d[s.key] ?? 0)),
            }));

            const lineD = points.reduce((acc, p, i) => {
              return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
            }, "");

            const firstPoint = points[0];
            const lastPoint = points[points.length - 1];
            if (!firstPoint || !lastPoint) return null;

            const areaD = `${lineD} L ${lastPoint.x} ${
              padding.top + innerHeight
            } L ${firstPoint.x} ${padding.top + innerHeight} Z`;

            return (
              <g key={s.key}>
                <path d={areaD} fill={`url(#${chartId}-grad-${s.key})`} />
                <path
                  d={lineD}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={s.strokeWidth ?? 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            );
          })}

          {/* Hover guideline and dots */}
          {hoveredIndex !== null && (
            <g>
              <line
                x1={getX(hoveredIndex)}
                y1={padding.top}
                x2={getX(hoveredIndex)}
                y2={padding.top + innerHeight}
                stroke="#6B7280"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              {series.map((s) => {
                const val = Number(data[hoveredIndex]?.[s.key] ?? 0);
                return (
                  <circle
                    key={s.key}
                    cx={getX(hoveredIndex)}
                    cy={getY(val)}
                    r="4"
                    fill="#FFFFFF"
                    stroke={s.color}
                    strokeWidth="2"
                  />
                );
              })}
            </g>
          )}

          {/* Interactive hit areas */}
          {data.map((_, i) => {
            const x = getX(i);
            const w = innerWidth / Math.max(1, data.length);
            return (
              <rect
                key={i}
                x={x - w / 2}
                y={padding.top}
                width={w}
                height={innerHeight}
                fill="transparent"
                onMouseEnter={() => setHoveredIndex(i)}
                className="cursor-pointer"
              />
            );
          })}
        </svg>

        {/* Floating Tooltip */}
        {hoveredData && hoveredIndex !== null && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-stone-200 bg-white/95 px-3 py-2 text-xs shadow-md backdrop-blur-sm"
            style={{
              left: `${(getX(hoveredIndex) / chartWidth) * 100}%`,
              top: "12px",
            }}
          >
            <div className="font-semibold text-stone-800">{hoveredData.date}</div>
            <div className="mt-1 space-y-0.5">
              {series.map((s) => (
                <div key={s.key} className="flex items-center justify-between gap-3 text-stone-600">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    <span>{s.name}:</span>
                  </div>
                  <span className="font-semibold text-stone-900">
                    {valueFormatter(Number(hoveredData[s.key] ?? 0))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
