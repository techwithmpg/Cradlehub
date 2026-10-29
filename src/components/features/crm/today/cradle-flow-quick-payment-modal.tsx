"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Info, Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { FinancialEntryContext } from "@/lib/cash-flow/financial-entry-context";
import type { MaskedAccountOption, PayableOrderOption } from "@/lib/cash-flow/cash-flow-types";
import {
  FINANCIAL_PAYMENT_RAILS,
  isPaymentMethodCompatibleWithAccount,
  type FinancialPaymentMethod,
} from "@/lib/cash-flow/financial-contract";
import {
  recordLegacyBookingPaymentAction,
  recordOrderPaymentAction,
} from "@/lib/cash-flow/cash-flow-actions";
import {
  isQuickPaymentEligible,
} from "@/components/features/cash-flow/cash-flow-today-eligibility";
import {
  printThermalReceipt,
  type PrintableReceiptData,
} from "@/lib/cash-flow/receipt-printer";

export { isQuickPaymentEligible };

type Tender = {
  id: string;
  method: FinancialPaymentMethod;
  amount: string;
  cashReceived?: string;
  accountId: string;
  reference: string;
};

type QueueTab = "ready" | "partial" | "all";

const methodLabels: Record<FinancialPaymentMethod, string> = {
  cash: "Cash",
  gcash: "GCash",
  maya: "Maya",
  card: "Card",
  bank_transfer: "Bank transfer",
};

const php = (amount: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);

const cents = (amount: number) => Math.round(amount * 100);

export function CradleFlowQuickPaymentModal({
  data,
  loading,
  error,
  requestedOrderId,
  initialPaymentMethod,
  allowLegacyCheckout,
  onClose,
  onRetry,
  onSuccess,
  onLegacyCheckout,
}: {
  data: FinancialEntryContext | null;
  loading: boolean;
  error?: string | null;
  requestedOrderId?: string;
  initialPaymentMethod?: FinancialPaymentMethod;
  allowLegacyCheckout?: boolean;
  onClose: () => void;
  onRetry: () => void;
  onSuccess: () => void;
  onLegacyCheckout: () => void;
}) {
  const [tab, setTab] = useState<QueueTab>(requestedOrderId ? "all" : "ready");
  const [selectedId, setSelectedId] = useState(requestedOrderId ?? "");
  const [tenderDraft, setTenderDraft] = useState<{ key: string; lines: Tender[] } | null>(null);
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [busy, setBusy] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [confirmedReceipt, setConfirmedReceipt] = useState<PrintableReceiptData | null>(null);
  const submitting = useRef(false);
  const attempt = useRef<{ signature: string; key: string } | null>(null);

  const eligible = useMemo(() => (data?.payableOrders ?? []).filter(isQuickPaymentEligible), [data]);
  const ready = eligible.filter((order) => order.readyForCheckout && order.amountPaid === 0);
  const partial = eligible.filter((order) => order.amountPaid > 0);
  const visible = tab === "ready" ? ready : tab === "partial" ? partial : eligible;
  const requestedOrderEligible = !requestedOrderId || eligible.some((order) => order.id === requestedOrderId);
  const selected = requestedOrderEligible
    ? visible.find((order) => order.id === selectedId) ?? (selectedId ? undefined : visible[0])
    : undefined;
  const accounts = useMemo(() => data?.accounts ?? [], [data]);
  const accountChoices = (method: FinancialPaymentMethod): MaskedAccountOption[] =>
    accounts.filter(
      (account) =>
        isPaymentMethodCompatibleWithAccount(method, account.accountType) &&
        (account.branchId === null || account.branchId === data?.branchId)
    );
  const firstAccount = (method: FinancialPaymentMethod) => accountChoices(method)[0]?.id ?? "";

  const initialMethod =
    initialPaymentMethod && accountChoices(initialPaymentMethod).length > 0
      ? initialPaymentMethod
      : "cash";

  // Derive the default payment line from the selected payable order.
  // Only user edits are stored as state, eliminating the reset effect.
  const tenderKey = selected
    ? `${data?.branchId ?? ""}:${data?.businessDate ?? ""}:${selected.sourceKind}:${selected.id}:${selected.remainingBalance}:${initialMethod}`
    : "";

  const defaultTenders: Tender[] = selected
    ? [
        {
          id: `default-${selected.id}`,
          method: initialMethod,
          accountId: firstAccount(initialMethod),
          amount: selected.remainingBalance.toFixed(2),
          cashReceived: "",
          reference: "",
        },
      ]
    : [];

  const tenders = tenderDraft?.key === tenderKey ? tenderDraft.lines : defaultTenders;

  function setTenders(next: Tender[] | ((previous: Tender[]) => Tender[])) {
    setTenderDraft((previous) => {
      const current = previous?.key === tenderKey ? previous.lines : defaultTenders;
      const lines = typeof next === "function" ? next(current) : next;
      return { key: tenderKey, lines };
    });
  }

  const totalCents = tenders.reduce((sum, line) => sum + cents(Number(line.amount) || 0), 0);
  const remainingCents = selected ? cents(selected.remainingBalance) : 0;
  const invalidTender =
    tenders.length === 0 ||
    tenders.some((line) => {
      const value = Number(line.amount);
      return (
        !Number.isFinite(value) ||
        cents(value) <= 0 ||
        cents(value) / 100 !== value ||
        !accountChoices(line.method).some((account) => account.id === line.accountId)
      );
    });

  // Cash Tender and Automatic Change Calculation
  const cashTenders = tenders.filter((line) => line.method === "cash");
  const hasCashTender = cashTenders.length > 0;
  const totalCashTenderCents = cashTenders.reduce(
    (sum, line) => sum + cents(Number(line.amount) || 0),
    0
  );

  const hasAnyCashReceivedEntered = cashTenders.some(
    (line) => line.cashReceived !== undefined && line.cashReceived.trim() !== ""
  );

  let cashReceivedError: string | null = null;
  let totalCashReceivedCents = 0;

  if (hasCashTender && hasAnyCashReceivedEntered) {
    for (const line of cashTenders) {
      const raw = line.cashReceived?.trim();
      if (raw) {
        const val = Number(raw);
        if (!Number.isFinite(val) || val < 0) {
          cashReceivedError = "Cash received must be a valid nonnegative amount.";
          break;
        }
        totalCashReceivedCents += cents(val);
      }
    }

    if (!cashReceivedError && totalCashReceivedCents < totalCashTenderCents) {
      cashReceivedError = `Insufficient cash received: physical cash (${php(totalCashReceivedCents / 100)}) is less than cash tender (${php(totalCashTenderCents / 100)}).`;
    }
  }

  const changeCents =
    hasCashTender && hasAnyCashReceivedEntered && !cashReceivedError
      ? Math.max(0, totalCashReceivedCents - totalCashTenderCents)
      : 0;

  const canSubmit = Boolean(
    data &&
    selected &&
    !error &&
    !loading &&
    !busy &&
    !invalidTender &&
    !cashReceivedError &&
    totalCents > 0 &&
    totalCents <= remainingCents
  );

  function updateTender(id: string, change: Partial<Tender>) {
    setPaymentError(null);
    setTenders((current) =>
      current.map((line) => {
        if (line.id !== id) return line;
        const updated = { ...line, ...change };
        if (updated.method !== "cash") {
          delete updated.cashReceived;
        }
        return updated;
      })
    );
  }

  function addTender() {
    const next: FinancialPaymentMethod = tenders.some((line) => line.method === "cash")
      ? "gcash"
      : "cash";
    const amount = Math.max(0, remainingCents - totalCents) / 100;
    setTenders((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        method: next,
        accountId: firstAccount(next),
        amount: amount > 0 ? amount.toFixed(2) : "",
        cashReceived: "",
        reference: "",
      },
    ]);
    setPaymentError(null);
  }

  async function recordPayment() {
    if (submitting.current || !canSubmit || !data || !selected) return;
    submitting.current = true;
    setBusy(true);
    setPaymentError(null);

    const payments = tenders.map((line) => ({
      amount: Number(line.amount),
      paymentMethod: line.method,
      financialAccountId: line.accountId,
      externalReference: line.reference.trim() || null,
    }));

    const signature = JSON.stringify({
      source: selected.sourceKind,
      id: selected.id,
      paid: selected.amountPaid,
      date: data.businessDate,
      payments,
      notes: notes.trim(),
    });

    if (attempt.current?.signature !== signature)
      attempt.current = { signature, key: crypto.randomUUID() };

    try {
      const result =
        selected.sourceKind === "legacy_booking"
          ? await recordLegacyBookingPaymentAction({
              bookingId: selected.id,
              branchId: data.branchId,
              expectedAmountPaid: selected.amountPaid,
              idempotencyKey: attempt.current!.key,
              payments,
              businessDate: data.businessDate,
              notes: notes.trim() || null,
            })
          : await recordOrderPaymentAction({
              orderId: selected.id,
              idempotencyKey: attempt.current!.key,
              payments,
              businessDate: data.businessDate,
              notes: notes.trim() || null,
            });

      if (result.ok) {
        const transactionId =
          ("data" in result &&
            result.data &&
            "transactionId" in result.data &&
            result.data.transactionId) ||
          `TXN-${selected.id.slice(0, 8)}`;

        const receiptData: PrintableReceiptData = {
          companyName: "CRADLE WELLNESS LIVING INC.",
          branchName: selected.branchName || "Main Spa",
          transactionId,
          orderNumber: selected.orderNumber,
          customerName: selected.customerName,
          customerPhone: selected.customerPhone,
          formattedDateTime: new Date().toLocaleString("en-PH", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          }),
          serviceDescription: selected.serviceDescription,
          visitType: selected.visitType,
          items: selected.payableItems?.length
            ? selected.payableItems.map((item) => ({
                description: item.description,
                amount: item.amount,
              }))
            : [{ description: selected.serviceDescription, amount: selected.totalAmount }],
          totalPayable: selected.totalAmount,
          alreadyPaid: selected.amountPaid,
          amountPaid: totalCents / 100,
          remainingBalance: Math.max(0, remainingCents - totalCents) / 100,
          payments: tenders.map((line) => ({
            method: methodLabels[line.method],
            amount: Number(line.amount) || 0,
            reference: line.reference.trim() || null,
            cashReceived:
              line.method === "cash" && line.cashReceived?.trim()
                ? Number(line.cashReceived)
                : null,
            change: line.method === "cash" ? changeCents / 100 : null,
          })),
          totalCashReceived:
            hasCashTender && hasAnyCashReceivedEntered ? totalCashReceivedCents / 100 : null,
          changeGiven: hasCashTender ? changeCents / 100 : null,
        };

        setConfirmedReceipt(receiptData);
        printThermalReceipt(receiptData);
        onSuccess();
      } else {
        setPaymentError(result.error || "Payment could not be recorded. Refresh before retrying.");
      }
    } catch (err) {
      setPaymentError(
        err instanceof Error
          ? err.message
          : "Payment result unknown. Verify the ledger before retrying."
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="flex h-[min(88dvh,850px)] w-[min(1220px,calc(100vw-28px))] max-w-none flex-col gap-0 overflow-hidden rounded-2xl border border-[#e9e2d8] bg-[#faf8f5] p-0 text-[#1e1916] shadow-2xl sm:max-w-none"
      >
        <header className="flex shrink-0 items-start justify-between border-b border-[#e9e2d8] bg-white px-5 py-4">
          <div>
            <DialogTitle className="text-xl font-bold">Record Payment</DialogTitle>
            <p className="mt-1 text-xs text-[#786d61]">
              Quick checkout for outstanding spa services
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close payment"
            className="rounded-lg p-1 text-[#786d61] hover:bg-[#f5f0e9]"
          >
            <X size={18} />
          </button>
        </header>

        {confirmedReceipt ? (
          <div className="flex items-center justify-between border-b border-emerald-200 bg-[#eaf5ee] px-5 py-3 text-xs text-[#14543e]">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="shrink-0 text-[#14543e]" />
              <div>
                <span className="font-bold">
                  Payment of {php(confirmedReceipt.amountPaid)} recorded successfully!
                </span>
                <span className="ml-2 text-[#4e6b5c]">
                  (Txn: {confirmedReceipt.transactionId}) · Receipt print initiated
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => printThermalReceipt({ ...confirmedReceipt, isReprint: true })}
                className="rounded-lg border border-[#14543e] bg-white px-3 py-1 font-semibold text-[#14543e] hover:bg-[#edf6f0]"
              >
                Print Again
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-[#14543e] px-4 py-1 font-bold text-white hover:bg-[#0f402f]"
              >
                Done
              </button>
            </div>
          </div>
        ) : null}

        <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[minmax(0,1.8fr)_minmax(270px,0.85fr)] lg:overflow-hidden">
          <div className="flex min-h-0 min-w-0 flex-col gap-3">
            <div className="grid shrink-0 grid-cols-3 rounded-xl border border-[#e9e2d8] bg-white p-1 text-xs">
              {(
                [
                  ["ready", `Ready to Pay (${ready.length})`],
                  ["partial", `Partial (${partial.length})`],
                  ["all", `All Eligible (${eligible.length})`],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`rounded-lg px-2 py-2 font-semibold ${tab === id ? "bg-[#14543e] text-white" : "text-[#50483f] hover:bg-[#f5f0e9]"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div
              aria-label="Eligible booking payments"
              className="min-h-[145px] flex-1 space-y-2 overflow-y-auto rounded-xl lg:min-h-0"
            >
              {loading ? (
                <p role="status" className="rounded-xl border bg-white p-5 text-sm">
                  Preparing current payable bookings and accounts…
                </p>
              ) : null}
              {error ? (
                <div
                  role="alert"
                  className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"
                >
                  <p>{error}</p>
                  <button
                    type="button"
                    onClick={onRetry}
                    className="mt-2 rounded-lg border px-3 py-1.5"
                  >
                    Retry
                  </button>
                  {allowLegacyCheckout ? (
                    <button
                      type="button"
                      onClick={onLegacyCheckout}
                      className="ml-2 rounded-lg border px-3 py-1.5"
                    >
                      Booking checkout
                    </button>
                  ) : null}
                </div>
              ) : null}
              {!loading && !error && visible.length === 0 ? (
                <p className="rounded-xl border bg-white p-5 text-sm text-[#786d61]">
                  No eligible bookings in this category for the current business date.{" "}
                  {tab !== "all" ? "Try All Eligible." : ""}
                </p>
              ) : null}
              {visible.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(order.id);
                    setPaymentError(null);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${selected?.id === order.id ? "border-[#116044] bg-[#eff8f2]" : "border-[#e9e2d8] bg-white hover:border-[#116044]"}`}
                >
                  <span
                    aria-hidden="true"
                    className={`size-3 shrink-0 rounded-full border ${selected?.id === order.id ? "border-[#116044] bg-[#116044]" : "border-[#998c7b]"}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{order.customerName}</span>
                    <span className="block truncate text-xs text-[#786d61]">
                      {order.serviceDescription} · {order.serviceTime || order.bookingDate}
                    </span>
                    <span className="block truncate text-[11px] text-[#958779]">
                      {order.orderNumber}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[10px] text-[#786d61]">Balance</span>
                    <span className="text-sm font-bold text-[#12553f]">
                      {php(order.remainingBalance)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <div className="shrink-0 rounded-xl border border-[#e9e2d8] bg-white p-3">
              <h3 className="mb-2 text-sm font-bold">Payment methods</h3>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {FINANCIAL_PAYMENT_RAILS.map((method) => (
                  <button
                    key={method}
                    type="button"
                    disabled={!selected || busy || tenders.length === 0}
                    onClick={() =>
                      updateTender(tenders[0]!.id, {
                        method,
                        accountId: firstAccount(method),
                      })
                    }
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold ${tenders[0]?.method === method ? "border-[#116044] bg-[#eaf5ee] text-[#14543e]" : "border-[#e9e2d8]"}`}
                  >
                    {methodLabels[method]}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={!selected || busy}
                  onClick={addTender}
                  className="rounded-lg border border-dashed border-[#116044] px-3 py-2 text-xs font-semibold text-[#14543e]"
                >
                  Split +
                </button>
              </div>

              {/* Tender row header matching approved UI reference */}
              <div className="mb-1 hidden grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_28px] items-center gap-2 px-1 text-[11px] font-semibold text-[#786d61] sm:grid">
                <span>Tender #{tenders.length > 1 ? "1+" : "1"}</span>
                <span>Amount</span>
                <span>{hasCashTender ? "Cash received" : "Reference"}</span>
                <span />
              </div>

              <div className="max-h-[180px] space-y-2 overflow-y-auto">
                {tenders.map((line, index) => (
                  <div
                    key={line.id}
                    className="grid grid-cols-[minmax(0,1fr)_100px_28px] items-center gap-2 sm:grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_28px]"
                  >
                    <div className="min-w-0 space-y-1">
                      <select
                        aria-label={`Tender ${index + 1} method`}
                        value={line.method}
                        disabled={busy}
                        onChange={(e) => {
                          const method = e.target.value as FinancialPaymentMethod;
                          updateTender(line.id, { method, accountId: firstAccount(method) });
                        }}
                        className="h-9 w-full rounded-lg border border-[#e9e2d8] bg-[#faf8f5] px-2 text-xs"
                      >
                        {FINANCIAL_PAYMENT_RAILS.map((method) => (
                          <option key={method} value={method}>
                            {methodLabels[method]}
                          </option>
                        ))}
                      </select>
                      {accountChoices(line.method).length > 1 ? (
                        <select
                          aria-label={`Tender ${index + 1} receiving account`}
                          value={line.accountId}
                          disabled={busy}
                          onChange={(e) => updateTender(line.id, { accountId: e.target.value })}
                          className="h-7 w-full rounded border px-1 text-[11px]"
                        >
                          {accountChoices(line.method).map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                      ) : null}
                      {!accountChoices(line.method).length ? (
                        <span role="alert" className="text-[10px] text-red-700">
                          No compatible account
                        </span>
                      ) : null}
                    </div>

                    <div className="relative min-w-0">
                      <span className="pointer-events-none absolute left-2 top-2 text-xs text-[#786d61]">₱</span>
                      <input
                        aria-label={`Tender ${index + 1} amount`}
                        type="number"
                        min="0.01"
                        step="0.01"
                        inputMode="decimal"
                        disabled={busy}
                        value={line.amount}
                        onChange={(e) => updateTender(line.id, { amount: e.target.value })}
                        className="h-9 w-full min-w-0 rounded-lg border border-[#e9e2d8] pl-6 pr-2 text-right text-xs"
                      />
                    </div>

                    {line.method === "cash" ? (
                      <div className="relative col-span-2 min-w-0 sm:col-span-1">
                        <span className="pointer-events-none absolute left-2 top-2 text-xs text-[#786d61]">₱</span>
                        <input
                          aria-label={`Tender ${index + 1} cash received`}
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          placeholder={line.amount ? Number(line.amount).toFixed(2) : "0.00"}
                          disabled={busy}
                          value={line.cashReceived ?? ""}
                          onChange={(e) => updateTender(line.id, { cashReceived: e.target.value })}
                          className="h-9 w-full min-w-0 rounded-lg border border-[#e9e2d8] pl-6 pr-2 text-right text-xs focus:border-[#14543e] focus:outline-none"
                        />
                      </div>
                    ) : (
                      <input
                        aria-label={`Tender ${index + 1} reference`}
                        value={line.reference}
                        disabled={busy}
                        onChange={(e) => updateTender(line.id, { reference: e.target.value })}
                        placeholder="Transaction reference (optional)"
                        className="col-span-2 h-9 w-full min-w-0 rounded-lg border border-[#e9e2d8] px-2 text-xs sm:col-span-1"
                      />
                    )}

                    <button
                      type="button"
                      aria-label={`Remove tender ${index + 1}`}
                      disabled={busy || tenders.length === 1}
                      onClick={() =>
                        setTenders((current) => current.filter((t) => t.id !== line.id))
                      }
                      className="grid size-7 place-items-center text-[#806f60] hover:text-red-700 disabled:opacity-30"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                disabled={!selected || busy}
                onClick={addTender}
                className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-[#a0cab3] py-2 text-xs font-semibold text-[#14543e]"
              >
                <Plus size={14} /> Add another payment method
              </button>

              <button
                type="button"
                onClick={() => setShowNotes(!showNotes)}
                className="mt-2 text-xs text-[#14543e]"
              >
                {showNotes ? "Hide" : "Add"} payment note (optional)
              </button>

              {showNotes ? (
                <input
                  aria-label="Payment notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={1000}
                  className="mt-1 h-9 w-full rounded-lg border px-2 text-xs"
                />
              ) : null}

              {cashReceivedError ? (
                <p role="alert" className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">
                  {cashReceivedError}
                </p>
              ) : null}

              {/* Approved notice banner */}
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#eaf5ee] p-2.5 text-xs text-[#14543e]">
                <Info size={16} className="shrink-0 text-[#14543e]" />
                <span>After you click Record Payment, the receipt will print automatically.</span>
              </div>
            </div>
          </div>
          <aside className="min-w-0 space-y-3 overflow-y-auto rounded-xl border border-[#e9e2d8] bg-white p-4">
            <h3 className="flex items-center gap-2 text-base font-bold">
              <CheckCircle2 size={18} className="text-[#116044]" /> Selected Payment
            </h3>
            {selected ? (
              <>
                <div className="border-b pb-3">
                  <p className="text-[11px] text-[#786d61]">Customer</p>
                  <p className="font-bold">{selected.customerName}</p>
                  <p className="text-xs text-[#786d61]">{selected.orderNumber}</p>
                  <p className="mt-3 text-[11px] text-[#786d61]">Services</p>
                  <p className="text-sm font-semibold">{selected.serviceDescription}</p>
                  {selected.payableItems?.length ? (
                    <div className="mt-2 space-y-1">
                      {selected.payableItems.map((item) => (
                        <div key={item.id} className="flex justify-between gap-2 text-[11px]">
                          <span className="min-w-0 truncate">{item.description}</span>
                          <span>{php(item.amount)}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span>Total payable</span>
                    <strong>{php(selected.totalAmount)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Already paid</span>
                    <strong>{php(selected.amountPaid)}</strong>
                  </div>
                  <div className="flex justify-between rounded-lg bg-[#edf6ef] p-2 font-bold text-[#14543e]">
                    <span>Remaining balance</span>
                    <span>{php(selected.remainingBalance)}</span>
                  </div>
                </div>
                <div className="rounded-xl bg-[#eff8f2] p-3">
                  <p className="mb-2 text-xs font-bold">Tender breakdown</p>
                  {tenders.map((line, index) => (
                    <div key={line.id} className="flex justify-between text-xs">
                      <span>
                        {methodLabels[line.method]} #{index + 1}
                      </span>
                      <span>{php(Number(line.amount) || 0)}</span>
                    </div>
                  ))}
                  <div className="mt-2 flex justify-between border-t pt-2 text-sm font-bold">
                    <span>To record</span>
                    <span>{php(totalCents / 100)}</span>
                  </div>
                  <p className="mt-1 text-xs text-[#786d61]">
                    After payment: {php(Math.max(0, remainingCents - totalCents) / 100)}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-sm text-[#786d61]">
                Select an eligible booking to see its payment details.
              </p>
            )}
            <p className="rounded-lg bg-[#f7f1e9] p-3 text-xs text-[#705e4d]">
              Amounts come from the current Cash Flow payable-order context. The server validates
              financial writes.
            </p>
            <Link
              href="/crm/cash-flow?entry=payment"
              className="block rounded-lg border border-[#e9e2d8] px-3 py-2 text-center text-xs font-semibold"
            >
              Advanced Cash Flow options
            </Link>
          </aside>
        </div>
        {paymentError ? (
          <p
            role="alert"
            className="shrink-0 border-t border-red-200 bg-red-50 px-5 py-2 text-xs text-red-800"
          >
            {paymentError}
          </p>
        ) : null}
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-[#e9e2d8] bg-white px-5 py-3">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-[11px] text-[#786d61]">Total to record</p>
              <p className="text-lg font-bold">{php(totalCents / 100)}</p>
            </div>
            {hasCashTender ? (
              <>
                <div className="h-8 w-px bg-[#e9e2d8]" aria-hidden="true" />
                <div>
                  <p className="text-[11px] text-[#786d61]">Change</p>
                  <p className="text-lg font-bold text-[#14543e]">
                    {php(changeCents / 100)}
                  </p>
                </div>
              </>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-lg border border-[#e9e2d8] px-4 py-2 text-xs font-semibold hover:bg-[#FAF8F5]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => void recordPayment()}
              className="rounded-lg bg-[#14543e] px-5 py-2 text-xs font-bold text-white hover:bg-[#0f402f] disabled:opacity-40"
            >
              {busy ? "Recording…" : "Record Payment"}
            </button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
