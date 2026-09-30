"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AdminDialog,
  AdminOverlayBody,
  AdminOverlayFooter,
  AdminOverlayHeader,
} from "@/components/shared/overlays";
import {
  RecordFinancialEntryModal,
  type FinancialEntryMode,
} from "@/components/features/cash-flow/record-financial-entry-modal";
import {
  loadFinancialEntryContextAction,
  type FinancialEntryContext,
} from "@/lib/cash-flow/financial-entry-context";

export type CradleFlowFinancialEntryRequest = {
  mode: FinancialEntryMode;
  orderId?: string;
  allowLegacyCheckout?: boolean;
};

type LoadResult =
  | { ok: true; data: FinancialEntryContext }
  | { ok: false; error: string };

export function CradleFlowFinancialEntry({
  request,
  onClose,
  onSuccess,
  onLegacyCheckout,
}: {
  request: CradleFlowFinancialEntryRequest;
  onClose: () => void;
  onSuccess: () => void;
  onLegacyCheckout: () => void;
}) {
  const [result, setResult] = useState<LoadResult | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    void loadFinancialEntryContextAction()
      .then((loaded) => {
        if (active) setResult(loaded);
      })
      .catch((error: unknown) => {
        if (active) {
          setResult({
            ok: false,
            error: error instanceof Error ? error.message : "Could not load financial entry options.",
          });
        }
      });
    return () => {
      active = false;
    };
  }, [retryKey]);

  const selectedOrderAvailable =
    !request.orderId || (result?.ok && result.data.payableOrders.some((order) => order.id === request.orderId));
  const error = result?.ok
    ? selectedOrderAvailable
      ? null
      : request.allowLegacyCheckout
        ? "This booking is not available in the Cash Flow payment list. Its existing booking checkout is still available."
        : "This order is no longer available for payment. Refresh the visit before recording a payment."
    : result?.error;

  if (result?.ok && selectedOrderAvailable) {
    return (
      <RecordFinancialEntryModal
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        accounts={result.data.accounts}
        expenseCategories={result.data.expenseCategories}
        staffOptions={result.data.staffOptions}
        payableOrders={result.data.payableOrders}
        activeCashSessions={result.data.cashSessions?.activeSessions ?? []}
        initialOrderId={request.orderId}
        initialMode={request.mode}
        branchId={result.data.branchId}
        businessDate={result.data.businessDate}
        onSuccess={onSuccess}
      />
    );
  }

  return (
    <AdminDialog open onOpenChange={(open) => { if (!open) onClose(); }} placement="center" size="md" ariaLabel="Financial entry">
      <AdminOverlayHeader title="Record Financial Entry" description="Loading the existing Cash Flow workflow." />
      <AdminOverlayBody>
        {error ? (
          <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{error}</p>
        ) : (
          <p role="status" className="text-sm text-[var(--cs-text-muted)]">Loading accounts and payable orders…</p>
        )}
      </AdminOverlayBody>
      <AdminOverlayFooter className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onClose} className="cs-btn cs-btn-secondary h-10 rounded-lg px-4">Close</button>
        {error ? (
          <button
            type="button"
            onClick={() => { setResult(null); setRetryKey((key) => key + 1); }}
            className="h-10 rounded-lg bg-[#164b36] px-4 text-sm font-bold text-white"
          >
            Retry
          </button>
        ) : null}
        {error && request.allowLegacyCheckout ? (
          <button type="button" onClick={onLegacyCheckout} className="h-10 rounded-lg bg-[#164b36] px-4 text-sm font-bold text-white">
            Open Booking Checkout
          </button>
        ) : null}
        <Link href="/crm/cash-flow" className="inline-flex h-10 items-center rounded-lg border border-[var(--cs-border)] px-4 text-sm font-bold">
          Open in Cash Flow
        </Link>
      </AdminOverlayFooter>
    </AdminDialog>
  );
}
