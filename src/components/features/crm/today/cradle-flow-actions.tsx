"use client";

import { useEffect } from "react";
import { CalendarDays, Home, Plus, RotateCcw, UserRoundPlus } from "lucide-react";
import { useAdministrativeBookingModal } from "@/components/features/bookings/administrative-booking-modal-provider";
import type { CradleFlowBooking } from "@/lib/crm/cradle-flow";

type ActionCardProps = {
  title: string;
  description: string;
  shortcut: string;
  icon: React.ReactNode;
  primary?: boolean;
  onClick: () => void;
};

function ActionCard({
  title,
  description,
  shortcut,
  icon,
  primary = false,
  onClick,
}: ActionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        primary
          ? "group flex min-h-24 items-center gap-3 rounded-xl border border-emerald-800/20 bg-[linear-gradient(135deg,#0f4c35,#1f6649)] px-4 text-left text-white shadow-[var(--cs-shadow-sm)] transition hover:-translate-y-0.5 hover:shadow-[var(--cs-shadow-md)]"
          : "group flex min-h-24 items-center gap-3 rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] px-4 text-left shadow-[var(--cs-shadow-xs)] transition hover:-translate-y-0.5 hover:border-[var(--cs-border-strong)] hover:shadow-[var(--cs-shadow-sm)]"
      }
    >
      <span
        className={
          primary
            ? "grid size-11 shrink-0 place-items-center rounded-full bg-white/15 text-white"
            : "grid size-11 shrink-0 place-items-center rounded-full bg-[var(--cs-sand-mist)] text-[var(--cs-sand-dark)]"
        }
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={
            primary
              ? "block text-sm font-extrabold tracking-wide text-white"
              : "block text-sm font-extrabold tracking-wide text-[var(--cs-text)]"
          }
        >
          {title}
        </span>
        <span
          className={
            primary
              ? "mt-1 block text-xs text-white/75"
              : "mt-1 block text-xs text-[var(--cs-text-muted)]"
          }
        >
          {description}
        </span>
      </span>
      <kbd
        className={
          primary ? "text-[10px] text-white/65" : "text-[10px] text-[var(--cs-text-muted)]"
        }
      >
        {shortcut}
      </kbd>
    </button>
  );
}

export function CradleFlowActions({
  pendingBooking,
  onResumePending,
}: {
  pendingBooking: CradleFlowBooking | null;
  onResumePending: (booking: CradleFlowBooking) => void;
}) {
  const { openBookingModal } = useAdministrativeBookingModal();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      if (event.key === "F1") openBookingModal({ mode: "walkin" });
      if (event.key === "F2") openBookingModal({ mode: "walkin" });
      if (event.key === "F3") openBookingModal({ mode: "standard_future" });
      if (event.key === "F4") openBookingModal({ mode: "home_service" });
      if (["F1", "F2", "F3", "F4"].includes(event.key)) event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openBookingModal]);

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Booking shortcuts">
      <ActionCard
        title="NEW BOOKING"
        description="Create any booking"
        shortcut="F1"
        icon={<Plus className="size-5" />}
        primary
        onClick={() => openBookingModal({ mode: "walkin" })}
      />
      <ActionCard
        title="WALK-IN"
        description="Start an in-spa visit"
        shortcut="F2"
        icon={<UserRoundPlus className="size-5" />}
        onClick={() => openBookingModal({ mode: "walkin" })}
      />
      <ActionCard
        title="BOOK FOR LATER"
        description="Phone or future booking"
        shortcut="F3"
        icon={<CalendarDays className="size-5" />}
        onClick={() => openBookingModal({ mode: "standard_future" })}
      />
      <ActionCard
        title="HOME SERVICE"
        description="Create and prepare dispatch"
        shortcut="F4"
        icon={<Home className="size-5" />}
        onClick={() => openBookingModal({ mode: "home_service" })}
      />
      {pendingBooking ? (
        <button
          type="button"
          onClick={() => onResumePending(pendingBooking)}
          className="flex items-center gap-2 rounded-lg border border-dashed border-[var(--cs-sand)] bg-[var(--cs-sand-tint)] px-3 py-2 text-left text-xs font-bold text-[var(--cs-sand-dark)] sm:col-span-2 xl:col-span-4"
        >
          <RotateCcw className="size-4" />
          Resume pending · {pendingBooking.customer_name ?? "Unfinished booking"}
        </button>
      ) : null}
    </section>
  );
}
