"use client";

import type { StaffScheduleItem } from "@/components/features/staff-schedule/staff-schedule-types";
import { BlockTimeEditorTab } from "@/components/features/crm/schedule/block-time-editor-tab";

type UnavailableTimeEditorProps = {
  item: StaffScheduleItem;
  branchId: string;
  initialDate?: string;
  onDirtyChange: (dirty: boolean) => void;
  onChanged: (message: string) => void;
};

export function UnavailableTimeEditor({
  item,
  branchId,
  initialDate,
  onDirtyChange,
  onChanged,
}: UnavailableTimeEditorProps) {
  return (
    <section className="rounded-lg border border-[#e3dccf] bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-[#181713]">Unavailable Time</h3>
        <p className="mt-1 text-xs text-[#615c52]">
          Block booking availability within working hours. Full-day absence should be recorded as a day-off override.
        </p>
      </div>
      <BlockTimeEditorTab
        staffId={item.staff.id}
        branchId={branchId}
        blockedTimes={item.blockedTimes}
        initialDate={initialDate}
        initiallyShowForm={Boolean(initialDate)}
        onDirtyChange={onDirtyChange}
        onChanged={onChanged}
      />
    </section>
  );
}
