"use client";

import React, { useState } from "react";
import { formatPeso } from "@/lib/owner/reports";

export interface DonutChartItem {
  label: string;
  value: number;
  color: string;
  subLabel?: string;
}

export interface DonutChartProps {
  data: DonutChartItem[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string;
  valueFormatter?: (val: number) => string;
  emptyMessage?: string;
  ariaLabel?: string;
}

export function DonutChart({
  data,
  size = 180,
  strokeWidth = 24,
  centerLabel,
  centerValue,
  valueFormatter = formatPeso,
  emptyMessage = "No distribution data",
  ariaLabel = "Donut chart distribution",
}: DonutChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total <= 0 || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-stone-200 bg-stone-50/50 p-6 text-sm text-stone-500"
        style={{ minHeight: size }}
      >
        {emptyMessage}
      </div>
    );
  }

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const segments = data.map((item, idx) => {
    const percent = item.value / total;
    const priorPercent = data.slice(0, idx).reduce((sum, prev) => sum + prev.value / total, 0);
    const strokeDasharray = `${percent * circumference} ${circumference}`;
    const strokeDashoffset = -priorPercent * circumference;

    return {
      ...item,
      percent,
      strokeDasharray,
      strokeDashoffset,
      index: idx,
    };
  });

  return (
    <div
      className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-around"
      role="img"
      aria-label={ariaLabel}
    >
      {/* SVG Donut */}
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="-rotate-90 overflow-visible"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          {/* Background circle track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke="#F3F4F6"
            strokeWidth={strokeWidth}
          />

          {/* Slices */}
          {segments.map((s) => {
            const isHovered = hoveredIndex === s.index;
            return (
              <circle
                key={s.label}
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke={s.color}
                strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={s.strokeDasharray}
                strokeDashoffset={s.strokeDashoffset}
                strokeLinecap="round"
                className="cursor-pointer transition-all duration-150"
                onMouseEnter={() => setHoveredIndex(s.index)}
              />
            );
          })}
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
          {centerLabel && (
            <span className="text-[11px] font-medium uppercase tracking-wider text-stone-500">
              {centerLabel}
            </span>
          )}
          <span className="text-sm font-bold text-stone-900 line-clamp-1">
            {centerValue ?? formatPeso(total)}
          </span>
        </div>
      </div>

      {/* Legend list */}
      <div className="flex flex-col gap-2.5 w-full max-w-[240px]">
        {data.map((item, idx) => {
          const percent = Math.round((item.value / total) * 100);
          const isHovered = hoveredIndex === idx;

          return (
            <div
              key={item.label}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              className={`flex items-center justify-between rounded-lg px-2 py-1 transition-colors cursor-pointer ${
                isHovered ? "bg-stone-100" : "hover:bg-stone-50"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <div className="truncate">
                  <span className="text-xs font-medium text-stone-800">{item.label}</span>
                  {item.subLabel && (
                    <span className="block text-[10px] text-stone-500">{item.subLabel}</span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0 pl-2">
                <span className="text-xs font-semibold text-stone-900">
                  {valueFormatter(item.value)}
                </span>
                <span className="ml-1.5 text-[10px] font-medium text-stone-500">({percent}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
