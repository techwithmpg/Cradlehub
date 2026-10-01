'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface CashFlowKpiCardProps {
  icon: LucideIcon;
  iconBgClass: string;
  iconColorClass: string;
  dotColorClass?: string;
  label: string;
  value: string;
  trendText?: string | null;
  trendColorClass?: string;
  description?: string | null;
}

export function CashFlowKpiCard({
  icon: Icon,
  iconBgClass,
  iconColorClass,
  dotColorClass,
  label,
  value,
  trendText,
  trendColorClass = 'text-emerald-700',
  description,
}: CashFlowKpiCardProps) {
  return (
    <div className="bg-white rounded-xl border border-[#EAE4DC] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex flex-col justify-between transition-all hover:border-[#D4C8BC]">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-lg ${iconBgClass}`}>
          <Icon className={`w-4 h-4 ${iconColorClass}`} />
        </div>
        {dotColorClass && (
          <span className={`w-2 h-2 rounded-full ${dotColorClass}`} />
        )}
      </div>

      <div>
        <p className="text-[10px] font-bold tracking-wider text-[#9C8878] uppercase mb-0.5">
          {label}
        </p>
        <div className="text-2xl font-bold tracking-tight text-[#1E1916] tabular-nums font-sans">
          {value}
        </div>

        {trendText && (
          <p className={`text-[11px] font-medium mt-0.5 ${trendColorClass}`}>
            {trendText}
          </p>
        )}

        {description && (
          <p className="text-[11px] text-[#9C8878] mt-1 line-clamp-1">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
