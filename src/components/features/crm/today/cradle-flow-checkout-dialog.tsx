"use client";

import { useMemo, useState, useTransition } from "react";
import { Banknote, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  AdminDialog,
  AdminOverlayBody,
  AdminOverlayFooter,
  AdminOverlayHeader,
} from "@/components/shared/overlays";
import { formatCradleFlowMoney, type CradleFlowBooking } from "@/lib/crm/cradle-flow";

type MutationAction = (input: unknown) => Promise<{ success: boolean; error?: string }>;
const METHODS = [
  ["cash", "Cash"],
  ["gcash", "GCash"],
  ["maya", "Maya"],
  ["card", "Card"],
  ["other", "Other"],
] as const;

export function CradleFlowCheckoutDialog({
  booking,
  open,
  onOpenChange,
  paymentAction,
  onPaid,
}: {
  booking: CradleFlowBooking | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentAction?: MutationAction;
  onPaid: (booking: CradleFlowBooking, amountPaid: number, method: string) => void;
}) {
  const total = Number(booking?.price_paid ?? 0);
  const previouslyPaid = Number(booking?.amount_paid ?? 0);
  const balance = Math.max(0, total - previouslyPaid);
  const [method, setMethod] = useState("cash");
  const [amount, setAmount] = useState(() => balance.toFixed(2));
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const received = Number(amount || 0);
  const paymentApplied = Math.min(balance, Math.max(0, received));
  const finalSettlement = paymentApplied >= balance;
  const change = method === "cash" && finalSettlement ? Math.max(0, received - balance) : 0;

  const error = useMemo(() => {
    if (!paymentAction) return "Payment action is unavailable.";
    if (balance > 0 && !(received > 0)) return "Enter the amount received.";
    if (!finalSettlement && !reason.trim()) {
      return "Add an authorization reason for a partial payment.";
    }
    return null;
  }, [finalSettlement, paymentAction, reason, received]);

  function submit() {
    if (!booking || !paymentAction || error) return;
    const cumulativeAmount = previouslyPaid + paymentApplied;
    startTransition(async () => {
      const result = await paymentAction({
        bookingId: booking.id,
        paymentMethod: method,
        paymentStatus: finalSettlement ? "paid" : "pending",
        amountPaid: cumulativeAmount,
        paymentReference: reference.trim() || undefined,
        paymentPurpose: finalSettlement ? "final_settlement" : "partial",
        reason: finalSettlement ? undefined : reason.trim(),
      });
      if (!result.success) {
        toast.error(result.error ?? "Payment could not be saved.");
        return;
      }
      onPaid(booking, cumulativeAmount, method);
      onOpenChange(false);
      toast.success(finalSettlement ? "Payment complete" : "Partial payment saved");
    });
  }

  if (!booking) return null;
  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      placement="center"
      size="md"
      ariaLabel="Checkout"
    >
      <AdminOverlayHeader
        title="Checkout"
        description={`${booking.customer_name ?? "Customer"} · ${booking.service_name ?? "Service"}`}
      />
      <AdminOverlayBody className="grid gap-4">
        <div className="grid grid-cols-3 gap-2">
          {[
            ["Service total", formatCradleFlowMoney(total)],
            ["Paid earlier", formatCradleFlowMoney(previouslyPaid)],
            ["Balance due", formatCradleFlowMoney(balance)],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-3"
            >
              <div className="text-[10px] font-bold uppercase text-[var(--cs-text-muted)]">
                {label}
              </div>
              <div className="mt-1 text-sm font-extrabold text-[var(--cs-text)]">{value}</div>
            </div>
          ))}
        </div>
        <div>
          <span className="text-xs font-bold text-[var(--cs-text-secondary)]">Payment method</span>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {METHODS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMethod(value)}
                className={
                  method === value
                    ? "h-9 rounded-lg bg-[#164b36] text-xs font-bold text-white"
                    : "h-9 rounded-lg border border-[var(--cs-border)] text-xs font-bold text-[var(--cs-text)]"
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <label className="grid gap-1 text-xs font-bold text-[var(--cs-text-secondary)]">
          Amount received
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="h-11 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-base font-bold text-[var(--cs-text)]"
          />
        </label>
        {method !== "cash" ? (
          <label className="grid gap-1 text-xs font-bold text-[var(--cs-text-secondary)]">
            Reference number
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              className="h-10 rounded-lg border border-[var(--cs-border)] px-3 text-sm"
            />
          </label>
        ) : null}
        {!finalSettlement ? (
          <label className="grid gap-1 text-xs font-bold text-[var(--cs-text-secondary)]">
            Partial-payment authorization reason
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={2}
              className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm"
            />
          </label>
        ) : null}
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
          {finalSettlement
            ? `Applied ${formatCradleFlowMoney(balance)}${change ? ` · Change ${formatCradleFlowMoney(change)}` : ""}`
            : `${formatCradleFlowMoney(paymentApplied)} will be recorded; ${formatCradleFlowMoney(balance - paymentApplied)} remains due.`}
        </div>
      </AdminOverlayBody>
      <AdminOverlayFooter className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="cs-btn cs-btn-secondary h-10 rounded-lg px-4"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={Boolean(error) || isPending}
          title={error ?? undefined}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#164b36] px-4 text-sm font-bold text-white disabled:opacity-50"
        >
          {finalSettlement ? <CheckCircle2 className="size-4" /> : <Banknote className="size-4" />}
          {isPending ? "Saving…" : finalSettlement ? "Complete Payment" : "Save Partial Payment"}
        </button>
      </AdminOverlayFooter>
    </AdminDialog>
  );
}
