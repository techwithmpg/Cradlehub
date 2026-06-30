import { CalendarPlus, CalendarX2, Search, SlidersHorizontal, Zap } from "lucide-react";

type Props = {
  onAddBooking: () => void;
  onCheckAvailability: () => void;
  onAdjustStaff: () => void;
  onBlockStaffTime: () => void;
};

export function DailyTimelineActionsCard({
  onAddBooking,
  onCheckAvailability,
  onAdjustStaff,
  onBlockStaffTime,
}: Props) {
  const actions = [
    { label: "Add Booking", onClick: onAddBooking, icon: CalendarPlus },
    { label: "Check Availability", onClick: onCheckAvailability, icon: Search },
    { label: "Adjust Staff", onClick: onAdjustStaff, icon: SlidersHorizontal },
    { label: "Block Staff Time", onClick: onBlockStaffTime, icon: CalendarX2 },
  ];

  return (
    <section className="rounded-lg border border-[var(--cs-border)] bg-white p-4 shadow-sm">
      <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--cs-text)]">
        <Zap className="size-4 text-amber-600" />
        Quick Actions
      </h3>
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className="flex min-h-9 items-center gap-2 rounded-md px-2 text-left text-[10px] font-medium text-[var(--cs-text-secondary)] transition hover:bg-stone-50 hover:text-emerald-800"
            >
              <Icon className="size-3.5 shrink-0" />
              <span>{action.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
