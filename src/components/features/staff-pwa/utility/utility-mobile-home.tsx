import Link from "next/link";
import { Bell, ChevronRight, ClipboardList, DoorOpen, QrCode, Sparkles } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  StaffCard,
  StaffEmptyState,
  StaffFeedback,
  StaffScreen,
  StaffStatTile,
  StaffStatusChip,
} from "@/components/features/staff-pwa/native-foundation";
import { StaffSnapshotRecorder } from "@/components/features/staff-pwa/safe-memory";
import type {
  UtilityRoomTurnoverItem,
  UtilityWorkspaceRuntime,
} from "@/lib/staff-pwa/utility-runtime";

function statusLabel(item: UtilityRoomTurnoverItem) {
  return item.status === "in_progress" ? "In progress" : "Waiting";
}

export function UtilityMobileHome({ runtime }: { runtime: UtilityWorkspaceRuntime }) {
  const name = runtime.staff.nickname?.trim() || runtime.staff.full_name?.trim() || "Utility staff";
  const firstName = name.split(" ")[0] ?? name;
  const waiting = runtime.turnoverItems.filter((item) => item.status === "open").length;
  const inProgress = runtime.turnoverItems.length - waiting;
  const recentReady = runtime.recentCompletedItems.length;
  const dateLabel = new Intl.DateTimeFormat("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: runtime.attendanceData?.todayState.timezone ?? "Asia/Manila",
  }).format(new Date());

  return (
    <StaffScreen>
      {!runtime.queueError && !runtime.historyError ? (
        <StaffSnapshotRecorder
          snapshot={{
            screen: "utilityHome",
            label: "Utility home",
            counts: [
              { label: "Waiting", value: waiting },
              { label: "In progress", value: inProgress },
              { label: "Recent ready", value: recentReady },
            ],
          }}
        />
      ) : null}
      <header className="relative overflow-hidden rounded-[24px] bg-[linear-gradient(145deg,#174332,#092c20)] px-5 pb-5 pt-4 text-white shadow-[0_12px_25px_rgba(13,53,35,0.2)]">
        <div
          className="absolute -right-10 -top-14 size-36 rounded-full border border-white/10"
          aria-hidden="true"
        />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <UserAvatar
              name={name}
              imageUrl={runtime.staff.avatar_url}
              size="sm"
              className="size-11 border-2 border-[#d6bf85]"
            />
            <div className="min-w-0">
              <div className="truncate text-xs text-white/80">Utility workspace</div>
              <div className="truncate text-base font-semibold">{name}</div>
            </div>
          </div>
          <Link
            href="/staff/utility/notices"
            aria-label="Notices"
            className="grid min-h-12 min-w-12 place-items-center rounded-full bg-white/10 focus-visible:outline-2 focus-visible:outline-[#c8a96b]"
          >
            <Bell size={20} aria-hidden="true" />
          </Link>
        </div>
        <div className="relative mt-6">
          <p className="text-xs text-[#dfca92]">{dateLabel}</p>
          <h1 className="mt-1 text-[26px] font-semibold leading-tight tracking-[-0.04em]">
            Good day, {firstName}
          </h1>
          <p className="mt-1 text-xs text-white/80">Room turnover at your branch</p>
        </div>
      </header>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <StaffStatTile value={runtime.queueError ? "—" : waiting} label="Waiting" />
        <StaffStatTile value={runtime.queueError ? "—" : inProgress} label="In progress" />
        <StaffStatTile value={runtime.historyError ? "—" : recentReady} label="Recent ready" />
      </div>

      {runtime.historyError ? (
        <StaffFeedback error className="mt-4">
          Recent ready rooms could not be loaded.
        </StaffFeedback>
      ) : null}

      {runtime.queueError ? (
        <StaffFeedback error className="mt-4">
          Room turnover data is unavailable. Refresh when your connection returns.
        </StaffFeedback>
      ) : (
        <>
          <Link
            href="/staff/utility/work"
            className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#163a2b] px-4 text-sm font-semibold text-white shadow-[0_6px_14px_rgba(22,58,43,0.2)] focus-visible:outline-2 focus-visible:outline-[#c8a96b]"
          >
            <ClipboardList size={18} aria-hidden="true" />
            View turnover tasks
            <ChevronRight size={18} aria-hidden="true" />
          </Link>
          <div className="mt-6 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-[#163a2b]">Current rooms</h2>
            <Link
              href="/staff/utility/rooms"
              className="inline-flex min-h-12 items-center gap-1 text-xs font-semibold text-[#19563c]"
            >
              View rooms <ChevronRight size={15} />
            </Link>
          </div>
          {runtime.turnoverItems.length === 0 ? (
            <StaffEmptyState
              icon={<Sparkles size={20} />}
              title="No rooms waiting"
              description="New turnover tasks appear after an onsite service finishes."
            />
          ) : (
            <StaffCard className="overflow-hidden">
              {runtime.turnoverItems.slice(0, 4).map((item) => (
                <Link
                  key={item.taskId}
                  href={`/staff/utility/work/${item.taskId}`}
                  className="flex min-h-16 items-center gap-3 border-b border-[#eee8dd] px-4 py-3 last:border-0 focus-visible:outline-2 focus-visible:outline-[#c8a96b]"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#f3e9d6] text-[#76501a]">
                    <DoorOpen size={21} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{item.roomName}</span>
                    <span className="block truncate text-xs text-[#65746b]">
                      {item.serviceName}
                    </span>
                  </span>
                  <StaffStatusChip tone={item.status === "open" ? "gold" : "green"}>
                    {statusLabel(item)}
                  </StaffStatusChip>
                </Link>
              ))}
            </StaffCard>
          )}
        </>
      )}

      <StaffCard className="mt-5 flex items-center gap-3 p-4">
        <QrCode size={22} className="shrink-0 text-[#19563c]" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">Attendance scan</div>
          <p className="text-xs text-[#65746b]">
            Use the existing Staff QR scanner for attendance.
          </p>
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
