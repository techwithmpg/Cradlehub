"use client";

import React from "react";
import { formatPeso } from "@/lib/owner/reports";

export interface ProgressBarListItem {
  id: string;
  label: string;
  subLabel?: string;
  value: number;
  formattedValue?: string;
  percentage?: number;
  color?: string;
  badge?: string;
}

export interface ProgressBarListProps {
  items: ProgressBarListItem[];
  maxItems?: number;
  valueFormatter?: (val: number) => string;
  emptyMessage?: string;
  showRanking?: boolean;
}

export function ProgressBarList({
  items,
  maxItems,
  valueFormatter = formatPeso,
  emptyMessage = "No items to display",
  showRanking = false,
}: ProgressBarListProps) {
  const displayedItems = maxItems ? items.slice(0, maxItems) : items;

  if (displayedItems.length === 0) {
    return <div className="py-6 text-center text-xs text-stone-500">{emptyMessage}</div>;
  }

  // Calculate highest value for proportional bars
  const maxValue = Math.max(...displayedItems.map((i) => i.value), 1);

  return (
    <div className="space-y-3.5">
      {displayedItems.map((item, idx) => {
        const percent = item.percentage ?? Math.round((item.value / maxValue) * 100);
        const barWidth = Math.min(100, Math.max(3, (item.value / maxValue) * 100));
        const barColor = item.color ?? "#1B4D3E";

        return (
          <div key={item.id} className="group">
            <div className="flex items-center justify-between text-xs mb-1">
              <div className="flex items-center gap-2 min-w-0">
                {showRanking && (
                  <span className="font-mono text-[10px] font-semibold text-stone-600 w-4">
                    #{idx + 1}
                  </span>
                )}
                <span className="font-medium text-stone-800 truncate">{item.label}</span>
                {item.badge && (
                  <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-600">
                    {item.badge}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-semibold text-stone-900">
                  {item.formattedValue ?? valueFormatter(item.value)}
                </span>
                <span className="text-[10px] text-stone-600 font-mono w-9 text-right">
                  {percent}%
                </span>
              </div>
            </div>

            {/* Progress Bar Track */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${barWidth}%`,
                  backgroundColor: barColor,
                }}
              />
            </div>
            {item.subLabel && (
              <div className="mt-0.5 text-[10px] text-stone-600">{item.subLabel}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
