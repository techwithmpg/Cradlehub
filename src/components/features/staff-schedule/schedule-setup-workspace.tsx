"use client";

import { CalendarClock, CalendarX2, Clock } from "lucide-react";
import type { ReactNode } from "react";
import { IndividualScheduleEditor } from "./individual-schedule-window-editor";
import { ScheduleOverridesView } from "./schedule-overrides-view";
import type { StaffScheduleItem } from "./staff-schedule-types";

type Props = {
  items: StaffScheduleItem[];
  branchId: string;
  onDataRefresh?: () => void;
};

function SectionLabel({
  icon,
  label,
}: {
  icon: ReactNode;
  label: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-2 text-sm font-black text-stone-950">
      <span className="grid size-8 place-items-center rounded-lg bg-white text-emerald-900 shadow-sm">
        {icon}
      </span>
      {label}
    </div>
  );
}

export function ScheduleSetupWorkspace({ items, branchId, onDataRefresh }: Props) {
  return (
    <div className="space-y-5 rounded-2xl bg-[#f8f4ee] p-4 md:p-5">
      <section>
        <SectionLabel icon={<CalendarClock className="size-4" />} label="Weekly Pattern" />
        <IndividualScheduleEditor
          branchId={branchId}
          branchName="Assigned branch"
          items={items}
          onDataRefresh={onDataRefresh}
        />
      </section>

      <section>
        <SectionLabel icon={<CalendarX2 className="size-4" />} label="One-Time Changes" />
        <SectionLabel icon={<Clock className="size-4" />} label="Blocked Time" />
        <ScheduleOverridesView items={items} />
      </section>
    </div>
  );
}
