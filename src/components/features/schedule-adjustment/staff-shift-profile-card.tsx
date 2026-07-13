"use client";

import { Moon, ShieldCheck } from "lucide-react";
import type { AdjustScheduleStaffItem, ScheduleShiftKind, ScheduleValidationIssue } from "./adjust-schedule-types";
import { formatDuration, getShiftLabel } from "./adjust-schedule-utils";

type StaffShiftProfileCardProps = {
  item: AdjustScheduleStaffItem;
  allowedShiftKinds: ScheduleShiftKind[];
  weeklyMinutes: number;
  workingDays: number;
  issues: ScheduleValidationIssue[];
};

const DOT_CLASS: Record<ScheduleShiftKind, string> = {
  opening: "bg-[#0f7a4c]",
  regular: "bg-[#2563eb]",
  closing: "bg-[#9b4cc2]",
};

export function StaffShiftProfileCard({
  allowedShiftKinds,
  weeklyMinutes,
  workingDays,
  issues,
}: StaffShiftProfileCardProps) {
  const blockingCount = issues.filter((issue) => issue.level === "error").length;

  return (
    <section className="rounded-lg border border-[#e3dccf] bg-white p-4 shadow-sm">
      <h3 className="text-[0.68rem] font-bold uppercase text-[#615c52]">Staff Shift Profile</h3>
      <div className="mt-4 space-y-4 text-xs">
        <div>
          <p className="font-semibold text-[#181713]">Permitted Shift Types</p>
          <div className="mt-2 space-y-2">
            {allowedShiftKinds.map((kind) => (
              <div key={kind} className="flex items-center gap-2 text-[#4b463d]">
                <span className={`size-2.5 rounded-full ${DOT_CLASS[kind]}`} />
                {getShiftLabel(kind)}
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-[#eee8dc] pt-3">
          <p className="font-semibold text-[#181713]">Configured Weekly Hours</p>
          <p className="mt-1 text-[#615c52]">{formatDuration(weeklyMinutes)}</p>
        </div>
        <div className="border-t border-[#eee8dc] pt-3">
          <p className="font-semibold text-[#181713]">Working Days</p>
          <p className="mt-1 text-[#615c52]">{workingDays} configured day{workingDays === 1 ? "" : "s"}</p>
        </div>
        <div className="border-t border-[#eee8dc] pt-3">
          <p className="font-semibold text-[#181713]">Breaks</p>
          <p className="mt-1 text-[#615c52]">No configured unpaid-break rule.</p>
        </div>
        <div className="border-t border-[#eee8dc] pt-3">
          <p className="flex items-center gap-2 font-semibold text-[#181713]">
            <Moon className="size-3.5 text-[#7c3c9c]" />
            Overnight Support
          </p>
          <p className="mt-1 text-[#615c52]">Supported when Ends next day is explicit.</p>
        </div>
        <div className="border-t border-[#eee8dc] pt-3">
          <p className="flex items-center gap-2 font-semibold text-[#181713]">
            <ShieldCheck className="size-3.5 text-[#0f6b43]" />
            Validation
          </p>
          <p className="mt-1 text-[#615c52]">
            {blockingCount > 0 ? `${blockingCount} blocking issue${blockingCount === 1 ? "" : "s"}` : "No blocking issues"}
          </p>
        </div>
      </div>
    </section>
  );
}
