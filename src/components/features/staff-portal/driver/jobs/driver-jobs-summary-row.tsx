import type { DriverJobsSummary } from "./driver-jobs-view-model";
import { cn } from "@/lib/utils";

type DriverJobsSummaryRowProps = {
  summary: DriverJobsSummary;
};

const SUMMARY_ITEMS: { key: keyof DriverJobsSummary; label: string }[] = [
  { key: "total", label: "Total" },
  { key: "completed", label: "Completed" },
  { key: "inProgress", label: "In Progress" },
  { key: "upcoming", label: "Upcoming" },
];

export function DriverJobsSummaryRow({ summary }: DriverJobsSummaryRowProps) {
  return (
    <section className="grid grid-cols-4 rounded-[1.75rem] border border-stone-200 bg-white/78 px-2 py-5 shadow-sm">
      {SUMMARY_ITEMS.map((item, index) => (
        <div
          key={item.key}
          className={cn(
            "min-w-0 border-stone-200 px-2 text-center",
            index > 0 && "border-l"
          )}
        >
          <div className="text-[30px] font-black leading-none text-emerald-950">
            {summary[item.key]}
          </div>
          <div className="mt-2 truncate text-sm font-semibold text-stone-500">
            {item.label}
          </div>
        </div>
      ))}
    </section>
  );
}
