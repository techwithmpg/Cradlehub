import type { DailyScheduleBooking, DailyScheduleStaffRow } from "@/lib/queries/schedule";
import type { DailyTimelineAlert } from "./daily-timeline-alerts";
import { DailyTimelineActionsCard } from "./daily-timeline-actions-card";
import { DailyTimelineAvailableCard } from "./daily-timeline-available-card";
import { DailyTimelineCoverageCard } from "./daily-timeline-coverage-card";
import { DailyTimelineSelectionCard } from "./daily-timeline-selection-card";

type Props = {
  rows: DailyScheduleStaffRow[];
  alerts: DailyTimelineAlert[];
  groupLabel: string;
  selectedStaff: DailyScheduleStaffRow | null;
  selectedBooking: DailyScheduleBooking | null;
  selectedStaffType: string | null;
  date: string;
  now: Date | null;
  onStaffSelect: (staffId: string) => void;
};

export function DailyTimelineOperationsRail(props: Props) {
  return (
    <aside className="space-y-3 xl:sticky xl:top-3 xl:self-start">
      <DailyTimelineCoverageCard rows={props.rows} alerts={props.alerts} groupLabel={props.groupLabel} />
      <DailyTimelineSelectionCard
        staff={props.selectedStaff}
        booking={props.selectedBooking}
        staffType={props.selectedStaffType}
        date={props.date}
        now={props.now}
      />
      <DailyTimelineActionsCard />
      <DailyTimelineAvailableCard rows={props.rows} date={props.date} now={props.now} onStaffSelect={props.onStaffSelect} />
    </aside>
  );
}
