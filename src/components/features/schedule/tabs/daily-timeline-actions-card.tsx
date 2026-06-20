import Link from "next/link";
import { CalendarPlus, CalendarX2, Search, Settings2, SlidersHorizontal, Zap } from "lucide-react";

const ACTIONS = [
  { label: "Add Booking", href: "/crm/bookings/new", icon: CalendarPlus },
  { label: "Block Staff Time", href: "/crm/staff-availability?tab=individual", icon: CalendarX2 },
  { label: "Check Availability", href: "/crm/availability", icon: Search },
  { label: "Individual Adjustments", href: "/crm/staff-availability?tab=individual", icon: SlidersHorizontal },
  { label: "Open Overrides", href: "/crm/staff-availability?tab=overrides", icon: Settings2 },
];

export function DailyTimelineActionsCard() {
  return (
    <section className="rounded-lg border border-[var(--cs-border)] bg-white p-4 shadow-sm">
      <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--cs-text)]">
        <Zap className="size-4 text-amber-600" />
        Quick Actions
      </h3>
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.label}
              href={action.href}
              className="flex min-h-9 items-center gap-2 rounded-md px-2 text-[10px] font-medium text-[var(--cs-text-secondary)] hover:bg-stone-50 hover:text-emerald-800"
            >
              <Icon className="size-3.5 shrink-0" />
              <span>{action.label}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
