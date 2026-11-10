import Link from "next/link";
import { ChevronRight, Clock3, MapPin, Navigation, Route } from "lucide-react";
import {
  StaffCard,
  StaffEmptyState,
  StaffScreen,
  StaffStatusChip,
} from "@/components/features/staff-pwa/native-foundation";
import { StaffSnapshotRecorder } from "@/components/features/staff-pwa/safe-memory";
import {
  getDriverPrimaryTrip,
  getDriverProgressLabel,
  getDriverTripSummary,
} from "@/lib/staff-pwa/driver-ui-model";
import { formatTime12h } from "@/lib/utils/time-format";
import type { StaffPortalStaff } from "@/components/features/staff-portal/types";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

/** Driver home is deliberately a SINGLE trip, not a duplicate dashboard.
 * Attendance and notification settings remain reachable through More.
 */
export function DriverNativeHome({
  staff,
  items,
  businessDate,
}: {
  staff: StaffPortalStaff;
  items: RealDispatchItem[];
  businessDate: string;
}) {
  const name = staff.nickname?.trim() || staff.full_name?.trim() || "Driver";
  const summary = getDriverTripSummary(items);
  const primary = getDriverPrimaryTrip(items);
  const dateLabel = new Date(`${businessDate}T12:00:00Z`).toLocaleDateString("en-PH", {
    month: "short", day: "numeric", weekday: "short", timeZone: "Asia/Manila",
  });
  const destination = primary?.formattedAddress ?? primary?.area;
  const primaryHref = primary
    ? `/staff/driver/map?bookingId=${encodeURIComponent(primary.id)}` : null;

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
      <header className="rounded-[26px] bg-[linear-gradient(145deg,#174332,#092c20)] px-5 py-6 text-white">
        <p className="text-sm font-medium text-[#dfca92]">CradleHub Driver · {dateLabel}</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em]">
          {primary ? "Your next trip" : "You're all set"}
        </h1>
        <p className="mt-1 text-sm text-white/80">
          {primary ? `Ready when you are, ${name.split(" ")[0]}.`
            : "New assigned Home Service trips will appear here."}
        </p>
      </header>

      {primary && primaryHref ? (
        <StaffCard className="mt-5 overflow-hidden p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#76501a]">
              Assigned Home Service
            </p>
            <StaffStatusChip tone="gold">{getDriverProgressLabel(primary)}</StaffStatusChip>
          </div>
          <h2 className="mt-4 break-words text-xl font-semibold text-[#163a2b]">
            {primary.customerName}
          </h2>
          <p className="mt-1 text-sm text-[#65746b]">{primary.serviceName}</p>
          <p className="mt-5 flex items-center gap-3 text-sm text-[#526358]">
            <Clock3 size={20} aria-hidden="true" /> {formatTime12h(primary.startTime)}
          </p>
          {destination ? (
            <p className="mt-3 flex items-start gap-3 text-sm text-[#526358]">
              <MapPin size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span className="break-words">{destination}</span>
            </p>
          ) : null}
          <Link
            href={primaryHref}
            className="mt-6 flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-[#0d6548] px-5 text-lg font-semibold text-white"
          >
            <Navigation size={23} aria-hidden="true" /> Open trip
          </Link>
          <Link
            href={`/staff/driver/trips/${encodeURIComponent(primary.id)}`}
            className="mt-3 flex min-h-11 items-center justify-center text-sm font-semibold text-[#19563c] underline underline-offset-4"
          >
            Trip details
          </Link>
        </StaffCard>
      ) : (
        <div className="mt-5">
          <StaffEmptyState icon={<Route size={20} />} title="No trips waiting"
            description="Only your assigned Home Service work appears here." />
        </div>
      )}
      <Link
        href="/staff/driver/trips"
        className="mt-5 flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-[#d9d7cc] bg-white text-sm font-semibold text-[#163a2b]"
      >
        View all assigned trips <ChevronRight size={18} aria-hidden="true" />
      </Link>
    </StaffScreen>
  );
}
