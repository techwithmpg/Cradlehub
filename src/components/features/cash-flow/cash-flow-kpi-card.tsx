'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { CrmStatCard, type CrmCardTone } from '@/components/features/crm/shared/crm-cards';

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
  tone?: CrmCardTone;
}

function inferCashFlowTone(iconBgClass: string, dotColorClass?: string): CrmCardTone {
  const hint = `${iconBgClass} ${dotColorClass ?? ''}`.toLowerCase();
  if (hint.includes('rose') || hint.includes('red')) return 'danger';
  if (hint.includes('teal') || hint.includes('blue') || hint.includes('sky')) return 'info';
  if (hint.includes('amber') || hint.includes('orange') || hint.includes('yellow')) return 'warning';
  if (hint.includes('emerald') || hint.includes('green')) return 'success';
  return 'neutral';
}

export function CashFlowKpiCard({
  icon: Icon,
  iconBgClass,
  dotColorClass,
  label,
  value,
  trendText,
  description,
  tone,
}: CashFlowKpiCardProps) {
  const resolvedTone = tone ?? inferCashFlowTone(iconBgClass, dotColorClass);

  return (
    <CrmStatCard
      title={label}
      value={value}
      subtitle={description ?? trendText ?? undefined}
      icon={<Icon className="size-4.5" aria-hidden="true" />}
      tone={resolvedTone}
      className="h-full"
    />
  );
}
