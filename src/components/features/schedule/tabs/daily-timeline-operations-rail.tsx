import type { DailyScheduleBooking, DailyScheduleStaffRow } from "@/lib/queries/schedule";
import type { LiveScheduleConflict } from "@/lib/schedule/live-schedule-conflict-types";
import { DailyTimelineActionsCard } from "./daily-timeline-actions-card";
import { DailyTimelineAvailableCard } from "./daily-timeline-available-card";
import { DailyTimelineCoverageCard } from "./daily-timeline-coverage-card";
import { DailyTimelineSelectionCard } from "./daily-timeline-selection-card";

type Props = {
  rows: DailyScheduleStaffRow[];
  conflicts: LiveScheduleConflict[];
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
  onAdjustSchedule: () => void;
  onAddBooking: () => void;
  onCheckAvailability: () => void;
  onAdjustStaff: () => void;
  onBlockStaffTime: () => void;
  onViewConflictDetails: () => void;
};

export function DailyTimelineOperationsRail(props: Props) {
  return (
    <aside className="space-y-3 xl:sticky xl:top-3 xl:self-start">
      <DailyTimelineCoverageCard
        rows={props.rows}
        conflicts={props.conflicts}
        groupLabel={props.groupLabel}
        onViewConflictDetails={props.onViewConflictDetails}
      />
      <DailyTimelineSelectionCard
        staff={props.selectedStaff}
        booking={props.selectedBooking}
        staffType={props.selectedStaffType}
        date={props.date}
        now={props.now}
        onEditProfile={props.onEditStaffProfile}
        onEditCapabilities={props.onEditStaffCapabilities}
        onViewFullSchedule={props.onViewFullSchedule}
        onAdjustSchedule={props.onAdjustSchedule}
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
