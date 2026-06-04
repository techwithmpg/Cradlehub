import { Bell } from "lucide-react";

type DriverJobsHeaderProps = {
  notificationCount?: number;
};

export function DriverJobsHeader({ notificationCount = 0 }: DriverJobsHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-4 pt-[calc(1.25rem+env(safe-area-inset-top))]">
      <div>
        <h1 className="text-[42px] font-black leading-none tracking-normal text-emerald-950">
          Jobs
        </h1>
        <p className="mt-2 text-sm font-semibold text-stone-500">
          Today&apos;s assigned jobs
        </p>
      </div>
      <button
        type="button"
        aria-label={
          notificationCount > 0
            ? `${notificationCount} job notifications`
            : "Job notifications"
        }
        className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full border border-stone-200 bg-white/80 text-stone-900 shadow-sm active:scale-95"
      >
        <Bell className="h-5 w-5" />
        {notificationCount > 0 ? (
          <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-emerald-700 ring-2 ring-white" />
        ) : null}
      </button>
    </header>
  );
}
