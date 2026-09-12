import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  DoorOpen,
  Sparkles,
} from "lucide-react";
import type {
  UtilityRoomTurnoverItem,
  UtilityWorkspaceRuntime,
} from "@/lib/staff-pwa/utility-runtime";

type Props = {
  runtime: UtilityWorkspaceRuntime;
};

function timeLabel(value: string | null) {
  if (!value) return "Completion time unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Completed";
  }

  return `Completed ${date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function RoomCard({
  item,
}: {
  item: UtilityRoomTurnoverItem;
}) {
  return (
    <article className="rounded-[20px] border border-[#E8E2D9] bg-white p-4 shadow-[0_5px_18px_rgba(30,41,59,0.045)]">
      <div className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-[#FFF1DA] text-[#926329]">
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

            <span className="shrink-0 rounded-full bg-[#FFF2D9] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.04em] text-[#875A20]">
              Needs Cleaning
            </span>
          </div>

          <div className="mt-3 flex items-center gap-1.5 text-[10px] text-[#718092]">
            <Clock3 size={12} />
            {timeLabel(item.completedAt)}
          </div>

          {item.customerName ? (
            <div className="mt-1.5 text-[10px] text-[#718092]">
              Previous service: {item.customerName}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4 rounded-[12px] border border-[#E6E9E5] bg-[#F7F9F7] px-3 py-2.5 text-[10px] leading-4 text-[#63736A]">
        This room was inherited from a completed onsite service.
        Turnover completion is not writable yet because CradleHub
        does not currently have an authoritative room-readiness
        state.
      </div>

      <button
        type="button"
        disabled
        className="mt-3 flex min-h-11 w-full cursor-not-allowed items-center justify-center gap-2 rounded-[13px] bg-[#E5EAE6] text-[11.5px] font-bold text-[#809087]"
      >
        <Sparkles size={15} />
        Mark Ready — backend connection required
      </button>
    </article>
  );
}

export function UtilityWorkList({
  runtime,
}: Props) {
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

            <p className="text-[9.5px] text-[#758395]">
              Utility Work
            </p>
          </div>

          <span className="rounded-full bg-[#FFF2D9] px-2.5 py-1 text-[9.5px] font-bold text-[#875A20]">
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
              CradleHub could not read the completed-room queue.
              No room state was changed.
            </p>
          </section>
        ) : runtime.turnoverItems.length === 0 ? (
          <section className="mt-6 flex flex-col items-center rounded-[22px] border border-[#E2EAE3] bg-white px-6 py-8 text-center shadow-[0_5px_18px_rgba(30,41,59,0.04)]">
            <div className="grid size-14 place-items-center rounded-full bg-[#ECF7EE] text-[#25704F]">
              <CheckCircle2 size={24} />
            </div>

            <h2 className="mt-4 text-[15px] font-bold text-[#28453A]">
              No rooms waiting
            </h2>

            <p className="mt-1 max-w-[280px] text-[10.5px] leading-4 text-[#718092]">
              When an onsite service with an assigned room is
              completed, that room will appear here automatically.
            </p>
          </section>
        ) : (
          <div className="space-y-3">
            {runtime.turnoverItems.map((item) => (
              <RoomCard
                key={`${item.bookingId}:${item.resourceId}`}
                item={item}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}