"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock3, DoorOpen } from "lucide-react";
import {
  StaffButton,
  StaffCard,
  StaffFeedback,
  StaffScreen,
  StaffScreenHeader,
  StaffStatusChip,
} from "@/components/features/staff-pwa/native-foundation";
import { invalidateStaffSafeMemory } from "@/components/features/staff-pwa/safe-memory";
import {
  markRoomReadyAction,
  startRoomCleaningAction,
} from "@/app/(dashboard)/staff/utility/actions";
import type { UtilityRoomTurnoverItem } from "@/lib/staff-pwa/utility-runtime";

function displayTime(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

export function UtilityRoomDetail({
  item,
  staffId,
}: {
  item: UtilityRoomTurnoverItem;
  staffId: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(item.status);
  const [owned, setOwned] = useState(item.assignedToStaffId === staffId);
  const [confirmReady, setConfirmReady] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const isTeammateTask = status === "in_progress" && !owned;

  function updateAfterMutation(next: "in_progress" | "completed") {
    setStatus(next);
    setOwned(true);
    setConfirmReady(false);
    setFeedback(next === "completed" ? "Room marked ready." : "Cleaning started.");
    invalidateStaffSafeMemory(["utilityHome", "utilityTasks", "utilityRooms"]);
    router.refresh();
  }

  function startCleaning() {
    setError(null);
    setFeedback(null);
    startTransition(async () => {
      const result = await startRoomCleaningAction(item.taskId);
      if (result.ok) updateAfterMutation("in_progress");
      else setError(result.error ?? "Could not start cleaning. Refresh the task and try again.");
    });
  }

  function markReady() {
    setError(null);
    setFeedback(null);
    startTransition(async () => {
      const result = await markRoomReadyAction(item.taskId);
      if (result.ok) updateAfterMutation("completed");
      else {
        setConfirmReady(false);
        setError(result.error ?? "Could not mark this room ready. Refresh the task and try again.");
      }
    });
  }

  return (
    <StaffScreen>
      <Link
        href="/staff/utility/work"
        className="mb-4 inline-flex min-h-12 items-center gap-2 text-sm font-semibold text-[#19563c]"
      >
        <ArrowLeft size={18} aria-hidden="true" /> Back to tasks
      </Link>
      <StaffScreenHeader
        title={item.roomName}
        subtitle={item.resourceType ?? "Room turnover"}
        trailing={
          <StaffStatusChip tone={status === "open" ? "gold" : "green"}>
            {status === "completed"
              ? "Ready"
              : status === "in_progress"
                ? "In progress"
                : "Waiting"}
          </StaffStatusChip>
        }
      />
      <StaffCard className="overflow-hidden">
        <div className="flex items-center gap-3 border-b border-[#eee8dd] p-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#f3e9d6] text-[#76501a]">
            <DoorOpen size={23} />
          </span>
          <div className="min-w-0">
            <div className="text-xs text-[#65746b]">Turnover after</div>
            <div className="truncate text-base font-semibold">{item.serviceName}</div>
          </div>
        </div>
        <div className="space-y-2 p-4 text-sm text-[#526358]">
          <div className="flex items-center gap-2">
            <Clock3 size={16} aria-hidden="true" /> Opened{" "}
            {displayTime(item.createdAt) ?? "recently"}
          </div>
          {item.startedAt ? (
            <div>Cleaning started {displayTime(item.startedAt) ?? "earlier"}</div>
          ) : null}
          {status === "completed" && item.completedAt ? (
            <div>Ready since {displayTime(item.completedAt) ?? "recently"}</div>
          ) : null}
        </div>
      </StaffCard>

      {error ? (
        <StaffFeedback error className="mt-4">
          {error}
        </StaffFeedback>
      ) : null}
      {feedback ? <StaffFeedback className="mt-4">{feedback}</StaffFeedback> : null}

      {status === "completed" ? (
        <StaffCard className="mt-5 p-5 text-center">
          <CheckCircle2 size={40} className="mx-auto text-[#19563c]" aria-hidden="true" />
          <h2 className="mt-3 text-lg font-semibold">Room ready</h2>
          <p className="mt-1 text-sm text-[#65746b]">This turnover task is complete.</p>
          <Link
            href="/staff/utility/work"
            className="mt-4 inline-flex min-h-12 items-center text-sm font-semibold text-[#19563c]"
          >
            View more tasks
          </Link>
        </StaffCard>
      ) : isTeammateTask ? (
        <StaffFeedback className="mt-5">
          This room is being cleaned by another Utility team member.
        </StaffFeedback>
      ) : status === "open" ? (
        <StaffButton className="mt-5 w-full" onClick={startCleaning} disabled={pending}>
          {pending ? "Starting…" : "Start cleaning"}
        </StaffButton>
      ) : confirmReady ? (
        <StaffCard className="mt-5 p-4">
          <h2 className="text-base font-semibold">Mark room ready?</h2>
          <p className="mt-1 text-sm text-[#65746b]">
            This completes the turnover task for {item.roomName}.
          </p>
          <div className="mt-4 flex gap-2">
            <StaffButton
              variant="secondary"
              className="flex-1"
              onClick={() => setConfirmReady(false)}
              disabled={pending}
            >
              Cancel
            </StaffButton>
            <StaffButton className="flex-1" onClick={markReady} disabled={pending}>
              {pending ? "Saving…" : "Confirm ready"}
            </StaffButton>
          </div>
        </StaffCard>
      ) : (
        <StaffButton className="mt-5 w-full" onClick={() => setConfirmReady(true)}>
          Mark room ready
        </StaffButton>
      )}
    </StaffScreen>
  );
}
