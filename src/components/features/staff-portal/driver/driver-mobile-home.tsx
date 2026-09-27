import Link from "next/link";
import {
  Activity,
  CarFront,
  ChevronRight,
  Clock3,
  Map,
  MapPin,
  Navigation,
} from "lucide-react";
import { DriverHeader } from "./driver-header";
import { getStaffDisplayName } from "@/lib/staff/display-name";
import { formatTime12h } from "@/lib/utils/time-format";
import type { StaffPortalStaff } from "@/components/features/staff-portal/types";
import type {
  DispatchStats,
  RealDispatchItem,
} from "@/lib/queries/dispatch-queries";
import type { StaffAttendanceData } from "@/lib/staff-portal/attendance";

type DriverMobileHomeProps = {
  staff: StaffPortalStaff;
  items: RealDispatchItem[];
  stats: DispatchStats;
  attendanceData?: StaffAttendanceData | null;
};

const ACTIVE_STATUSES = new Set([
  "in_route",
  "arrived_at_customer",
  "service_started",
]);

function isClosed(item: RealDispatchItem): boolean {
  return (
    item.dispatchStatus === "completed" ||
    item.dispatchStatus === "cancelled"
  );
}

function resolvePrimaryTrip(
  items: RealDispatchItem[]
): RealDispatchItem | null {
  const open = items
    .filter((item) => !isClosed(item))
    .sort((a, b) =>
      `${a.bookingDate}T${a.startTime}`.localeCompare(
        `${b.bookingDate}T${b.startTime}`
      )
    );

  return (
    open.find((item) =>
      ACTIVE_STATUSES.has(item.dispatchStatus)
    ) ??
    open[0] ??
    null
  );
}

function tripStatusLabel(
  status: RealDispatchItem["dispatchStatus"]
): string {
  switch (status) {
    case "in_route":
      return "En Route";
    case "arrived_at_customer":
      return "Arrived";
    case "service_started":
      return "Service Active";
    case "released_to_driver":
      return "Released";
    case "ready":
      return "Ready";
    case "scheduled":
      return "Scheduled";
    case "awaiting_driver":
      return "Awaiting";
    default:
      return "Assigned";
  }
}

function AttendanceCompact({
  attendance,
}: {
  attendance: StaffAttendanceData;
}) {
  const state = attendance.currentClockState;

  const stateLabel =
    state === "clocked_in"
      ? "Clocked in"
      : state === "clocked_out"
        ? "Clocked out"
        : "Not clocked in";

  const stateClasses =
    state === "clocked_in"
      ? "bg-[#E4F5E8] text-[#176B49]"
      : state === "clocked_out"
        ? "bg-[#EDF2F0] text-[#53685F]"
        : "bg-[#F3F1ED] text-[#665F58]";

  return (
    <Link
      href="/staff/attendance"
      className="flex min-h-[74px] items-center gap-3 rounded-[19px] border border-[#E9E4DC] bg-white px-3.5 py-3 shadow-[0_4px_18px_rgba(30,41,59,0.04)]"
    >
      <div className="grid size-10 shrink-0 place-items-center rounded-full bg-[#EAF5ED] text-[#0D6548]">
        <Clock3 size={18} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[#819087]">
          Attendance
        </div>

        <div className="mt-0.5 truncate text-[13px] font-bold text-[#23394A]">
          {attendance.scheduleLabel}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <span
          className={`rounded-full px-2.5 py-1 text-[9.5px] font-bold ${stateClasses}`}
        >
          {stateLabel}
        </span>

        <ChevronRight size={16} className="text-[#7D8995]" />
      </div>
    </Link>
  );
}

function EmptyTripState() {
  return (
    <section className="flex min-h-[112px] items-center gap-3 rounded-[20px] border border-[#E9E4DC] bg-white px-4 py-4 shadow-[0_5px_20px_rgba(30,41,59,0.045)]">
      <div className="grid size-12 shrink-0 place-items-center rounded-full bg-[#F7EFE0] text-[#8C6028]">
        <CarFront size={22} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-bold text-[#22384A]">
          No trips assigned
        </div>

        <div className="mt-1 text-[11px] leading-5 text-[#788697]">
          Your assigned home-service trips will appear here.
        </div>
      </div>
    </section>
  );
}

function PrimaryTripCard({
  trip,
}: {
  trip: RealDispatchItem;
}) {
  const active = ACTIVE_STATUSES.has(trip.dispatchStatus);

  const destination =
    trip.formattedAddress ??
    trip.area ??
    "Destination pending";

  const origin =
    trip.branchName ??
    "CradleHub branch";

  return (
    <section
      className={
        active
          ? "rounded-[21px] border border-[#BFE5CB] bg-[linear-gradient(145deg,#F3FCF5_0%,#FBFAF4_100%)] p-4 shadow-[0_7px_24px_rgba(13,92,67,0.07)]"
          : "rounded-[21px] border border-[#E9E4DC] bg-white p-4 shadow-[0_6px_22px_rgba(30,41,59,0.05)]"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-full bg-[#F7EFE0] text-[#8C6028]">
            <CarFront size={20} />
          </div>

          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#748293]">
              {active ? "Active Trip" : "Next Trip"}
            </div>

            <div className="mt-0.5 truncate text-[17px] font-bold text-[#203548]">
              {trip.customerName}
            </div>

            <div className="mt-0.5 truncate text-[10.5px] text-[#66788B]">
              {trip.serviceName}
            </div>
          </div>
        </div>

        <span className="shrink-0 rounded-full bg-[#E2F5E7] px-2.5 py-1 text-[9.5px] font-bold text-[#15834F]">
          {tripStatusLabel(trip.dispatchStatus)}
        </span>
      </div>

      <div className="mt-3 space-y-2 text-[11px] text-[#53677A]">
        <div className="flex items-center gap-2">
          <Clock3 size={13} className="shrink-0" />
          <span className="font-semibold tabular-nums text-[#31485A]">
            {formatTime12h(trip.startTime)} –{" "}
            {formatTime12h(trip.endTime)}
          </span>
        </div>

        <div className="flex items-start gap-2">
          <Navigation
            size={13}
            className="mt-0.5 shrink-0"
          />

          <div className="min-w-0">
            <span className="font-semibold text-[#31485A]">
              From:
            </span>{" "}
            {origin}
          </div>
        </div>

        <div className="flex items-start gap-2">
          <MapPin
            size={13}
            className="mt-0.5 shrink-0"
          />

          <div className="min-w-0 line-clamp-2">
            <span className="font-semibold text-[#31485A]">
              To:
            </span>{" "}
            {destination}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link
          href={`/staff/driver/trips/${trip.id}`}
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-[13px] bg-[#0D6548] px-3 text-[12px] font-bold text-white active:scale-[0.99]"
        >
          <Navigation size={15} />
          View Trip
        </Link>

        <Link
          href="/staff/driver/map"
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-[13px] border border-[#A9D3B9] bg-[#F6FBF7] px-3 text-[12px] font-bold text-[#176046] active:scale-[0.99]"
        >
          <Map size={15} />
          Map
        </Link>
      </div>
    </section>
  );
}

export function DriverMobileHome({
  staff,
  items,
  stats,
  attendanceData,
}: DriverMobileHomeProps) {
  const displayName = getStaffDisplayName(staff);
  const firstName =
    displayName.split(" ")[0] ??
    displayName;

  const primaryTrip = resolvePrimaryTrip(items);

  const dutyLabel =
    attendanceData?.currentClockState === "clocked_in"
      ? "On Duty"
      : attendanceData?.currentClockState === "clocked_out"
        ? "Shift Complete"
        : attendanceData ? "Off Duty" : "Attendance unavailable";

  return (
    <div className="bg-[#F7F3EB] text-[#142334]">
      <DriverHeader staff={staff} />

      <main className="mx-auto flex w-full max-w-[480px] flex-col gap-3 px-3.5 pb-2 pt-3">
        <section className="flex items-center justify-between gap-3 px-1 py-1">
          <div className="min-w-0">
            <h1 className="truncate text-[21px] font-bold tracking-[-0.035em] text-[#132536]">
              Good day, {firstName}
            </h1>

            <p className="mt-0.5 text-[11px] text-[#718092]">
              {stats.totalToday === 0
                ? "No trips assigned today."
                : `${stats.totalToday} ${
                    stats.totalToday === 1 ? "trip" : "trips"
                  } assigned today.`}
            </p>
          </div>

          <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#E4F5E8] px-2.5 py-1.5 text-[10px] font-bold text-[#126A49]">
            <Activity size={12} />
            {dutyLabel}
          </div>
        </section>

        {attendanceData ? (
          <AttendanceCompact attendance={attendanceData} />
        ) : null}

        {primaryTrip ? (
          <PrimaryTripCard trip={primaryTrip} />
        ) : (
          <EmptyTripState />
        )}
      </main>
    </div>
  );
}
