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
  onEditStaffProfile: () => void;
  onEditStaffCapabilities: () => void;
  onViewFullSchedule: () => void;
  onAddBooking: () => void;
  onCheckAvailability: () => void;
  onAdjustStaff: () => void;
  onBlockStaffTime: () => void;
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
        onEditProfile={props.onEditStaffProfile}
        onEditCapabilities={props.onEditStaffCapabilities}
        onViewFullSchedule={props.onViewFullSchedule}
      />
      <DailyTimelineActionsCard
        onAddBooking={props.onAddBooking}
        onCheckAvailability={props.onCheckAvailability}
        onAdjustStaff={props.onAdjustStaff}
        onBlockStaffTime={props.onBlockStaffTime}
      />
      <DailyTimelineAvailableCard rows={props.rows} date={props.date} now={props.now} onStaffSelect={props.onStaffSelect} />
    </aside>
  );
}
