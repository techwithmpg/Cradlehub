"use client";

import Link from "next/link";
import {
  Activity,
  ChevronRight,
  Clock3,
  Home,
  MapPin,
  Stethoscope,
} from "lucide-react";
import { formatTime } from "@/lib/utils";
import { getStaffDisplayName } from "@/lib/staff/display-name";
import type {
  StaffPortalBooking,
  StaffPortalStaff,
} from "@/components/features/staff-portal/types";
import type {
  TodayOverrideInfo,
  TodayScheduleInfo,
} from "@/app/(dashboard)/staff-portal/actions";
import type { StaffAttendanceData } from "@/lib/staff-portal/attendance";
import {
  resolveProviderPrimaryWork,
  resolveProviderShift,
  type ProviderWorkspaceRuntime,
  type ResolvedShift,
} from "@/lib/staff-pwa/provider-model";
import { BookingProgressActions } from "@/components/features/staff-portal/booking-progress-actions";
import { TherapistHeader } from "./therapist-header";
import {
  getTherapistShiftStatus,
  type TherapistShiftStatus,
} from "./therapist-greeting-card";

type TherapistMobileHomeProps = {
  staff?: StaffPortalStaff;
  bookings?: StaffPortalBooking[];
  todaySchedule?: TodayScheduleInfo | null;
  todayOverride?: TodayOverrideInfo | null;
  attendanceData?: StaffAttendanceData | null;
  runtime?: ProviderWorkspaceRuntime | null;
};

function firstRelation<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function shiftTypeLabel(value: string): string {
  if (value === "opening") return "Opening Shift";
  if (value === "closing") return "Closing Shift";
  return "Regular Shift";
}

function resolveShift(
  schedule: TodayScheduleInfo | null,
  override: TodayOverrideInfo | null
): ResolvedShift {
  if (override?.is_day_off) return { kind: "day_off" };

  if (override && !override.is_day_off) {
    const start = override.start_time ?? schedule?.start_time ?? null;
    const end = override.end_time ?? schedule?.end_time ?? null;

    if (start && end) {
      return {
        kind: "shift",
        startTime: start,
        endTime: end,
        label: schedule ? shiftTypeLabel(schedule.shift_type) : "Regular Shift",
      };
    }
  }

  if (schedule) {
    return {
      kind: "shift",
      startTime: schedule.start_time,
      endTime: schedule.end_time,
      label: shiftTypeLabel(schedule.shift_type),
    };
  }

  return { kind: "none" };
}

function formatMinutes(total: number): string {
  const safe = Math.max(0, total);
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;

  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function formatAttendanceTime(
  value: string | null | undefined,
  timezone: string | undefined
): string {
  if (!value) return "—";

  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
}

function isClosedBooking(booking: StaffPortalBooking): boolean {
  return (
    booking.status === "completed" ||
    booking.status === "cancelled" ||
    booking.status === "no_show" ||
    booking.booking_progress_status === "completed"
  );
}

function isOperationallyActive(booking: StaffPortalBooking): boolean {
  return (
    booking.status === "in_progress" ||
    [
      "checked_in",
      "travel_started",
      "arrived",
      "session_started",
    ].includes(booking.booking_progress_status)
  );
}

function findPrimaryService(
  bookings: StaffPortalBooking[]
): StaffPortalBooking | null {
  const open = bookings.filter((booking) => !isClosedBooking(booking));

  const homeActive = open.find(
    (booking) =>
      booking.delivery_type === "home_service" &&
      isOperationallyActive(booking)
  );

  if (homeActive) return homeActive;

  const onsiteActive = open.find(
    (booking) =>
      booking.delivery_type !== "home_service" &&
      isOperationallyActive(booking)
  );

  if (onsiteActive) return onsiteActive;

  const upcoming = [...open].sort((a, b) =>
    a.start_time.localeCompare(b.start_time)
  );

  const nextHome = upcoming.find(
    (booking) => booking.delivery_type === "home_service"
  );

  return nextHome ?? upcoming[0] ?? null;
}

function serviceStateLabel(booking: StaffPortalBooking): string {
  switch (booking.booking_progress_status) {
    case "checked_in":
      return "Checked In";
    case "travel_started":
      return "Traveling";
    case "arrived":
      return "Arrived";
    case "session_started":
      return "In Progress";
    case "completed":
      return "Completed";
    default:
      return "Upcoming";
  }
}

function dutyLabel(status: TherapistShiftStatus): string {
  switch (status) {
    case "in_service":
      return "In Service";
    case "traveling":
      return "Home Service";
    case "on_duty":
      return "On Duty";
    case "day_off":
      return "Day Off";
    default:
      return "No Shift";
  }
}

function AttendanceCard({
  attendanceData,
  shift,
}: {
  attendanceData: StaffAttendanceData;
  shift: ResolvedShift;
}) {
  const record = attendanceData.currentRecord;

  const clockText =
    attendanceData.currentClockState === "clocked_in"
      ? "Clocked in"
      : attendanceData.currentClockState === "clocked_out"
        ? "Clocked out"
        : "Not clocked in";

  const latestTime =
    attendanceData.currentClockState === "clocked_out"
      ? formatAttendanceTime(
          record?.checkedOutAt,
          attendanceData.todayState.timezone
        )
      : formatAttendanceTime(
          record?.checkedInAt,
          attendanceData.todayState.timezone
        );

  const worked =
    record && record.workedMinutes > 0
      ? formatMinutes(record.workedMinutes)
      : "—";

  return (
    <section className="rounded-[22px] border border-[#EAE5DD] bg-white px-4 py-3.5 shadow-[0_6px_24px_rgba(30,41,59,0.05)]">
      <div className="flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-[#E6F6EA] text-[#15955A]">
          <Clock3 size={19} strokeWidth={2.2} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-medium text-[#68778A]">
            Today&apos;s Attendance
          </div>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
            <span className="text-[15px] font-bold text-[#163A2B]">
              {clockText}
            </span>
            <span className="text-[12px] font-semibold text-[#19915A]">
              {latestTime !== "—" ? `at ${latestTime}` : ""}
            </span>
          </div>
        </div>

        <ChevronRight size={18} className="text-[#7B8795]" />
      </div>

      <div className="mt-3 grid grid-cols-3 divide-x divide-[#E9E4DC] border-t border-[#EEE9E2] pt-3">
        <div className="pr-3">
          <div className="text-[10.5px] text-[#778396]">Hours worked</div>
          <div className="mt-1 text-[15px] font-bold tabular-nums text-[#142334]">
            {worked}
          </div>
        </div>

        <div className="px-3">
          <div className="text-[10.5px] text-[#778396]">Shift ends</div>
          <div className="mt-1 text-[15px] font-bold tabular-nums text-[#142334]">
            {shift.kind === "shift" ? formatTime(shift.endTime) : "—"}
          </div>
        </div>

        <div className="pl-3">
          <div className="text-[10.5px] text-[#778396]">Scheduled</div>
          <div className="mt-1 text-[12px] font-bold tabular-nums text-[#142334]">
            {shift.kind === "shift"
              ? `${formatTime(shift.startTime)} – ${formatTime(shift.endTime)}`
              : shift.kind === "day_off"
                ? "Day Off"
                : "—"}
          </div>
        </div>
      </div>
    </section>
  );
}

function PrimaryServiceCard({
  booking,
}: {
  booking: StaffPortalBooking | null;
}) {
  if (!booking) {
    return (
      <section className="rounded-[22px] border border-[#EAE5DD] bg-white px-4 py-5 shadow-[0_6px_24px_rgba(30,41,59,0.05)]">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-full bg-[#F1F5F1] text-[#5C7468]">
            <Stethoscope size={20} />
          </div>

          <div>
            <div className="text-[15px] font-bold text-[#142334]">
              No assigned service
            </div>
            <div className="mt-1 text-[12px] leading-5 text-[#708092]">
              Your next assigned service will appear here.
            </div>
          </div>
        </div>
      </section>
    );
  }

  const service = firstRelation(booking.services);
  const customer = firstRelation(booking.customers);
  const isHome = booking.delivery_type === "home_service";
  const active = isOperationallyActive(booking);
  const address =
    (booking.metadata?.address as string | undefined) ??
    (booking.metadata?.home_address as string | undefined) ??
    null;

  const title = isHome
    ? active
      ? "Home Service Active"
      : "Next Home Service"
    : active
      ? "Active Service"
      : "Next Service";

  return (
    <section
      className={
        isHome
          ? "rounded-[22px] border border-[#BFE6CB] bg-[linear-gradient(145deg,#F3FCF5_0%,#FBFAF4_100%)] px-4 py-4 shadow-[0_8px_26px_rgba(13,92,67,0.08)]"
          : "rounded-[22px] border border-[#EAE5DD] bg-white px-4 py-4 shadow-[0_8px_26px_rgba(30,41,59,0.06)]"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={
              isHome
                ? "grid size-11 shrink-0 place-items-center rounded-full bg-[#E4F5E8] text-[#0D6A49]"
                : "grid size-11 shrink-0 place-items-center rounded-full bg-[#F7EFE0] text-[#9A6A24]"
            }
          >
            {isHome ? <Home size={21} /> : <Stethoscope size={20} />}
          </div>

          <div className="min-w-0">
            <div className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[#61728A]">
              {title}
            </div>
            <div className="mt-0.5 truncate text-[18px] font-bold tracking-[-0.02em] text-[#132536]">
              {service?.name ?? "Service"}
            </div>
          </div>
        </div>

        <span className="shrink-0 rounded-full bg-[#E2F5E7] px-2.5 py-1 text-[11px] font-bold text-[#15834F]">
          {serviceStateLabel(booking)}
        </span>
      </div>

      <div className="mt-3 space-y-2 text-[13px] text-[#42556A]">
        {customer ? (
          <div className="font-semibold text-[#25384B]">
            {customer.full_name}
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <Clock3 size={15} className="text-[#64768A]" />
          <span className="tabular-nums">
            {formatTime(booking.start_time)} – {formatTime(booking.end_time)}
          </span>
          {service?.duration_minutes ? (
            <span className="text-[#7B8795]">
              · {service.duration_minutes} min
            </span>
          ) : null}
        </div>

        {isHome ? (
          address ? (
            <div className="flex items-start gap-2">
              <MapPin size={15} className="mt-0.5 shrink-0 text-[#64768A]" />
              <span className="line-clamp-2">{address}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Home size={15} className="text-[#64768A]" />
              <span>Home Service</span>
            </div>
          )
        ) : booking.branch_resources ? (
          <div className="flex items-center gap-2">
            <MapPin size={15} className="text-[#64768A]" />
            <span>{booking.branch_resources.name}</span>
          </div>
        ) : null}
      </div>

      {active ? (
        <div className="mt-3 border-t border-[#EEE9E2] pt-3">
          <BookingProgressActions booking={booking} />
        </div>
      ) : (
        <Link
          href="/staff/progress"
          className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-[#0D6548] px-4 text-[14px] font-bold text-white shadow-[0_6px_18px_rgba(13,101,72,0.18)] transition active:scale-[0.99]"
        >
          {isHome ? "Open Job" : "View Service Details"}
          <ChevronRight size={17} />
        </Link>
      )}
    </section>
  );
}

export function TherapistMobileHome({
  staff,
  bookings = [],
  todaySchedule = null,
  todayOverride = null,
  attendanceData = null,
  runtime = null,
}: TherapistMobileHomeProps) {
  const currentStaff = runtime?.staff ?? staff;
  if (!currentStaff) return null;

  const currentBookings = runtime?.bookings ?? bookings;
  const currentSchedule = runtime?.todaySchedule ?? todaySchedule;
  const currentOverride = runtime?.todayOverride ?? todayOverride;
  const currentAttendance = runtime?.attendance ?? attendanceData;
  const shift =
    runtime?.shift ?? resolveProviderShift(currentSchedule, currentOverride);
  const primaryWork =
    runtime?.primaryWork ?? resolveProviderPrimaryWork(currentBookings);
  const primaryService = primaryWork.booking;

  const displayName = getStaffDisplayName(currentStaff);
  const firstName = displayName.split(" ")[0] ?? displayName;

  const status = getTherapistShiftStatus(
    currentBookings,
    currentSchedule,
    currentOverride
  );


  return (
    <div className="min-h-dvh bg-[#F7F3EB] text-[#142334]">
      <TherapistHeader staff={currentStaff} />

      <main className="mx-auto flex w-full max-w-[480px] flex-col gap-3 px-3.5 pb-5 pt-3">
        <section className="flex items-center justify-between gap-3 px-1 py-1">
          <div className="min-w-0">
            <h1 className="truncate text-[22px] font-bold tracking-[-0.035em] text-[#132536]">
              {getGreeting()}, {firstName}
            </h1>
            <p className="mt-0.5 text-[12px] text-[#6B7A8B]">
              Ready for a focused workday.
            </p>
          </div>

          <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#E4F5E8] px-3 py-1.5 text-[11px] font-bold text-[#126A49]">
            <Activity size={13} />
            {dutyLabel(status)}
          </div>
        </section>

        {currentAttendance ? (
          <Link href="/staff/attendance" className="block">
            <AttendanceCard attendanceData={currentAttendance} shift={shift} />
          </Link>
        ) : null}

        <PrimaryServiceCard booking={primaryService} />

        {shift.kind === "shift" ? (
          <Link
            href="/staff/schedule"
            className="flex items-center gap-3 rounded-[18px] border border-[#EAE5DD] bg-white px-4 py-3 shadow-[0_4px_18px_rgba(30,41,59,0.04)]"
          >
            <div className="grid size-10 shrink-0 place-items-center rounded-full bg-[#F7EFE0] text-[#8A592A]">
              <Clock3 size={18} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold text-[#7A695C]">
                My Shift Today
              </div>
              <div className="mt-0.5 text-[15px] font-bold tabular-nums text-[#1D3043]">
                {formatTime(shift.startTime)} – {formatTime(shift.endTime)}
              </div>
              <div className="mt-0.5 text-[11px] text-[#778396]">
                {shift.label}
              </div>
            </div>

            <ChevronRight size={18} className="text-[#738093]" />
          </Link>
        ) : null}

      </main>
    </div>
  );
}