"use client";

import type { ReactNode } from "react";
import { CrmStatCard, type CrmCardTone } from "@/components/features/crm/shared/crm-cards";
import { CountUpNumber } from "./count-up-number";

function inferTone(color?: string): CrmCardTone {
  if (!color) return "neutral";
  const lower = color.toLowerCase();
  if (lower.includes("success") || lower.includes("#1f4e33") || lower.includes("#16a34a")) return "success";
  if (lower.includes("error") || lower.includes("danger") || lower.includes("#dc2626")) return "danger";
  if (lower.includes("warning") || lower.includes("sand") || lower.includes("#d97706")) return "warning";
  if (lower.includes("info") || lower.includes("#2563eb")) return "info";
  return "neutral";
}

export function CrmMetricCard({
  label,
  value,
  prefix = "",
  suffix = "",
  color = "var(--cs-text)",
  icon,
  trend,
  href,
  onClick,
  tone,
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  color?: string;
  icon?: ReactNode;
  trend?: string;
  href?: string;
  onClick?: () => void;
  tone?: CrmCardTone;
}) {
  return (
    <CrmStatCard
      title={label}
      value={<CountUpNumber value={value} prefix={prefix} suffix={suffix} />}
      subtitle={trend}
      icon={icon}
      tone={tone ?? inferTone(color)}
      href={href}
      onClick={onClick}
    />
  );
}
