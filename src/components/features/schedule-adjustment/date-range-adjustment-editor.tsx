"use client";

import type { StaffScheduleItem } from "@/components/features/staff-schedule/staff-schedule-types";
import { DayOverridesEditorTab } from "@/components/features/crm/schedule/day-overrides-editor-tab";

type DateRangeAdjustmentEditorProps = {
  item: StaffScheduleItem;
  branchId: string;
  onDirtyChange: (dirty: boolean) => void;
  onChanged: (message: string) => void;
};

export function DateRangeAdjustmentEditor({
  item,
  branchId,
  onDirtyChange,
  onChanged,
}: DateRangeAdjustmentEditorProps) {
  return (
    <section className="rounded-lg border border-[#e3dccf] bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-[#181713]">Specific Date / Range</h3>
        <p className="mt-1 text-xs text-[#615c52]">
          Use schedule overrides for one-off day-off records or custom hours. The current persistence model saves one
          date at a time.
        </p>
      </div>
      <DayOverridesEditorTab
        staffId={item.staff.id}
        branchId={branchId}
        overrides={item.overrides}
        onDirtyChange={onDirtyChange}
        onChanged={onChanged}
      />
    </section>
  );
}
