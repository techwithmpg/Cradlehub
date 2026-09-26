"use client";

import { useEffect } from "react";
import { CalendarDays, ChevronRight, Home, Plus, RotateCcw, UserRoundPlus } from "lucide-react";
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
          ? "group flex min-h-[72px] items-center gap-3.5 rounded-2xl bg-[#0B472C] px-4 py-3 text-left text-white shadow-xs transition hover:bg-[#083823] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
          : "group flex min-h-[72px] items-center gap-3.5 rounded-2xl border border-[var(--cs-border-soft)] bg-white px-4 py-3 text-left shadow-xs transition hover:border-stone-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
      }
    >
      <span
        className={
          primary
            ? "flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white"
            : "flex size-10 shrink-0 items-center justify-center rounded-full bg-[#FBF3ED] text-[#C27848]"
        }
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={
            primary
              ? "block text-sm font-bold text-white"
              : "block text-sm font-bold text-[var(--cs-text)]"
          }
        >
          {title}
        </span>
        <span
          className={
            primary
              ? "mt-0.5 block text-xs text-white/70"
              : "mt-0.5 block text-xs text-[var(--cs-text-muted)]"
          }
        >
          {description}
        </span>
      </span>
      <span className="flex items-center gap-1">
        <kbd
          className={
            primary
              ? "rounded px-1.5 py-0.5 text-[11px] font-semibold text-white/70"
              : "rounded px-1.5 py-0.5 text-[11px] font-semibold text-[var(--cs-text-muted)]"
          }
        >
          {shortcut}
        </kbd>
        <ChevronRight
          className={
            primary
              ? "size-3.5 text-white/50 group-hover:text-white transition-colors"
              : "size-3.5 text-stone-400 group-hover:text-stone-600 transition-colors"
          }
        />
      </span>
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
        title="New Booking"
        description="Create any booking"
        shortcut="F1"
        icon={<Plus className="size-5" />}
        primary
        onClick={() => openBookingModal({ mode: "walkin" })}
      />
      <ActionCard
        title="Walk-In"
        description="Start an in-spa visit"
        shortcut="F2"
        icon={<UserRoundPlus className="size-5" />}
        onClick={() => openBookingModal({ mode: "walkin" })}
      />
      <ActionCard
        title="Book for Later"
        description="Phone or future booking"
        shortcut="F3"
        icon={<CalendarDays className="size-5" />}
        onClick={() => openBookingModal({ mode: "standard_future" })}
      />
      <ActionCard
        title="Home Service"
        description="Create and prepare dispatch"
        shortcut="F4"
        icon={<Home className="size-5" />}
        onClick={() => openBookingModal({ mode: "home_service" })}
      />
      {pendingBooking ? (
        <button
          type="button"
          onClick={() => onResumePending(pendingBooking)}
          className="flex items-center gap-2 rounded-xl border border-dashed border-[var(--cs-sand)] bg-[var(--cs-sand-tint)] px-3 py-2 text-left text-xs font-bold text-[var(--cs-sand-dark)] sm:col-span-2 xl:col-span-4"
        >
          <RotateCcw className="size-4" />
          Resume pending · {pendingBooking.customer_name ?? "Unfinished booking"}
        </button>
      ) : null}
    </section>
  );
}
