import Link from "next/link";
import { ArrowRight, ChevronRight, Clock3, MapPinned, QrCode, Route } from "lucide-react";
import {
  StaffCard, StaffEmptyState, StaffScreen,
} from "@/components/features/staff-pwa/native-foundation";
import { StaffSnapshotRecorder } from "@/components/features/staff-pwa/safe-memory";
import { DriverTripRow } from "./driver-trip-row";
import { DriverTripAlerts } from "./driver-trip-alerts";
import {
  getDriverPrimaryTrip, getDriverProgressLabel, getDriverTripSummary,
  isDriverTripClosed,
} from "@/lib/staff-pwa/driver-ui-model";
import { formatTime12h } from "@/lib/utils/time-format";
import type { StaffPortalStaff } from "@/components/features/staff-portal/types";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";
import type { StaffAttendanceData } from "@/lib/staff-portal/attendance";
import { StaffAttendanceClockOut } from "@/components/features/staff-portal/staff-attendance-clock-out";

/**
 * Trips are the sole primary task. Attendance remains reachable under a
 * separate collapsed shift section; never use its QR scan as a trip action.
 */
export function DriverNativeHome({
  staff, items, businessDate, attendanceData,
}: {
  staff: StaffPortalStaff;
  items: RealDispatchItem[];
  businessDate: string;
  attendanceData: StaffAttendanceData | null;
}) {
  const name = staff.nickname?.trim() || staff.full_name?.trim() || "Driver";
  const summary = getDriverTripSummary(items);
  const primary = getDriverPrimaryTrip(items);
  const later = items.filter(item => item.id !== primary?.id && !isDriverTripClosed(item))
    .sort((a, b) => `${a.bookingDate}T${a.startTime}`.localeCompare(`${b.bookingDate}T${b.startTime}`));

  return (
    <StaffScreen>
      <StaffSnapshotRecorder snapshot={{
        screen: "driverToday", label: "Driver today",
        counts: [
          { label: "Today", value: summary.today },
          { label: "Completed", value: summary.completed },
          { label: "Remaining", value: summary.remaining },
        ],
      }} />
      <header className="rounded-[24px] bg-[linear-gradient(145deg,#174332,#092c20)] px-5 py-6 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#e3d09f]">CradleHub Driver</p>
        <h1 className="mt-2 text-2xl font-bold">Your next trip</h1>
        <p className="mt-1 text-sm text-white/80">Hello, {name.split(" ")[0]}. Your route is ready when you are.</p>
      </header>

      <DriverTripAlerts />

      {primary ? (
        <StaffCard className="mt-4 rounded-3xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#76501a]">
            {primary.bookingProgressStatus === "travel_started" ? "En route" : "Assigned trip"}
          </p>
          <h2 className="mt-2 text-xl font-bold text-[#163a2b]">{primary.customerName}</h2>
          <p className="mt-1 text-sm text-[#65746b]">{primary.serviceName}</p>
          <div className="mt-4 space-y-3 text-sm text-[#526358]">
            <p className="flex items-center gap-2">
              <Clock3 size={18} aria-hidden="true" /> {formatTime12h(primary.startTime)}
            </p>
            <p className="flex items-start gap-2">
              <MapPinned size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{primary.formattedAddress ?? primary.area ?? "Destination pending"}</span>
            </p>
          </div>
          <Link href={`/staff/driver/map?bookingId=${encodeURIComponent(primary.id)}`}
            className="mt-6 flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-[#0d6548] px-4 text-lg font-bold text-white">
            <Route size={23} aria-hidden="true" />
            {primary.bookingProgressStatus === "travel_started" ? "View active route" : "View route"}
            <ArrowRight size={20} aria-hidden="true" />
          </Link>
          <p className="mt-3 text-center text-xs text-[#68776d]">
            {getDriverProgressLabel(primary)} · Start trip on the route screen
          </p>
        </StaffCard>
      ) : (
        <div className="mt-4">
          <StaffEmptyState icon={<Route size={20} />}
            title="No assigned trips" description="New Home Service assignments will appear here." />
        </div>
      )}

      {later.length ? (
        <section className="mt-6" aria-label="Later trips">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#163a2b]">After this trip</h2>
            <Link href="/staff/driver/trips" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[#19563c]">
              All trips <ChevronRight size={17} />
            </Link>
          </div>
          <StaffCard className="mt-2 overflow-hidden">
            {later.slice(0, 3).map(item => <DriverTripRow key={item.id} item={item} />)}
          </StaffCard>
        </section>
      ) : null}

      <details className="mt-6 rounded-2xl border border-[#e3e3d8] bg-white px-4 py-3">
        <summary className="cursor-pointer py-2 text-sm font-semibold text-[#526358]">
          Attendance and shift
        </summary>
        <p className="mt-2 text-xs text-[#68776d]">Attendance scanning is separate from driver trips.</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link href="/staff/scan" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#19563c]">
            <QrCode size={17} /> Scan attendance
          </Link>
          <Link href="/staff/attendance" className="inline-flex min-h-11 items-center text-sm font-semibold text-[#19563c] underline">
            Attendance records
          </Link>
        </div>
        {attendanceData ? (
          <p className="mt-2 text-xs text-[#68776d]">
            Shift: {attendanceData.currentClockState.replaceAll("_", " ")}
          </p>
        ) : null}
        {attendanceData?.currentClockState === "clocked_in" && attendanceData.portalClockOut ? (
          <StaffAttendanceClockOut
            availability={attendanceData.portalClockOut}
            timezone={attendanceData.todayState.timezone} />
        ) : null}
      </details>
      <Link href="/staff/driver/trips" className="mt-4 block py-2 text-center text-xs text-[#65746b] underline">
        View all assigned trips for {businessDate}
      </Link>
    </StaffScreen>
  );
}
