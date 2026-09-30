"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Banknote, Plus, ReceiptText, RotateCcw } from "lucide-react";
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
          ? "group flex min-h-20 items-center gap-3 rounded-xl border border-emerald-800/20 bg-[linear-gradient(135deg,#0f4c35,#1f6649)] px-3 text-left text-white shadow-[var(--cs-shadow-sm)] transition hover:-translate-y-0.5 hover:shadow-[var(--cs-shadow-md)]"
          : "group flex min-h-20 items-center gap-3 rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-left shadow-[var(--cs-shadow-xs)] transition hover:-translate-y-0.5 hover:border-[var(--cs-border-strong)] hover:shadow-[var(--cs-shadow-sm)]"
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
              ? "block text-xs font-extrabold tracking-wide text-white"
              : "block text-xs font-extrabold tracking-wide text-[var(--cs-text)]"
          }
        >
          {title}
        </span>
        <span
          className={
            primary
              ? "mt-0.5 block text-[11px] text-white/75"
              : "mt-0.5 block text-[11px] text-[var(--cs-text-muted)]"
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
  const router = useRouter();
  const { openBookingModal } = useAdministrativeBookingModal();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      if (event.key === "F1") openBookingModal({ mode: "walkin" });
      if (event.key === "F2") router.push("/crm/cash-flow?entry=payment");
      if (event.key === "F3") router.push("/crm/cash-flow?entry=expense");
      if (event.key === "F4") router.push("/crm/cash-flow?entry=cash-operations");
      if (["F1", "F2", "F3", "F4"].includes(event.key)) event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openBookingModal, router]);

  return (
    <section className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4" aria-label="Primary front desk actions">
      <ActionCard
        title="NEW BOOKING"
        description="Create a booking, walk-in or Home Service"
        shortcut="F1"
        icon={<Plus className="size-5" />}
        primary
        onClick={() => openBookingModal({ mode: "walkin" })}
      />
      <ActionCard
        title="RECORD PAYMENT"
        description="Collect payments and settle visits"
        shortcut="F2"
        icon={<Banknote className="size-5" />}
        onClick={() => router.push("/crm/cash-flow?entry=payment")}
      />
      <ActionCard
        title="RECORD EXPENSES"
        description="Log operational expenses"
        shortcut="F3"
        icon={<ReceiptText className="size-5" />}
        onClick={() => router.push("/crm/cash-flow?entry=expense")}
      />
      <ActionCard
        title="CASH OPERATIONS"
        description="Adjust cash or transfer funds"
        shortcut="F4"
        icon={<ArrowLeftRight className="size-5" />}
        onClick={() => router.push("/crm/cash-flow?entry=cash-operations")}
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
