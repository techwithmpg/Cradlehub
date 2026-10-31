import Link from "next/link";
import { Bell, ChevronRight, Clock3, MapPinned, QrCode, Route } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  StaffCard,
  StaffEmptyState,
  StaffScreen,
  StaffStatTile,
  StaffStatusChip,
} from "@/components/features/staff-pwa/native-foundation";
import { StaffSnapshotRecorder } from "@/components/features/staff-pwa/safe-memory";
import { DriverTripRow } from "./driver-trip-row";
import {
  getDriverPrimaryTrip,
  getDriverProgressLabel,
  getDriverTripSummary,
} from "@/lib/staff-pwa/driver-ui-model";
import { formatTime12h } from "@/lib/utils/time-format";
import type { StaffPortalStaff } from "@/components/features/staff-portal/types";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";
import type { StaffAttendanceData } from "@/lib/staff-portal/attendance";
import { StaffAttendanceClockOut } from "@/components/features/staff-portal/staff-attendance-clock-out";

export function DriverNativeHome({
  staff,
  items,
  businessDate,
  attendanceData,
}: {
  staff: StaffPortalStaff;
  items: RealDispatchItem[];
  businessDate: string;
  attendanceData: StaffAttendanceData | null;
}) {
  const name = staff.nickname?.trim() || staff.full_name?.trim() || "Driver";
  const summary = getDriverTripSummary(items);
  const primary = getDriverPrimaryTrip(items);
  const dateLabel = new Date(`${businessDate}T12:00:00Z`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Manila",
  });
  const ordered = [...items].sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <StaffScreen>
      <StaffSnapshotRecorder
        snapshot={{
          screen: "driverToday",
          label: "Driver today",
          counts: [
            { label: "Today", value: summary.today },
            { label: "Completed", value: summary.completed },
            { label: "Remaining", value: summary.remaining },
          ],
        }}
      />
      <header className="relative overflow-hidden rounded-[24px] bg-[linear-gradient(145deg,#174332,#092c20)] px-5 pb-5 pt-4 text-white shadow-[0_12px_25px_rgba(13,53,35,0.2)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <UserAvatar
              name={name}
              imageUrl={staff.avatar_url}
              size="sm"
              className="size-11 border-2 border-[#d6bf85]"
            />
            <div className="min-w-0">
              <p className="text-xs text-white/80">Driver workspace</p>
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
        <div className="mt-6">
          <p className="text-xs text-[#dfca92]">{dateLabel}</p>
          <h1 className="mt-1 text-[26px] font-semibold leading-tight tracking-[-0.04em]">
            Good day, {name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-xs text-white/80">Your assigned home-service trips</p>
        </div>
      </header>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <StaffStatTile label="Today" value={summary.today} />
        <StaffStatTile label="Completed" value={summary.completed} />
        <StaffStatTile label="Remaining" value={summary.remaining} />
      </div>

      {primary ? (
        <StaffCard className="mt-5 overflow-hidden p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#76501a]">
              {primary.dispatchStatus === "in_route" ? "Current trip" : "Next trip"}
            </p>
            <StaffStatusChip tone="gold">{getDriverProgressLabel(primary)}</StaffStatusChip>
          </div>
          <h2 className="mt-3 text-lg font-semibold text-[#163a2b]">{primary.customerName}</h2>
          <p className="mt-1 text-sm text-[#65746b]">{primary.serviceName}</p>
          <p className="mt-3 flex items-center gap-2 text-sm text-[#526358]">
            <Clock3 size={16} aria-hidden="true" /> {formatTime12h(primary.startTime)}
            {(primary.formattedAddress ?? primary.area)
              ? ` · ${primary.area ?? primary.formattedAddress}`
              : ""}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link
              href={`/staff/driver/trips/${primary.id}`}
              className="flex min-h-12 items-center justify-center rounded-xl bg-[#163a2b] px-3 text-sm font-semibold text-white"
            >
              Open trip
            </Link>
            <Link
              href="/staff/driver/map"
              className="flex min-h-12 items-center justify-center gap-1 rounded-xl border border-[#c8a96b] text-sm font-semibold text-[#163a2b]"
            >
              <MapPinned size={16} aria-hidden="true" /> Map
            </Link>
          </div>
        </StaffCard>
      ) : (
        <div className="mt-5">
          <StaffEmptyState
            icon={<Route size={20} />}
            title="No trips waiting"
            description="New assigned home-service trips appear here."
          />
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#163a2b]">Today&apos;s trips</h2>
        <Link
          href="/staff/driver/trips"
          className="flex min-h-12 items-center gap-1 text-xs font-semibold text-[#19563c]"
        >
          View all <ChevronRight size={15} aria-hidden="true" />
        </Link>
      </div>
      {ordered.length > 0 ? (
        <StaffCard className="overflow-hidden">
          {ordered.slice(0, 4).map((item) => (
            <DriverTripRow key={item.id} item={item} />
          ))}
        </StaffCard>
      ) : null}

      <StaffCard className="mt-5 flex items-center gap-3 p-4">
        <QrCode size={22} className="shrink-0 text-[#19563c]" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">Attendance scan</div>
          <p className="text-xs text-[#65746b]">The Staff QR scanner records attendance.</p>
        </div>
        <Link
          href="/staff/scan"
          className="inline-flex min-h-12 items-center text-xs font-semibold text-[#19563c]"
        >
          Open
        </Link>
      </StaffCard>
      {attendanceData ? (
        <div className="mt-3">
          <Link href="/staff/attendance" className="block text-center text-xs text-[#65746b] underline">
            Attendance: {attendanceData.currentClockState.replaceAll("_", " ")}
          </Link>
          {attendanceData.currentClockState === "clocked_in" && attendanceData.portalClockOut ? <StaffAttendanceClockOut availability={attendanceData.portalClockOut} timezone={attendanceData.todayState.timezone} /> : null}
        </div>
      ) : null}
    </StaffScreen>
  );
}
