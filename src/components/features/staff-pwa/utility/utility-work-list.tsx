"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  DoorOpen,
  Loader2,
  Sparkles,
  Play,
  AlertCircle,
} from "lucide-react";
import type {
  UtilityRoomTurnoverItem,
  UtilityWorkspaceRuntime,
} from "@/lib/staff-pwa/utility-runtime";
import {
  startRoomCleaningAction,
  markRoomReadyAction,
} from "@/app/(dashboard)/staff/utility/actions";

type Props = {
  runtime: UtilityWorkspaceRuntime;
};

function timeLabel(value: string | null, prefix = "Completed") {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return prefix;
  }

  return `${prefix} ${date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function RoomCard({ item }: { item: UtilityRoomTurnoverItem }) {
  const [isPending, startTransition] = useTransition();
  const [currentStatus, setCurrentStatus] = useState<"open" | "in_progress" | "completed">(item.status);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleStartCleaning = () => {
    setErrorMessage(null);
    startTransition(async () => {
      const res = await startRoomCleaningAction(item.taskId);
      if (res.ok) {
        setCurrentStatus("in_progress");
      } else {
        setErrorMessage(res.error ?? "Failed to start cleaning.");
      }
    });
  };

  const handleMarkReady = () => {
    setErrorMessage(null);
    startTransition(async () => {
      const res = await markRoomReadyAction(item.taskId);
      if (res.ok) {
        setCurrentStatus("completed");
      } else {
        setErrorMessage(res.error ?? "Failed to mark room ready.");
      }
    });
  };

  if (currentStatus === "completed") {
    return (
      <article
        data-testid="turnover-card"
        data-turnover-status="completed"
        className="rounded-[20px] border border-[#D5E6D8] bg-[#F4F9F5] p-4 shadow-[0_5px_18px_rgba(30,41,59,0.03)]"
      >
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-full bg-[#E3F2E6] text-[#1E744A]">
            <CheckCircle2 size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[14px] font-bold text-[#1D4733]">{item.roomName}</h2>
            <p className="text-[10px] text-[#426E58]">Room is clean and marked ready.</p>
          </div>
          <span className="rounded-full bg-[#D5EED9] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.04em] text-[#1B6A41]">
            Ready
          </span>
        </div>
      </article>
    );
  }

  const isCleaning = currentStatus === "in_progress";

  return (
    <article
      data-testid="turnover-card"
      data-turnover-status={currentStatus}
      className="rounded-[20px] border border-[#E8E2D9] bg-white p-4 shadow-[0_5px_18px_rgba(30,41,59,0.045)]"
    >
      <div className="flex items-start gap-3">
        <div
          className={`grid size-11 shrink-0 place-items-center rounded-[14px] ${
            isCleaning ? "bg-[#E0F2FE] text-[#0369A1]" : "bg-[#FFF1DA] text-[#926329]"
          }`}
        >
          <DoorOpen size={20} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="truncate text-[15px] font-bold text-[#203548]">
                {item.roomName}
              </h2>
              <p className="mt-0.5 truncate text-[10.5px] text-[#7B8794]">
                {item.serviceName}
              </p>
            </div>

            {isCleaning ? (
              <span
                data-testid="turnover-status-badge"
                className="shrink-0 rounded-full bg-[#E0F2FE] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.04em] text-[#0369A1]"
              >
                Cleaning
              </span>
            ) : (
              <span
                data-testid="turnover-status-badge"
                className="shrink-0 rounded-full bg-[#FFF2D9] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.04em] text-[#875A20]"
              >
                Needs Cleaning
              </span>
            )}
          </div>

          <div className="mt-3 flex items-center gap-1.5 text-[10px] text-[#718092]">
            <Clock3 size={12} />
            {isCleaning
              ? timeLabel(item.startedAt, "Started") ?? "Cleaning in progress"
              : timeLabel(item.completedAt, "Completed") ?? "Service completed"}
          </div>
        </div>
      </div>

      {errorMessage ? (
        <div
          data-testid="turnover-error"
          className="mt-3 flex items-center gap-2 rounded-[12px] border border-[#F8D7DA] bg-[#FFF5F5] px-3 py-2 text-[10.5px] text-[#9E2A2B]"
        >
          <AlertCircle size={14} className="shrink-0" />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      <div className="mt-4">
        {isCleaning ? (
          <button
            type="button"
            data-testid="mark-ready-button"
            onClick={handleMarkReady}
            disabled={isPending}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[13px] bg-[#0D6548] text-[12px] font-bold text-white transition active:scale-[0.99] disabled:opacity-70"
          >
            {isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Marking ready...</span>
              </>
            ) : (
              <>
                <Sparkles size={16} />
                <span>Mark Room Ready</span>
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            data-testid="start-cleaning-button"
            onClick={handleStartCleaning}
            disabled={isPending}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[13px] bg-[#224A3D] text-[12px] font-bold text-white transition active:scale-[0.99] disabled:opacity-70"
          >
            {isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Starting cleaning...</span>
              </>
            ) : (
              <>
                <Play size={14} />
                <span>Start Cleaning</span>
              </>
            )}
          </button>
        )}
      </div>
    </article>
  );
}

export function UtilityWorkList({ runtime }: Props) {
  return (
    <div className="min-h-full bg-[#F7F3EB]">
      <header className="sticky top-0 z-30 border-b border-[#EDE6DD] bg-[#FBFAF6]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[58px] max-w-[480px] items-center gap-3 px-3.5">
          <Link
            href="/staff/utility"
            aria-label="Back to Utility Today"
            className="grid size-9 place-items-center rounded-full border border-[#E4DED5] bg-white text-[#314658]"
          >
            <ArrowLeft size={17} />
          </Link>

          <div className="min-w-0 flex-1">
            <h1 className="text-[18px] font-bold tracking-[-0.025em] text-[#14283A]">
              Room Turnover
            </h1>

            <p className="text-[9.5px] text-[#758395]">Utility Work</p>
          </div>

          <span
            data-testid="waiting-count-badge"
            className="rounded-full bg-[#FFF2D9] px-2.5 py-1 text-[9.5px] font-bold text-[#875A20]"
          >
            {runtime.turnoverItems.length} waiting
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-[480px] px-3.5 pb-4 pt-3">
        {runtime.queueError ? (
          <section className="rounded-[18px] border border-[#F1D8C4] bg-[#FFF8F1] p-4">
            <div className="text-[13px] font-bold text-[#774D2F]">
              Room queue unavailable
            </div>

            <p className="mt-1 text-[10.5px] leading-4 text-[#85654E]">
              CradleHub could not read the room turnover queue. No room state was changed.
            </p>
          </section>
        ) : runtime.turnoverItems.length === 0 ? (
          <section
            data-testid="empty-turnover-queue"
            className="mt-6 flex flex-col items-center rounded-[22px] border border-[#E2EAE3] bg-white px-6 py-8 text-center shadow-[0_5px_18px_rgba(30,41,59,0.04)]"
          >
            <div className="grid size-14 place-items-center rounded-full bg-[#ECF7EE] text-[#25704F]">
              <CheckCircle2 size={24} />
            </div>

            <h2 className="mt-4 text-[15px] font-bold text-[#28453A]">
              No rooms waiting
            </h2>

            <p className="mt-1 max-w-[280px] text-[10.5px] leading-4 text-[#718092]">
              When an onsite service with an assigned room is completed, that room
              will appear here automatically.
            </p>
          </section>
        ) : (
          <div className="space-y-3">
            {runtime.turnoverItems.map((item) => (
              <RoomCard key={item.taskId} item={item} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}