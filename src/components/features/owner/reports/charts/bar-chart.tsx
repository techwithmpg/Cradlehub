"use client";

import React, { useState } from "react";
import { formatPesoCompact } from "@/lib/owner/reports";

export interface BarChartItem {
  label: string;
  value: number;
  secondaryValue?: number;
  subLabel?: string;
}

export interface BarChartProps {
  data: BarChartItem[];
  height?: number;
  color?: string;
  secondaryColor?: string;
  valueFormatter?: (val: number) => string;
  emptyMessage?: string;
  ariaLabel?: string;
}

export function BarChart({
  data,
  height = 200,
  color = "#1B4D3E", // Brand forest green
  secondaryColor = "#D4A373", // Brand warm gold
  valueFormatter = (v) => v.toLocaleString(),
  emptyMessage = "No data available",
  ariaLabel = "Bar chart",
}: BarChartProps) {
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

  // Calculate maximum value
  let maxValue = 0;
  for (const item of data) {
    const val = item.value + (item.secondaryValue ?? 0);
    if (val > maxValue) maxValue = val;
  }
  const effectiveMax = maxValue === 0 ? 10 : Math.ceil(maxValue * 1.15);

  const padding = { top: 20, right: 16, bottom: 28, left: 40 };
  const chartWidth = 500;
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const barCount = data.length;
  const barSlotWidth = innerWidth / barCount;
  const barWidth = Math.max(8, Math.min(28, barSlotWidth * 0.6));

  const yTicks = [0, Math.round(effectiveMax * 0.5), effectiveMax];

  const hoveredItem = hoveredIndex !== null ? data[hoveredIndex] : null;

  return (
    <div className="relative w-full select-none" role="img" aria-label={ariaLabel}>
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${chartWidth} ${height}`}
          className="w-full overflow-visible"
          style={{ height }}
          preserveAspectRatio="none"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          {/* Grid lines */}
          {yTicks.map((tick, i) => {
            const ratio = tick / effectiveMax;
            const y = padding.top + innerHeight - ratio * innerHeight;
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
                  x={padding.left - 6}
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

          {/* Bars */}
          {data.map((item, i) => {
            const slotCenter = padding.left + (i + 0.5) * barSlotWidth;
            const barX = slotCenter - barWidth / 2;

            const primaryHeight = Math.max(0, (item.value / effectiveMax) * innerHeight);
            const secondaryHeight = Math.max(
              0,
              ((item.secondaryValue ?? 0) / effectiveMax) * innerHeight
            );

            const primaryY = padding.top + innerHeight - primaryHeight;
            const secondaryY = primaryY - secondaryHeight;

            const isHovered = hoveredIndex === i;

            return (
              <g key={i}>
                {/* Secondary (stacked) bar if present */}
                {secondaryHeight > 0 && (
                  <rect
                    x={barX}
                    y={secondaryY}
                    width={barWidth}
                    height={secondaryHeight}
                    rx="3"
                    ry="3"
                    fill={secondaryColor}
                    opacity={isHovered ? 0.9 : 0.75}
                  />
                )}

                {/* Primary bar */}
                <rect
                  x={barX}
                  y={primaryY}
                  width={barWidth}
                  height={primaryHeight}
                  rx="3"
                  ry="3"
                  fill={color}
                  opacity={isHovered ? 1 : 0.85}
                  className="transition-all duration-150"
                />

                {/* X-axis label */}
                <text
                  x={slotCenter}
                  y={height - 8}
                  textAnchor="middle"
                  fontSize="10"
                  fill={isHovered ? "#111827" : "#6B7280"}
                  className="font-mono"
                >
                  {item.label}
                </text>

                {/* Hit area for hovering */}
                <rect
                  x={padding.left + i * barSlotWidth}
                  y={padding.top}
                  width={barSlotWidth}
                  height={innerHeight}
                  fill="transparent"
                  onMouseEnter={() => setHoveredIndex(i)}
                  className="cursor-pointer"
                />
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip */}
        {hoveredItem && hoveredIndex !== null && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-stone-200 bg-white/95 px-2.5 py-1.5 text-xs shadow-md backdrop-blur-sm"
            style={{
              left: `${((padding.left + (hoveredIndex + 0.5) * barSlotWidth) / chartWidth) * 100}%`,
              top: "10px",
            }}
          >
            <div className="font-semibold text-stone-800">{hoveredItem.label}</div>
            {hoveredItem.subLabel && (
              <div className="text-[10px] text-stone-500">{hoveredItem.subLabel}</div>
            )}
            <div className="mt-0.5 font-bold text-emerald-800">
              {valueFormatter(hoveredItem.value)}
            </div>
            {hoveredItem.secondaryValue !== undefined && hoveredItem.secondaryValue > 0 && (
              <div className="text-[10px] text-amber-700">
                + {valueFormatter(hoveredItem.secondaryValue)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
