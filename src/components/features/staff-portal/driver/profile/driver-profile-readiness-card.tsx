import { ChevronRight } from "lucide-react";
import type { StaffPortalStaff } from "@/components/features/staff-portal/types";

type DriverProfileReadinessCardProps = {
  staff: StaffPortalStaff;
};

const WIDTH_BY_SCORE: Record<number, string> = {
  0: "w-0",
  25: "w-1/4",
  50: "w-1/2",
  75: "w-3/4",
  100: "w-full",
};

export function DriverProfileReadinessCard({ staff }: DriverProfileReadinessCardProps) {
  const checks = [
    { label: "Name", complete: staff.full_name.trim().length > 0 },
    { label: "Phone", complete: Boolean(staff.phone?.trim()) },
    { label: "Photo", complete: Boolean(staff.avatar_url) },
    { label: "Branch", complete: Boolean(staff.branch_id) },
  ];
  const completeCount = checks.filter((check) => check.complete).length;
  const score = completeCount * 25;
  const missing = checks.filter((check) => !check.complete).map((check) => check.label);
  const widthClass = WIDTH_BY_SCORE[score] ?? "w-0";

  return (
    <section className="rounded-3xl border border-stone-200/90 bg-white/95 p-4 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full border-[6px] border-emerald-100 bg-white">
          <span className="text-xl font-black text-emerald-950">{score}%</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-black text-stone-950">Profile readiness</h3>
            <ChevronRight className="h-5 w-5 shrink-0 text-stone-500" />
          </div>
          <p className="mt-1 text-sm font-medium text-stone-500">
            {score === 100 ? "Everything important is ready." : "Great job. You are almost complete."}
          </p>
          {missing.length > 0 ? (
            <p className="mt-1 text-sm font-bold text-amber-700">Missing: {missing.join(", ")}</p>
          ) : null}
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100">
            <div className={`${widthClass} h-full rounded-full bg-emerald-700`} />
          </div>
        </div>
      </div>
    </section>
  );
}
