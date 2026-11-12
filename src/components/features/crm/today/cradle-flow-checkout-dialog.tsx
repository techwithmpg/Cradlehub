"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Banknote, CheckCircle2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  AdminDialog,
  AdminOverlayBody,
  AdminOverlayFooter,
  AdminOverlayHeader,
} from "@/components/shared/overlays";
import { formatCradleFlowMoney, type CradleFlowBooking } from "@/lib/crm/cradle-flow";
import { notifyBookingsChanged } from "@/lib/bookings/bookings-client-events";

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
  // Support both order-backed and single-line bookings seamlessly in 1 click!
  const isOrderBacked = Boolean(booking?.order_id && Number(booking?.order_total_amount ?? 0) > 0);
  const total = isOrderBacked
    ? Number(booking?.order_total_amount ?? booking?.price_paid ?? 0)
    : Number(booking?.price_paid ?? 0);
  const previouslyPaid = isOrderBacked
    ? Number(booking?.order_amount_paid ?? booking?.amount_paid ?? 0)
    : Number(booking?.amount_paid ?? 0);
  const balance = Math.max(0, total - previouslyPaid);

  const [method, setMethod] = useState("cash");
  const [amount, setAmount] = useState(() => balance.toFixed(2));
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const submittingRef = useRef(false);

  // Sync default amount whenever a different booking is opened
  useEffect(() => {
    if (open && booking) {
      setAmount(balance.toFixed(2));
      setReference("");
      setReason("");
    }
  }, [open, booking, balance]);

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
  }, [balance, finalSettlement, paymentAction, reason, received]);

  function submit() {
    if (!booking || !paymentAction || error || submittingRef.current) return;
    submittingRef.current = true;
    const cumulativeAmount = Number(booking.amount_paid ?? 0) + paymentApplied;
    startTransition(async () => {
      try {
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
        notifyBookingsChanged();
        onOpenChange(false);
        toast.success(finalSettlement ? "Payment complete!" : "Partial payment saved!");
      } catch (failure) {
        toast.error(failure instanceof Error ? failure.message : "Payment could not be saved.");
      } finally {
        submittingRef.current = false;
      }
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
        title="Quick Checkout"
        description={`${booking.customer_name ?? "Customer"} · ${booking.service_name ?? "Service"}`}
      />
      <AdminOverlayBody className="grid gap-4">
        <div className="grid grid-cols-3 gap-2">
          {[
            [isOrderBacked ? "Order total" : "Service total", formatCradleFlowMoney(total)],
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

        <label className="grid gap-1.5 text-xs font-bold text-[var(--cs-text-secondary)]">
          Amount received (PHP)
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="h-10 rounded-lg border border-[var(--cs-border)] bg-white px-3 text-sm font-bold text-[var(--cs-text)]"
          />
        </label>

        {method !== "cash" ? (
          <label className="grid gap-1.5 text-xs font-bold text-[var(--cs-text-secondary)]">
            Reference number (optional)
            <input
              type="text"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="GCash / Maya / Card ref..."
              className="h-10 rounded-lg border border-[var(--cs-border)] bg-white px-3 text-sm text-[var(--cs-text)]"
            />
          </label>
        ) : null}

        {!finalSettlement ? (
          <label className="grid gap-1.5 text-xs font-bold text-[var(--cs-text-secondary)]">
            Reason for partial payment
            <input
              type="text"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explain why balance remains open..."
              className="h-10 rounded-lg border border-[var(--cs-border)] bg-white px-3 text-sm text-[var(--cs-text)]"
            />
          </label>
        ) : null}

        {change > 0 ? (
          <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-950">
            <span className="flex items-center gap-1.5">
              <Banknote className="size-4 text-emerald-700" />
              Change to return
            </span>
            <span>{formatCradleFlowMoney(change)}</span>
          </div>
        ) : null}

        {error ? <p className="text-xs font-semibold text-red-600">{error}</p> : null}
      </AdminOverlayBody>
      <AdminOverlayFooter className="flex flex-wrap items-center justify-between gap-2">
        {booking.order_id ? (
          <Link
            href="/crm/cash-flow"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--cs-text-muted)] hover:text-[var(--cs-text)]"
          >
            <ExternalLink className="size-3.5" />
            Split / View in Cash Flow
          </Link>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
            className="cs-btn cs-btn-secondary h-10 rounded-lg px-4"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isPending || Boolean(error)}
            onClick={submit}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#164b36] px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            <CheckCircle2 className="size-4" />
            {isPending
              ? "Saving…"
              : finalSettlement
                ? `Confirm Paid (${formatCradleFlowMoney(paymentApplied)})`
                : "Save Partial Payment"}
          </button>
        </div>
      </AdminOverlayFooter>
    </AdminDialog>
  );
}
