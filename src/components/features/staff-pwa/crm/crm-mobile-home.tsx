import Link from "next/link";
import { Bell, ChevronRight, ClipboardList, QrCode } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { getStaffDisplayName } from "@/lib/staff/display-name";
import type { StaffPortalStaff } from "@/components/features/staff-portal/types";
import type { StaffAttendanceData } from "@/lib/staff-portal/attendance";
import type { StaffWorkResult } from "@/lib/staff-pwa/work-model";
import type { CrmMobileRuntime } from "@/lib/staff-pwa/crm-runtime";
import { crmBookingCounts } from "@/lib/staff-pwa/crm-model";
import {
  StaffCard,
  StaffEmptyState,
  StaffFeedback,
  StaffScreen,
  StaffStatTile,
} from "@/components/features/staff-pwa/native-foundation";
import { StaffSnapshotRecorder } from "@/components/features/staff-pwa/safe-memory";
import { CrmBookingRow } from "./crm-booking-row";

export function CrmMobileHome({
  staff,
  runtime,
  work,
  attendance,
}: {
  staff: StaffPortalStaff;
  runtime: CrmMobileRuntime | null;
  work: StaffWorkResult;
  attendance: StaffAttendanceData | null;
}) {
  const name = getStaffDisplayName(staff);
  const firstName = name.split(" ")[0] || name;
  const counts =
    runtime && !runtime.bookingError ? crmBookingCounts(runtime.bookings, runtime.date) : null;
  const todayBookings =
    runtime?.bookings.filter(
      (booking) => booking.date === runtime.date && booking.status !== "completed"
    ) ?? [];
  const dateLabel = runtime?.date ?? "Today";

  return (
    <StaffScreen>
      {runtime && counts && runtime.canViewBookings ? (
        <StaffSnapshotRecorder
          snapshot={{
            screen: "crmToday",
            label: "Front Desk today",
            counts: [
              { label: "Bookings shown", value: counts.today },
              { label: "Arrived", value: counts.arrived },
              { label: "In service", value: counts.inService },
              { label: "Needs review", value: counts.attention },
            ],
          }}
        />
      ) : null}
      <header className="relative overflow-hidden rounded-[24px] bg-[linear-gradient(145deg,#174332,#092c20)] px-5 pb-5 pt-4 text-white shadow-[0_12px_25px_rgba(13,53,35,0.2)]">
        <div
          className="absolute -right-10 -top-14 size-36 rounded-full border border-white/10"
          aria-hidden="true"
        />
        <div className="relative flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <UserAvatar
              name={name}
              imageUrl={staff.avatar_url}
              size="sm"
              className="size-11 border-2 border-[#d6bf85]"
            />
            <div className="min-w-0">
              <p className="truncate text-xs text-white/80">Front Desk workspace</p>
              <p className="truncate text-base font-semibold">{name}</p>
            </div>
          </div>
          <Link
            href="/staff/notices"
            aria-label="Notices"
            className="grid min-h-12 min-w-12 place-items-center rounded-full bg-white/10 focus-visible:outline-2 focus-visible:outline-[#c8a96b]"
          >
            <Bell size={20} aria-hidden="true" />
          </Link>
        </div>
        <p className="relative mt-6 text-xs text-[#dfca92]">{dateLabel}</p>
        <h1 className="relative mt-1 text-[26px] font-semibold leading-tight tracking-[-0.04em]">
          Good day, {firstName}
        </h1>
        <p className="relative mt-1 text-xs text-white/80">Your branch at a glance</p>
      </header>

      {runtime?.canViewBookings ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <StaffStatTile value={counts?.today ?? "—"} label="Bookings shown" />
          <StaffStatTile value={counts?.arrived ?? "—"} label="Arrived" />
          <StaffStatTile value={counts?.inService ?? "—"} label="In service" />
          <StaffStatTile value={counts?.attention ?? "—"} label="Needs review" />
        </div>
      ) : null}

      {!runtime || runtime.bookingError ? (
        <StaffFeedback error className="mt-4">
          {runtime?.bookingError ??
            "Front Desk schedule is unavailable. Refresh when your connection returns."}
        </StaffFeedback>
      ) : null}
      {runtime?.truncated ? (
        <StaffFeedback className="mt-3">
          Showing the first 120 bookings in the next 14 days. Use the CRM workspace for the full
          list.
        </StaffFeedback>
      ) : null}
      {work.errors.map((error) => (
        <StaffFeedback key={error} error className="mt-3">
          {error}
        </StaffFeedback>
      ))}

      <Link
        href="/staff/work"
        className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#163a2b] px-4 text-sm font-semibold text-white shadow-[0_6px_14px_rgba(22,58,43,0.2)] focus-visible:outline-2 focus-visible:outline-[#c8a96b]"
      >
        <ClipboardList size={18} aria-hidden="true" />
        Review work
        {work.items.length ? (
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs">{work.items.length}</span>
        ) : null}
        <ChevronRight size={18} aria-hidden="true" />
      </Link>

      {runtime?.canViewBookings && !runtime.bookingError ? (
        <>
          <div className="mt-6 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-[#163a2b]">Today’s bookings</h2>
            <Link
              href="/staff/work"
              className="inline-flex min-h-12 items-center gap-1 text-xs font-semibold text-[#19563c]"
            >
              View work <ChevronRight size={15} />
            </Link>
          </div>
          {todayBookings.length ? (
            <StaffCard className="overflow-hidden">
              {todayBookings.slice(0, 4).map((booking) => (
                <CrmBookingRow key={booking.id} booking={booking} />
              ))}
            </StaffCard>
          ) : (
            <StaffEmptyState
              title="No active bookings today"
              description="Today’s branch bookings appear here when available."
            />
          )}
        </>
      ) : null}

      <StaffCard className="mt-5 flex items-center gap-3 p-4">
        <QrCode size={22} className="shrink-0 text-[#19563c]" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">Attendance scan</div>
          <p className="text-xs text-[#65746b]">
            The Staff scanner records attendance, not customer checkout.
          </p>
          {attendance ? (
            <p className="mt-1 text-xs text-[#65746b]">
              {attendance.currentClockState === "clocked_in"
                ? "Clocked in"
                : attendance.currentClockState === "clocked_out"
                  ? "Clocked out"
                  : "Not clocked in"}
            </p>
          ) : null}
        </div>
        <Link
          href="/staff/scan"
          className="inline-flex min-h-12 items-center rounded-xl px-3 text-xs font-semibold text-[#19563c]"
        >
          Open
        </Link>
      </StaffCard>
    </StaffScreen>
  );
}
