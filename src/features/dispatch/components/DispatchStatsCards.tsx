import {
  AlertTriangle,
  CalendarCheck,
  CalendarDays,
  Car,
  CheckCircle2,
  Clock3,
  Star,
  UserRound,
  XCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DispatchStat, DispatchTone } from "../types";

const toneClasses: Record<DispatchTone, string> = {
  default: "bg-[var(--cs-surface-warm)] text-[var(--cs-text-muted)]",
  purple: "bg-[#f5f3ff] text-[#6d28d9]",
  blue: "bg-[#eff6ff] text-[#2563eb]",
  green: "bg-[#f0fdf4] text-[#16a34a]",
  amber: "bg-[#fffbeb] text-[#f59e0b]",
  red: "bg-[#fef2f2] text-[#dc2626]",
};

const fallbackIcons = [
  CalendarDays,
  Clock3,
  Car,
  CheckCircle2,
  AlertTriangle,
  UserRound,
  XCircle,
  Star,
] as const;

export function DispatchStatsCards({ stats }: { stats: DispatchStat[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat, index) => {
        const Icon = fallbackIcons[index % fallbackIcons.length] ?? CalendarCheck;
        const tone = stat.tone ?? "default";

        return (
          <Card
            key={stat.label}
            size="sm"
            className="min-h-[74px] rounded-[var(--cs-r-md)] border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] py-0 shadow-none ring-0"
          >
            <CardContent className="flex h-full items-center gap-3 px-3 py-3">
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-[var(--cs-r-md)]",
                  toneClasses[tone]
                )}
                aria-hidden="true"
              >
                {stat.icon ?? <Icon className="size-4" />}
              </div>
              <div className="min-w-0">
                <div className="truncate text-[11px] font-semibold leading-4 text-[var(--cs-text-muted)]">
                  {stat.label}
                </div>
                <div className="text-2xl font-bold leading-7 text-[var(--cs-text)]">
                  {stat.value}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
