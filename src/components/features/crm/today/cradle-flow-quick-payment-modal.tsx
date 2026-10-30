"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info, Plus, Printer, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { FinancialEntryContext } from "@/lib/cash-flow/financial-entry-context";
import type { MaskedAccountOption } from "@/lib/cash-flow/cash-flow-types";
import {
  FINANCIAL_PAYMENT_RAILS,
  isPaymentMethodCompatibleWithAccount,
  type FinancialPaymentMethod,
  type PostOrderPaymentResult,
} from "@/lib/cash-flow/financial-contract";
import {
  recordLegacyBookingPaymentAction,
  recordOrderPaymentAction,
} from "@/lib/cash-flow/cash-flow-actions";
import {
  isQuickPaymentEligible,
} from "@/components/features/cash-flow/cash-flow-today-eligibility";
import {
  isValidAuthoritativeTransactionId,
  printThermalReceipt,
  type PrintableReceiptData,
} from "@/lib/cash-flow/receipt-printer";

export { isQuickPaymentEligible };

type FlexiblePaymentMovement = PostOrderPaymentResult["movements"][number] & {
  payment_method?: string;
  reference?: string | null;
};

type FlexiblePaymentResult = PostOrderPaymentResult & {
  transaction_id?: string;
  is_idempotent_replay?: boolean;
  total_payable?: number;
  remaining_balance?: number;
  net_allocated?: number;
  total_paid?: number;
  movements?: FlexiblePaymentMovement[];
};

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
  const [verificationWarning, setVerificationWarning] = useState<string | null>(null);
  const [printWarning, setPrintWarning] = useState<string | null>(null);
  const [confirmedReceipt, setConfirmedReceipt] = useState<PrintableReceiptData | null>(null);
  const [unresolvedAttempt, setUnresolvedAttempt] = useState<boolean>(false);
  const submitting = useRef(false);
  const attempt = useRef<{
    signature: string;
    key: string;
    unresolved?: boolean;
    orderId?: string;
    sourceKind?: string;
    paidBefore?: number;
    totalPayable?: number;
    amount?: number;
  } | null>(null);

  const isLocked = Boolean(verificationWarning || unresolvedAttempt);

  useEffect(() => {
    if (!unresolvedAttempt || !data || !attempt.current) return;

    const attemptedId = attempt.current.orderId;
    const attemptedAmount = attempt.current.amount ?? 0;
    const paidBefore = attempt.current.paidBefore ?? 0;
    const totalPayable = attempt.current.totalPayable ?? 0;

    const refreshedOrder = data.payableOrders.find((o) => o.id === attemptedId);

    if (refreshedOrder) {
      const currentPaid = refreshedOrder.amountPaid;
      if (Math.round(currentPaid * 100) >= Math.round((paidBefore + attemptedAmount) * 100)) {
        // Authoritatively confirmed posted in the refreshed ledger
        attempt.current.unresolved = false;
        setUnresolvedAttempt(false);
        setVerificationWarning(null);
        setPaymentError(null);
        onSuccess();
      }
    } else if (
      !loading &&
      !error &&
      Math.round((paidBefore + attemptedAmount) * 100) >= Math.round(totalPayable * 100)
    ) {
      // Order was fully paid and closed out of payable orders
      attempt.current.unresolved = false;
      setUnresolvedAttempt(false);
      setVerificationWarning(null);
      setPaymentError(null);
      onSuccess();
    }
  }, [unresolvedAttempt, data, loading, error, onSuccess]);

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
    if (isLocked) return;
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
    !confirmedReceipt &&
    !isLocked &&
    totalCents > 0 &&
    totalCents <= remainingCents
  );

  function updateTender(id: string, change: Partial<Tender>) {
    if (isLocked) return;
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
    if (isLocked) return;
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
    if (confirmedReceipt || isLocked || submitting.current || !canSubmit || !data || !selected) return;
    submitting.current = true;
    setBusy(true);
    setPaymentError(null);
    setPrintWarning(null);

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

    const key =
      attempt.current?.unresolved && attempt.current.orderId === selected.id
        ? attempt.current.key
        : crypto.randomUUID();

    attempt.current = {
      signature,
      key,
      unresolved: true,
      orderId: selected.id,
      sourceKind: selected.sourceKind,
      paidBefore: selected.amountPaid,
      totalPayable: selected.totalAmount,
      amount: totalCents / 100,
    };
    setUnresolvedAttempt(true);

    try {
      const result =
        selected.sourceKind === "legacy_booking"
          ? await recordLegacyBookingPaymentAction({
              bookingId: selected.id,
              branchId: data.branchId,
              expectedAmountPaid: selected.amountPaid,
              idempotencyKey: key,
              payments,
              businessDate: data.businessDate,
              notes: notes.trim() || null,
            })
          : await recordOrderPaymentAction({
              orderId: selected.id,
              idempotencyKey: key,
              payments,
              businessDate: data.businessDate,
              notes: notes.trim() || null,
            });

      if (!result.ok) {
        const isPreWriteRejection =
          result.code === "VALIDATION_FAILED" ||
          result.code === "AUTH_REQUIRED" ||
          result.code === "ORDER_NOT_PAYABLE" ||
          result.code === "SOURCE_MISMATCH" ||
          result.code === "BOOKING_PRICE_INVALID";

        if (isPreWriteRejection) {
          if (attempt.current) attempt.current.unresolved = false;
          setUnresolvedAttempt(false);
          setPaymentError(result.error || "Payment was rejected before posting.");
          return;
        }

        setUnresolvedAttempt(true);
        setVerificationWarning(
          `Payment posting reported an unconfirmed status: ${result.error || "Server error"}. The transaction may have already posted. Payment submission is locked until the ledger is authoritatively verified.`
        );
        setConfirmedReceipt(null);
        return;
      }

      // Authoritative verification of server confirmation
      let confirmedTxnId: string | null = null;
      let confirmedAmountPaid = 0;
      let confirmedTotalPayable = 0;
      let confirmedAlreadyPaid = 0;
      let confirmedRemainingBalance = 0;
      let confirmedMovements: Array<{ method: string; amount: number; reference?: string | null }> = [];
      let isIdempotentReplay = false;
      let unverifiedReason: string | null = null;

      if (selected.sourceKind === "legacy_booking") {
        const legacyData =
          "data" in result && result.data && "paymentDelta" in result.data
            ? (result.data as {
                transactionId: string | null;
                paymentDelta: number;
                isIdempotentReplay: boolean;
                branchId: string;
                totalPayable?: number;
                totalPaid?: number;
                alreadyPaid?: number;
                remainingBalance?: number;
                movements?: Array<{
                  id: string;
                  amount: number;
                  paymentMethod: string;
                  externalReference: string | null;
                }>;
              })
            : null;
        const rawId = legacyData?.transactionId;

        if (!isValidAuthoritativeTransactionId(rawId)) {
          unverifiedReason = "Missing, malformed, or fabricated transaction reference in server response.";
        } else if (!legacyData || typeof legacyData.paymentDelta !== "number" || !Number.isFinite(legacyData.paymentDelta)) {
          unverifiedReason = "Invalid payment delta in server response.";
        } else if (!Array.isArray(legacyData.movements) || legacyData.movements.length === 0) {
          unverifiedReason = "Authoritative payment tender movements are missing from the server confirmation.";
        } else {
          confirmedTxnId = (rawId as string).trim();
          isIdempotentReplay = Boolean(legacyData.isIdempotentReplay);

          let movementSum = 0;
          let hasInvalidMovement = false;
          confirmedMovements = legacyData.movements.map((m) => {
            const amount = Number(m.amount);
            if (!Number.isFinite(amount) || amount <= 0) {
              hasInvalidMovement = true;
            }
            movementSum += amount;
            const methodKey = (m.paymentMethod || "") as FinancialPaymentMethod;
            const displayMethod =
              (methodKey in methodLabels ? methodLabels[methodKey] : methodKey) || "Payment";
            return {
              method: displayMethod,
              amount,
              reference: m.externalReference ?? null,
            };
          });

          if (hasInvalidMovement) {
            unverifiedReason = "One or more authoritative tender movements contain invalid amounts.";
          } else {
            confirmedAmountPaid = movementSum;
            if (Math.round(confirmedAmountPaid * 100) !== totalCents && !isIdempotentReplay) {
              unverifiedReason = `Posting amount mismatch: expected ${php(totalCents / 100)}, but server recorded ${php(confirmedAmountPaid)}.`;
            } else {
              const totalPayableVal = Number(legacyData.totalPayable);
              const remBalVal = Number(legacyData.remainingBalance);
              const totalPaidVal = Number(legacyData.totalPaid);
              const alreadyPaidVal = Number(legacyData.alreadyPaid);

              if (!Number.isFinite(totalPayableVal) || totalPayableVal < 0) {
                unverifiedReason = "Authoritative total payable amount is missing or invalid in server confirmation.";
              } else if (!Number.isFinite(remBalVal) || remBalVal < 0) {
                unverifiedReason = "Authoritative remaining balance is missing or invalid in server confirmation.";
              } else if (!Number.isFinite(totalPaidVal) || totalPaidVal < 0) {
                unverifiedReason = "Authoritative total paid amount is missing or invalid in server confirmation.";
              } else if (!Number.isFinite(alreadyPaidVal) || alreadyPaidVal < 0) {
                unverifiedReason = "Authoritative already paid amount is missing or invalid in server confirmation.";
              } else {
                const roundedExpectedSum = Math.round((alreadyPaidVal + confirmedAmountPaid + remBalVal) * 100);
                const roundedTotalPayable = Math.round(totalPayableVal * 100);
                if (roundedExpectedSum !== roundedTotalPayable) {
                  unverifiedReason = "Authoritative balance calculation mismatch: total payable, previous payments, and remaining balance are inconsistent.";
                } else {
                  confirmedTotalPayable = totalPayableVal;
                  confirmedRemainingBalance = remBalVal;
                  confirmedAlreadyPaid = alreadyPaidVal;
                }
              }
            }
          }
        }
      } else {
        // Canonical order payment
        const orderData = "data" in result ? (result.data as FlexiblePaymentResult) : null;
        if (!orderData) {
          unverifiedReason = "Empty payment data received from server.";
        } else if (orderData.success !== true) {
          unverifiedReason = "Server reported unconfirmed payment posting status.";
        } else {
          const rawId = orderData.transactionId || orderData.transaction_id;

          if (!isValidAuthoritativeTransactionId(rawId)) {
            unverifiedReason = "Missing, malformed, or fabricated transaction reference in server response.";
          } else if (!Array.isArray(orderData.movements) || orderData.movements.length === 0) {
            unverifiedReason = "Authoritative payment tender movements are missing from the server confirmation.";
          } else {
            confirmedTxnId = (rawId as string).trim();
            isIdempotentReplay = Boolean(orderData.isIdempotentReplay || orderData.is_idempotent_replay);

            let movementSum = 0;
            let hasInvalidMovement = false;
            confirmedMovements = orderData.movements.map((m) => {
              const rawM = m as Record<string, unknown>;
              const amount = Number(rawM.amount);
              if (!Number.isFinite(amount) || amount <= 0) {
                hasInvalidMovement = true;
              }
              movementSum += amount;
              const methodKey = String(rawM.paymentMethod || rawM.payment_method || "") as FinancialPaymentMethod;
              const displayMethod =
                (methodKey in methodLabels ? methodLabels[methodKey] : methodKey) || "Payment";
              const ref = rawM.externalReference ?? rawM.reference;
              return {
                method: displayMethod,
                amount,
                reference: typeof ref === "string" ? ref : null,
              };
            });

            if (hasInvalidMovement) {
              unverifiedReason = "One or more authoritative tender movements contain invalid amounts.";
            } else {
              confirmedAmountPaid = movementSum;
              if (Math.round(confirmedAmountPaid * 100) !== totalCents && !isIdempotentReplay) {
                unverifiedReason = `Posting amount mismatch: expected ${php(totalCents / 100)}, but server recorded ${php(confirmedAmountPaid)}.`;
              } else {
                const totalPayableVal = Number.isFinite(orderData.totalPayable)
                  ? orderData.totalPayable
                  : Number(orderData.total_payable);
                const remBalVal = Number.isFinite(orderData.remainingBalance)
                  ? orderData.remainingBalance
                  : Number(orderData.remaining_balance);
                const netAllocatedVal = Number.isFinite(orderData.netAllocated)
                  ? orderData.netAllocated
                  : Number(orderData.net_allocated);

                if (!Number.isFinite(totalPayableVal) || totalPayableVal < 0) {
                  unverifiedReason = "Authoritative total payable amount is missing or invalid in server confirmation.";
                } else if (!Number.isFinite(remBalVal) || remBalVal < 0) {
                  unverifiedReason = "Authoritative remaining balance is missing or invalid in server confirmation.";
                } else if (!Number.isFinite(netAllocatedVal) || netAllocatedVal < 0) {
                  unverifiedReason = "Authoritative cumulative allocation amount is missing or invalid in server confirmation.";
                } else {
                  // Previously paid is cumulative allocation before this transaction
                  const prevPaid = Math.max(0, Math.round((netAllocatedVal - confirmedAmountPaid) * 100) / 100);

                  const roundedNetAlloc = Math.round(netAllocatedVal * 100);
                  const roundedExpectedAlloc = Math.round((prevPaid + confirmedAmountPaid) * 100);
                  const roundedTotalPayable = Math.round(totalPayableVal * 100);
                  const roundedExpectedTotal = Math.round((remBalVal + netAllocatedVal) * 100);

                  if (roundedNetAlloc < Math.round(confirmedAmountPaid * 100)) {
                    unverifiedReason = "Authoritative cumulative allocation is less than current transaction amount.";
                  } else if (roundedTotalPayable !== roundedExpectedTotal || roundedNetAlloc !== roundedExpectedAlloc) {
                    unverifiedReason = "Authoritative balance calculation mismatch: total payable, cumulative allocation, and remaining balance are inconsistent.";
                  } else {
                    confirmedTotalPayable = totalPayableVal;
                    confirmedRemainingBalance = remBalVal;
                    confirmedAlreadyPaid = prevPaid;
                  }
                }
              }
            }
          }
        }
      }

      if (unverifiedReason || !confirmedTxnId) {
        setUnresolvedAttempt(true);
        setVerificationWarning(
          `Payment status requires verification: ${unverifiedReason ?? "Missing confirmed transaction ID"}. Please check the Cash Flow ledger to verify whether the transaction posted before re-attempting payment or issuing a receipt.`
        );
        setConfirmedReceipt(null);
        return;
      }

      const receiptData: PrintableReceiptData = {
        companyName: "CRADLE WELLNESS LIVING INC.",
        branchName: selected.branchName || "Main Spa",
        transactionId: confirmedTxnId,
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
          : [{ description: selected.serviceDescription, amount: confirmedTotalPayable }],
        totalPayable: confirmedTotalPayable,
        alreadyPaid: confirmedAlreadyPaid,
        amountPaid: confirmedAmountPaid,
        remainingBalance: confirmedRemainingBalance,
        payments: confirmedMovements.map((m) => {
          const isCash = m.method.toLowerCase().includes("cash");
          return {
            method: m.method,
            amount: m.amount,
            reference: m.reference ?? null,
            cashReceived: isCash && hasAnyCashReceivedEntered ? totalCashReceivedCents / 100 : null,
            change: isCash ? changeCents / 100 : null,
          };
        }),
        totalCashReceived:
          hasCashTender && hasAnyCashReceivedEntered ? totalCashReceivedCents / 100 : null,
        changeGiven: hasCashTender ? changeCents / 100 : null,
        isIdempotentReplay,
      };

      if (attempt.current) {
        attempt.current.unresolved = false;
      }
      setUnresolvedAttempt(false);
      setVerificationWarning(null);
      setPaymentError(null);
      setConfirmedReceipt(receiptData);
      const printed = printThermalReceipt(receiptData);
      if (!printed) {
        setPrintWarning(
          "Automatic printing could not be opened. Click 'Print Again' to retry, or check browser print permissions."
        );
      } else {
        setPrintWarning(null);
      }
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error or timeout";
      setUnresolvedAttempt(true);
      setVerificationWarning(
        `Payment status uncertain due to communication failure (${msg}). The transaction may have already posted. Payment submission is locked until the ledger is authoritatively verified.`
      );
      setConfirmedReceipt(null);
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

        {verificationWarning ? (
          <div
            role="alert"
            className="flex items-start justify-between gap-3 border-b border-amber-300 bg-amber-50 px-5 py-3 text-xs text-amber-950"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-700" />
              <div>
                <span className="font-bold">Payment Verification Required: </span>
                <span>{verificationWarning}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/crm/cash-flow?tab=ledger"
                className="rounded-lg border border-amber-400 bg-white px-3 py-1 font-semibold text-amber-900 hover:bg-amber-100"
              >
                View Ledger
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-amber-800 px-3 py-1 font-bold text-white hover:bg-amber-900"
              >
                Close
              </button>
            </div>
          </div>
        ) : null}

        {confirmedReceipt ? (
          <div className="flex flex-col gap-1 border-b border-emerald-200 bg-[#eaf5ee] px-5 py-3 text-xs text-[#14543e]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="shrink-0 text-[#14543e]" />
                <div>
                  <span className="font-bold">
                    Payment of {php(confirmedReceipt.amountPaid)} recorded successfully!
                  </span>
                  <span className="ml-2 text-[#4e6b5c]">
                    (Txn: <span className="font-mono">{confirmedReceipt.transactionId}</span>)
                    {confirmedReceipt.isIdempotentReplay ? " · Idempotent Replay" : ""}
                    {printWarning ? ` · ${printWarning}` : " · Print command initiated"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const ok = printThermalReceipt({ ...confirmedReceipt, isReprint: true });
                    if (ok) setPrintWarning(null);
                  }}
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
                  disabled={isLocked}
                  onClick={() => setTab(id)}
                  className={`rounded-lg px-2 py-2 font-semibold ${tab === id ? "bg-[#14543e] text-white" : "text-[#50483f] hover:bg-[#f5f0e9]"} disabled:opacity-50`}
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
                  disabled={isLocked}
                  onClick={() => {
                    setSelectedId(order.id);
                    setPaymentError(null);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${selected?.id === order.id ? "border-[#116044] bg-[#eff8f2]" : "border-[#e9e2d8] bg-white hover:border-[#116044]"} disabled:opacity-60`}
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
                    disabled={!selected || busy || isLocked || tenders.length === 0}
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
                  disabled={!selected || busy || isLocked}
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
                        disabled={busy || isLocked}
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
                          disabled={busy || isLocked}
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
                        disabled={busy || isLocked}
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
                          disabled={busy || isLocked}
                          value={line.cashReceived ?? ""}
                          onChange={(e) => updateTender(line.id, { cashReceived: e.target.value })}
                          className="h-9 w-full min-w-0 rounded-lg border border-[#e9e2d8] pl-6 pr-2 text-right text-xs focus:border-[#14543e] focus:outline-none"
                        />
                      </div>
                    ) : (
                      <input
                        aria-label={`Tender ${index + 1} reference`}
                        value={line.reference}
                        disabled={busy || isLocked}
                        onChange={(e) => updateTender(line.id, { reference: e.target.value })}
                        placeholder="Transaction reference (optional)"
                        className="col-span-2 h-9 w-full min-w-0 rounded-lg border border-[#e9e2d8] px-2 text-xs sm:col-span-1"
                      />
                    )}

                    <button
                      type="button"
                      aria-label={`Remove tender ${index + 1}`}
                      disabled={busy || isLocked || tenders.length === 1}
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
                disabled={!selected || busy || isLocked}
                onClick={addTender}
                className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-[#a0cab3] py-2 text-xs font-semibold text-[#14543e]"
              >
                <Plus size={14} /> Add another payment method
              </button>

              <button
                type="button"
                disabled={busy || isLocked}
                onClick={() => setShowNotes(!showNotes)}
                className="mt-2 text-xs text-[#14543e]"
              >
                {showNotes ? "Hide" : "Add"} payment note (optional)
              </button>

              {showNotes ? (
                <input
                  aria-label="Payment notes"
                  value={notes}
                  disabled={busy || isLocked}
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
              <CheckCircle2 size={18} className="text-[#116044]" />{" "}
              {confirmedReceipt ? "Payment Confirmed" : "Selected Payment"}
            </h3>
            {confirmedReceipt ? (
              <div className="space-y-3">
                <div className="rounded-lg bg-[#edf6ef] p-3 text-xs">
                  <div className="flex items-center justify-between font-bold text-[#14543e]">
                    <span>Transaction Recorded</span>
                    {confirmedReceipt.isIdempotentReplay ? (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800">
                        REPLAY
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-[#2c3e35]">
                    Ref: {confirmedReceipt.transactionId}
                  </p>
                </div>
                <div className="border-b pb-3 text-xs">
                  <p className="text-[11px] text-[#786d61]">Customer</p>
                  <p className="font-bold">{confirmedReceipt.customerName}</p>
                  <p className="text-xs text-[#786d61]">{confirmedReceipt.orderNumber}</p>
                  <p className="mt-1 text-[11px] text-[#786d61]">
                    Branch: {confirmedReceipt.branchName}
                  </p>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span>Total payable</span>
                    <strong>{php(confirmedReceipt.totalPayable)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Total paid</span>
                    <strong>{php(confirmedReceipt.alreadyPaid)}</strong>
                  </div>
                  <div className="flex justify-between rounded-lg bg-[#edf6ef] p-2 font-bold text-[#14543e]">
                    <span>Remaining balance</span>
                    <span>{php(confirmedReceipt.remainingBalance)}</span>
                  </div>
                </div>
                <div className="rounded-xl bg-[#eff8f2] p-3">
                  <p className="mb-2 text-xs font-bold">Confirmed tender breakdown</p>
                  {(confirmedReceipt.payments || []).map((line, idx) => (
                    <div key={idx} className="flex justify-between text-xs">
                      <span>{line.method}</span>
                      <span>{php(line.amount)}</span>
                    </div>
                  ))}
                  <div className="mt-2 flex justify-between border-t pt-2 text-sm font-bold">
                    <span>Amount recorded</span>
                    <span>{php(confirmedReceipt.amountPaid)}</span>
                  </div>
                  {confirmedReceipt.totalCashReceived != null ? (
                    <div className="mt-2 space-y-1 border-t pt-2 text-xs text-[#786d61]">
                      <div className="flex justify-between">
                        <span>Cash tendered</span>
                        <span>{php(confirmedReceipt.totalCashReceived)}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-[#14543e]">
                        <span>Change given</span>
                        <span>{php(confirmedReceipt.changeGiven ?? 0)}</span>
                      </div>
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const printed = printThermalReceipt({ ...confirmedReceipt, isReprint: true });
                    if (!printed) {
                      setPrintWarning(
                        "Browser print dialog could not be opened. You can click 'Print Receipt Again' anytime."
                      );
                    } else {
                      setPrintWarning(null);
                    }
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#14543e] bg-white px-3 py-2 text-xs font-semibold text-[#14543e] hover:bg-[#eff8f2]"
                >
                  <Printer size={14} /> Print Receipt Again
                </button>
              </div>
            ) : selected ? (
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
          {confirmedReceipt ? (
            <>
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-[11px] text-[#786d61]">Amount recorded</p>
                  <p className="text-lg font-bold text-[#14543e]">
                    {php(confirmedReceipt.amountPaid)}
                  </p>
                </div>
                {confirmedReceipt.totalCashReceived != null ? (
                  <>
                    <div className="h-8 w-px bg-[#e9e2d8]" aria-hidden="true" />
                    <div>
                      <p className="text-[11px] text-[#786d61]">Change</p>
                      <p className="text-lg font-bold text-[#14543e]">
                        {php(confirmedReceipt.changeGiven ?? 0)}
                      </p>
                    </div>
                  </>
                ) : null}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const printed = printThermalReceipt({ ...confirmedReceipt, isReprint: true });
                    if (!printed) {
                      setPrintWarning(
                        "Browser print dialog could not be opened. You can click 'Print Receipt Again' anytime."
                      );
                    } else {
                      setPrintWarning(null);
                    }
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-[#14543e] px-4 py-2 text-xs font-semibold text-[#14543e] hover:bg-[#FAF8F5]"
                >
                  <Printer size={14} /> Print Again
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg bg-[#14543e] px-5 py-2 text-xs font-bold text-white hover:bg-[#0f402f]"
                >
                  Done
                </button>
              </div>
            </>
          ) : verificationWarning ? (
            <>
              <div className="flex items-center gap-2 text-xs text-amber-900">
                <AlertTriangle size={16} className="shrink-0 text-amber-700" />
                <span className="font-semibold">
                  Payment submission locked until verified in ledger.
                </span>
              </div>
              <div className="flex gap-2">
                <Link
                  href="/crm/cash-flow?tab=ledger"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-amber-400 bg-white px-4 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                >
                  View Ledger
                </Link>
                {onRetry ? (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      onRetry();
                    }}
                    className="rounded-lg border border-[#e9e2d8] px-4 py-2 text-xs font-semibold hover:bg-[#FAF8F5] disabled:opacity-50"
                  >
                    {loading ? "Verifying…" : "Verify & Refresh"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg bg-amber-800 px-5 py-2 text-xs font-bold text-white hover:bg-amber-900"
                >
                  Close
                </button>
              </div>
            </>
          ) : (
            <>
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
            </>
          )}
        </footer>
      </DialogContent>
    </Dialog>
  );
}
