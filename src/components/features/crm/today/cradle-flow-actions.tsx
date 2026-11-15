"use client";

import { useEffect } from "react";
import { ArrowLeftRight, Banknote, Plus, ReceiptText, RotateCcw } from "lucide-react";
import { useAdministrativeBookingModal } from "@/components/features/bookings/administrative-booking-modal-provider";
import { CrmActionCard, type CrmCardTone } from "@/components/features/crm/shared/crm-cards";
import type { FinancialEntryMode } from "@/components/features/cash-flow/record-financial-entry-modal";
import type { CradleFlowBooking } from "@/lib/crm/cradle-flow";

type ActionCardProps = {
  title: string;
  description: string;
  shortcut: string;
  icon: React.ReactNode;
  tone: CrmCardTone;
  onClick: () => void;
};

function ActionCard({
  title,
  description,
  shortcut,
  icon,
  tone,
  onClick,
}: ActionCardProps) {
  return (
    <CrmActionCard
      title={title}
      description={description}
      icon={icon}
      tone={tone}
      onClick={onClick}
      className="min-h-20"
      trailing={
        <kbd className="rounded-md border border-black/10 bg-white/90 px-1.5 py-0.5 text-[10px] font-bold text-[var(--cs-text-secondary)] shadow-2xs">
          {shortcut}
        </kbd>
      }
    />
  );
}

export function CradleFlowActions({
  pendingBooking,
  onResumePending,
  onOpenFinancialEntry,
}: {
  pendingBooking: CradleFlowBooking | null;
  onResumePending: (booking: CradleFlowBooking) => void;
  onOpenFinancialEntry: (mode: FinancialEntryMode) => void;
}) {
  const { openBookingModal } = useAdministrativeBookingModal();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
      if (target instanceof HTMLElement && target.isContentEditable) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (event.key === "F1") openBookingModal({ mode: "walkin" });
      if (event.key === "F2") onOpenFinancialEntry("customer_payment");
      if (event.key === "F3") onOpenFinancialEntry("expense");
      if (event.key === "F4") onOpenFinancialEntry("other_entry");
      if (["F1", "F2", "F3", "F4"].includes(event.key)) event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpenFinancialEntry, openBookingModal]);

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Primary front desk actions">
      <ActionCard
        title="NEW BOOKING"
        description="Create a booking, walk-in or Home Service"
        shortcut="F1"
        icon={<Plus className="size-5" />}
        tone="success"
        onClick={() => openBookingModal({ mode: "walkin" })}
      />
      <ActionCard
        title="RECORD PAYMENT"
        description="Collect payments and settle visits"
        shortcut="F2"
        icon={<Banknote className="size-5" />}
        tone="info"
        onClick={() => onOpenFinancialEntry("customer_payment")}
      />
      <ActionCard
        title="RECORD EXPENSES"
        description="Log operational expenses"
        shortcut="F3"
        icon={<ReceiptText className="size-5" />}
        tone="warning"
        onClick={() => onOpenFinancialEntry("expense")}
      />
      <ActionCard
        title="CASH OPERATIONS"
        description="Adjust cash or transfer funds"
        shortcut="F4"
        icon={<ArrowLeftRight className="size-5" />}
        tone="neutral"
        onClick={() => onOpenFinancialEntry("other_entry")}
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
