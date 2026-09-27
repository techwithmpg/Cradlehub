import Link from "next/link";
import { StaffWorkList } from "@/components/features/staff-pwa/staff-work-list";
import type { StaffWorkResult } from "@/lib/staff-pwa/work-model";
import {
  Activity,
  Bell,
  ChevronRight,
  ClipboardList,
  Clock3,
  Leaf,
  QrCode,
} from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { getStaffDisplayName } from "@/lib/staff/display-name";
import type { StaffPortalStaff } from "@/components/features/staff-portal/types";
import type { StaffAttendanceData } from "@/lib/staff-portal/attendance";

export type GeneralStaffProfile =
  | "crm_general"
  | "utility";

type GeneralStaffDestinations = {
  workHref: string;
  scanHref: string;
  noticesHref: string;
  moreHref: string;
};

type GeneralStaffMobileHomeProps = {
  staff: StaffPortalStaff;
  profile: GeneralStaffProfile;
  attendanceData?: StaffAttendanceData | null;
  destinations?: GeneralStaffDestinations;
  work?: StaffWorkResult;
};

function attendanceStateLabel(
  state: StaffAttendanceData["currentClockState"] | undefined
): string {
  if (state === "clocked_in") return "On Duty";
  if (state === "clocked_out") return "Shift Complete";
  return state ? "Off Duty" : "Attendance unavailable";
}

function attendanceStatusLabel(
  state: StaffAttendanceData["currentClockState"] | undefined
): string {
  if (state === "clocked_in") return "Clocked in";
  if (state === "clocked_out") return "Clocked out";
  return state ? "Not clocked in" : "Unavailable";
}

function roleCopy(profile: GeneralStaffProfile) {
  if (profile === "utility") {
    return {
      roleLabel: "Utility",
      greetingLine: "Ready to keep the workspace running smoothly.",
      workTitle: "Utility Work",
      workDescription:
        "Cleaning and turnover tasks are not connected to the Staff PWA yet.",
      workHref: "/staff/utility/work",
      scanHref: "/staff/scan",
      noticesHref: "/staff/utility/notices",
      moreHref: "/staff/utility/more",
    };
  }

  return {
    roleLabel: "CRM Staff",
    greetingLine: "Ready for a focused front-desk workday.",
    workTitle: "Operational Work",
    workDescription:
      "Review booking attention and open workflow items.",
    workHref: "/staff/work",
    scanHref: "/staff/scan",
    noticesHref: "/staff/notices",
    moreHref: "/staff/more",
  };
}

function AttendanceCard({
  attendance,
}: {
  attendance: StaffAttendanceData | null | undefined;
}) {
  const state = attendance?.currentClockState;

  const statusClass =
    state === "clocked_in"
      ? "bg-[#E3F5E8] text-[#176B49]"
      : state === "clocked_out"
        ? "bg-[#EDF2F0] text-[#53685F]"
        : "bg-[#F3F1ED] text-[#665F58]";

  return (
    <section className="rounded-[20px] border border-[#E9E4DC] bg-white p-3.5 shadow-[0_5px_20px_rgba(30,41,59,0.045)]">
      <div className="flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-[#EAF5ED] text-[#0D6548]">
          <Clock3 size={18} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#819087]">
            Attendance
          </div>

          <div className="mt-0.5 truncate text-[13px] font-bold text-[#263B4D]">
            {attendance?.scheduleLabel ?? "Schedule unavailable"}
          </div>
        </div>

        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[9.5px] font-bold ${statusClass}`}
        >
          {attendanceStatusLabel(state)}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link
          href="/staff/attendance"
          className="flex min-h-10 items-center justify-center gap-1.5 rounded-[12px] border border-[#D9E4DC] bg-[#F8FAF8] px-3 text-[11px] font-bold text-[#315747]"
        >
          View Attendance
          <ChevronRight size={13} />
        </Link>

        <a
          href="/staff/scan"
          className="flex min-h-10 items-center justify-center gap-1.5 rounded-[12px] bg-[#0D6548] px-3 text-[11px] font-bold text-white"
        >
          <QrCode size={14} />
          Scan
        </a>
      </div>
    </section>
  );
}

export function GeneralStaffMobileHome({
  staff,
  profile,
  attendanceData,
  destinations,
  work,
}: GeneralStaffMobileHomeProps) {
  const copy = roleCopy(profile);

  const routes =
    destinations ?? {
      workHref: copy.workHref,
      scanHref: copy.scanHref,
      noticesHref: copy.noticesHref,
      moreHref: copy.moreHref,
    };
  const displayName = getStaffDisplayName(staff);
  const firstName = displayName.split(" ")[0] ?? displayName;

  return (
    <div className="bg-[#F7F3EB] text-[#142334]">
      <header className="sticky top-0 z-30 border-b border-[#EEE8DF] bg-[#FBFAF6]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[58px] max-w-[480px] items-center justify-between px-3.5">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-[#EAF5ED] text-[#0D6548]">
              <Leaf size={20} />
            </div>

            <div>
              <div className="text-[16px] font-bold leading-none tracking-[-0.025em] text-[#102A26]">
                CradleHub
              </div>

              <div className="mt-1 text-[8.5px] font-semibold uppercase tracking-[0.15em] text-[#8D7563]">
                Staff · {copy.roleLabel}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Link
              href={routes.noticesHref}
              aria-label="Notices"
              className="grid size-9 place-items-center rounded-full text-[#314658] active:bg-[#F1EEE8]"
            >
              <Bell size={18} />
            </Link>

            <Link
              href={routes.moreHref}
              aria-label="Profile"
              className="rounded-full active:scale-95"
            >
              <UserAvatar
                name={displayName}
                imageUrl={staff.avatar_url}
                size="sm"
                className="size-9 border-2 border-white shadow-sm ring-1 ring-[#E4DED5]"
              />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[480px] flex-col gap-3 px-3.5 pb-2 pt-3">
        <section className="flex items-center justify-between gap-3 px-1 py-1">
          <div className="min-w-0">
            <h1 className="truncate text-[21px] font-bold tracking-[-0.035em] text-[#132536]">
              Good day, {firstName}
            </h1>

            <p className="mt-0.5 truncate text-[11px] text-[#718092]">
              {copy.greetingLine}
            </p>
          </div>

          <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#E4F5E8] px-2.5 py-1.5 text-[10px] font-bold text-[#126A49]">
            <Activity size={12} />
            {attendanceStateLabel(
              attendanceData?.currentClockState
            )}
          </div>
        </section>

        <AttendanceCard attendance={attendanceData} />
        {work ? <StaffWorkList result={work} limit={4} /> : null}

        <Link
          href={routes.workHref}
          className="flex min-h-[104px] items-center gap-3 rounded-[20px] border border-[#E9E4DC] bg-white px-4 py-4 shadow-[0_5px_20px_rgba(30,41,59,0.045)]"
        >
          <div className="grid size-12 shrink-0 place-items-center rounded-full bg-[#F7EFE0] text-[#8A6028]">
            <ClipboardList size={21} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-bold text-[#24394B]">
              {copy.workTitle}
            </div>

            <div className="mt-1 line-clamp-2 text-[10.5px] leading-4 text-[#788697]">
              {copy.workDescription}
            </div>
          </div>

          <ChevronRight
            size={17}
            className="shrink-0 text-[#788594]"
          />
        </Link>
      </main>
    </div>
  );
}
