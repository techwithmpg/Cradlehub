import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock3,
  DoorOpen,
  Leaf,
  QrCode,
  Sparkles,
} from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { UtilityWorkspaceRuntime } from "@/lib/staff-pwa/utility-runtime";

type Props = {
  runtime: UtilityWorkspaceRuntime;
};

function displayName(
  staff: UtilityWorkspaceRuntime["staff"]
) {
  return (
    staff.nickname?.trim() ||
    staff.full_name?.trim() ||
    "Utility Staff"
  );
}

function dutyLabel(
  runtime: UtilityWorkspaceRuntime
) {
  if (
    runtime.attendanceData?.currentClockState ===
    "clocked_in"
  ) {
    return "On Duty";
  }

  if (
    runtime.attendanceData?.currentClockState ===
    "clocked_out"
  ) {
    return "Shift Complete";
  }

  return "Off Duty";
}

export function UtilityMobileHome({
  runtime,
}: Props) {
  const name = displayName(runtime.staff);
  const firstName = name.split(" ")[0] ?? name;

  const activeCount = runtime.turnoverItems.length;

  return (
    <div className="min-h-full bg-[#F7F3EB] text-[#142334]">
      <header className="sticky top-0 z-30 border-b border-[#EDE6DD] bg-[#FBFAF6]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[58px] max-w-[480px] items-center justify-between px-3.5">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-[#E7F2E9] text-[#176747]">
              <Sparkles size={19} />
            </div>

            <div>
              <div className="text-[16px] font-bold leading-none tracking-[-0.025em] text-[#102A26]">
                CradleHub
              </div>

              <div className="mt-1 text-[8.5px] font-semibold uppercase tracking-[0.14em] text-[#8D7563]">
                Utility Operations
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Link
              href="/staff/utility/notices"
              aria-label="Notices"
              className="grid size-9 place-items-center rounded-full text-[#314658] active:bg-[#F1EEE8]"
            >
              <Bell size={18} />
            </Link>

            <Link
              href="/staff/utility/more"
              aria-label="Profile"
            >
              <UserAvatar
                name={name}
                imageUrl={runtime.staff.avatar_url}
                size="sm"
                className="size-9 border-2 border-white shadow-sm ring-1 ring-[#E4DED5]"
              />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-[480px] flex-col gap-3 px-3.5 pb-3 pt-3">
        <section className="flex items-center justify-between gap-3 px-1 py-1">
          <div className="min-w-0">
            <h1 className="truncate text-[21px] font-bold tracking-[-0.035em] text-[#132536]">
              Good day, {firstName}
            </h1>

            <p className="mt-0.5 text-[11px] text-[#718092]">
              Keep rooms clean, ready and moving.
            </p>
          </div>

          <div className="shrink-0 rounded-full bg-[#E4F5E8] px-2.5 py-1.5 text-[10px] font-bold text-[#126A49]">
            {dutyLabel(runtime)}
          </div>
        </section>

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
                {runtime.attendanceData?.scheduleLabel ??
                  "Schedule unavailable"}
              </div>
            </div>

            <Link
              href="/staff/attendance"
              className="shrink-0 rounded-full bg-[#F4F7F4] px-2.5 py-1.5 text-[9.5px] font-bold text-[#315747]"
            >
              View
            </Link>
          </div>

          <Link
            href="/staff/scan"
            className="mt-3 flex min-h-10 items-center justify-center gap-1.5 rounded-[12px] bg-[#0D6548] px-3 text-[11px] font-bold text-white"
          >
            <QrCode size={14} />
            Scan Attendance
          </Link>
        </section>

        <Link
          href="/staff/utility/work"
          className="block rounded-[20px] border border-[#E9E4DC] bg-white p-4 shadow-[0_5px_20px_rgba(30,41,59,0.045)]"
        >
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-full bg-[#F7EFE0] text-[#8A6028]">
              <DoorOpen size={20} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[14px] font-bold text-[#24394B]">
                  Rooms to Prepare
                </h2>

                <span className="rounded-full bg-[#FFF2D9] px-2 py-1 text-[9.5px] font-bold text-[#8A6028]">
                  {activeCount}
                </span>
              </div>

              <p className="mt-1 text-[10.5px] leading-4 text-[#788697]">
                Completed onsite services with assigned rooms
                appear here automatically.
              </p>
            </div>

            <ChevronRight
              size={17}
              className="mt-1 shrink-0 text-[#788594]"
            />
          </div>
        </Link>

        {activeCount === 0 ? (
          <section className="flex items-center gap-3 rounded-[18px] border border-[#DFE9E1] bg-[#F3F8F4] p-3.5">
            <div className="grid size-9 place-items-center rounded-full bg-white text-[#24714F]">
              <CheckCircle2 size={17} />
            </div>

            <div>
              <div className="text-[12px] font-bold text-[#285240]">
                No rooms waiting
              </div>

              <div className="mt-0.5 text-[10px] text-[#678073]">
                Newly completed onsite rooms will appear automatically.
              </div>
            </div>
          </section>
        ) : null}

        {runtime.queueError ? (
          <section className="rounded-[16px] border border-[#F1D8C4] bg-[#FFF8F1] px-3.5 py-3 text-[10.5px] leading-4 text-[#805A3A]">
            Room turnover information could not be loaded.
            Attendance and Scan remain available.
          </section>
        ) : null}
      </main>
    </div>
  );
}