'use client';

import React, { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Plus, Trash2, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import type {
  MaskedAccountOption,
  PayableOrderOption,
} from '@/lib/cash-flow/cash-flow-types';
import {
  FINANCIAL_PAYMENT_RAILS,
  type FinancialPaymentMethod,
  isPaymentMethodCompatibleWithAccount,
} from '@/lib/cash-flow/financial-contract';
import { recordOrderPaymentAction } from '@/lib/cash-flow/cash-flow-actions';

interface PaymentLineItem {
  id: string;
  method: FinancialPaymentMethod;
  accountId: string;
  amount: number | '';
  reference: string;
}

interface RecordPaymentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: MaskedAccountOption[];
  payableOrders: PayableOrderOption[];
  initialOrderId?: string;
  businessDate: string;
  onSuccess?: () => void;
}

export function RecordPaymentSheet({
  open,
  onOpenChange,
  accounts,
  payableOrders,
  initialOrderId,
  businessDate,
  onSuccess,
}: RecordPaymentSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg w-full overflow-y-auto bg-[#FAF8F5] p-6 text-[#1E1916]">
        {open && (
          <RecordPaymentForm
            onClose={() => onOpenChange(false)}
            accounts={accounts}
            payableOrders={payableOrders}
            initialOrderId={initialOrderId}
            businessDate={businessDate}
            onSuccess={onSuccess}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

interface RecordPaymentFormProps {
  onClose: () => void;
  accounts: MaskedAccountOption[];
  payableOrders: PayableOrderOption[];
  initialOrderId?: string;
  businessDate: string;
  onSuccess?: () => void;
}

function RecordPaymentForm({
  onClose,
  accounts,
  payableOrders,
  initialOrderId,
  businessDate,
  onSuccess,
}: RecordPaymentFormProps) {
  const initialOrder =
    payableOrders.find((o) => o.id === initialOrderId) ||
    (payableOrders.length > 0 ? payableOrders[0] : undefined);

  const [selectedOrderId, setSelectedOrderId] = useState<string>(initialOrder?.id || '');
  const selectedOrder = payableOrders.find((o) => o.id === selectedOrderId) || initialOrder;

  const defaultAccount = accounts.find((a) =>
    isPaymentMethodCompatibleWithAccount('cash', a.accountType)
  );

  const [paymentLines, setPaymentLines] = useState<PaymentLineItem[]>(() => [
    {
      id: crypto.randomUUID(),
      method: 'cash',
      accountId: defaultAccount?.id || accounts[0]?.id || '',
      amount: selectedOrder && selectedOrder.remainingBalance > 0 ? selectedOrder.remainingBalance : '',
      reference: '',
    },
  ]);

  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleOrderChange = (orderId: string) => {
    setSelectedOrderId(orderId);
    const order = payableOrders.find((o) => o.id === orderId);
    if (order && paymentLines.length > 0) {
      setPaymentLines((prev) => [
        {
          ...prev[0]!,
          amount: order.remainingBalance > 0 ? order.remainingBalance : '',
        },
      ]);
    }
  };

  const handlePayFullBalance = () => {
    if (!selectedOrder) return;
    const remaining = selectedOrder.remainingBalance;
    if (remaining <= 0) return;

    const currentMethod = paymentLines[0]?.method || 'cash';
    const compatibleAccount = accounts.find((a) =>
      isPaymentMethodCompatibleWithAccount(currentMethod, a.accountType)
    );

    setPaymentLines([
      {
        id: crypto.randomUUID(),
        method: currentMethod,
        accountId: compatibleAccount?.id || accounts[0]?.id || '',
        amount: remaining,
        reference: paymentLines[0]?.reference || '',
      },
    ]);
  };

  const handleAddPaymentLine = () => {
    const totalCurrentPaid = paymentLines.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const remainingToPay = Math.max(0, (selectedOrder?.remainingBalance || 0) - totalCurrentPaid);

    const nextMethod: FinancialPaymentMethod = paymentLines.some((p) => p.method === 'cash')
      ? 'gcash'
      : 'cash';
    const compatibleAccount = accounts.find((a) =>
      isPaymentMethodCompatibleWithAccount(nextMethod, a.accountType)
    );

    setPaymentLines((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        method: nextMethod,
        accountId: compatibleAccount?.id || accounts[0]?.id || '',
        amount: remainingToPay > 0 ? remainingToPay : '',
        reference: '',
      },
    ]);
  };

  const handleRemovePaymentLine = (lineId: string) => {
    if (paymentLines.length <= 1) return;
    setPaymentLines((prev) => prev.filter((p) => p.id !== lineId));
  };

  const handleLineMethodChange = (lineId: string, newMethod: FinancialPaymentMethod) => {
    const compatibleAccount = accounts.find((a) =>
      isPaymentMethodCompatibleWithAccount(newMethod, a.accountType)
    );

    setPaymentLines((prev) =>
      prev.map((line) =>
        line.id === lineId
          ? {
              ...line,
              method: newMethod,
              accountId: compatibleAccount?.id || accounts[0]?.id || '',
            }
          : line
      )
    );
  };

  const handleLineAmountChange = (lineId: string, val: string) => {
    const parsed = val === '' ? '' : Math.max(0, parseFloat(val) || 0);
    setPaymentLines((prev) =>
      prev.map((line) => (line.id === lineId ? { ...line, amount: parsed } : line))
    );
  };

  const handleLineAccountChange = (lineId: string, accountId: string) => {
    setPaymentLines((prev) =>
      prev.map((line) => (line.id === lineId ? { ...line, accountId } : line))
    );
  };

  const handleLineReferenceChange = (lineId: string, reference: string) => {
    setPaymentLines((prev) =>
      prev.map((line) => (line.id === lineId ? { ...line, reference } : line))
    );
  };

  const totalPayment = paymentLines.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const remainingAfterPayment = selectedOrder
    ? Math.max(0, selectedOrder.remainingBalance - totalPayment)
    : 0;

  const handleSubmit = async () => {
    if (!selectedOrder) {
      setErrorMessage('Please select a booking or order to record payment.');
      return;
    }

    if (totalPayment <= 0) {
      setErrorMessage('Payment amount must be greater than zero.');
      return;
    }

    if (totalPayment > selectedOrder.remainingBalance) {
      setErrorMessage(
        `Payment total (₱${totalPayment.toFixed(2)}) exceeds remaining balance (₱${selectedOrder.remainingBalance.toFixed(2)}).`
      );
      return;
    }

    for (const line of paymentLines) {
      if (!line.accountId) {
        setErrorMessage(`Please select a financial account for ${line.method.toUpperCase()}.`);
        return;
      }
      if (!line.amount || Number(line.amount) <= 0) {
        setErrorMessage('All payment lines must have an amount greater than zero.');
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const idempotencyKey = crypto.randomUUID();

    const payload = {
      orderId: selectedOrder.id,
      idempotencyKey,
      payments: paymentLines.map((p) => ({
        amount: Number(p.amount),
        paymentMethod: p.method,
        financialAccountId: p.accountId,
        externalReference: p.reference.trim() || null,
      })),
      businessDate,
      notes: notes.trim() || null,
    };

    try {
      const result = await recordOrderPaymentAction(payload);
      if (result.ok) {
        setSuccessMessage('Payment recorded successfully!');
        if (onSuccess) onSuccess();
        setTimeout(() => {
          onClose();
        }, 1000);
      } else {
        setErrorMessage(result.error || 'Failed to record payment');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatPeso = (val: number) =>
    `₱${val.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <>
      <SheetHeader className="mb-4 text-left">
        <SheetTitle className="text-lg font-bold text-[#1E1916]">Record Payment</SheetTitle>
        <SheetDescription className="text-xs text-[#9C8878]">
          Post full, partial, or split-tender customer payments via the secure CF4 engine.
        </SheetDescription>
      </SheetHeader>

      {errorMessage && (
        <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{successMessage}</span>
        </div>
      )}

      <div className="space-y-4 text-xs">
        {/* 1. Order Details */}
        <div className="bg-white p-4 rounded-xl border border-[#EAE4DC] shadow-2xs space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-[#9C8878] uppercase mb-1">
              SELECT BOOKING / ORDER
            </label>
            {payableOrders.length === 0 ? (
              <p className="text-xs text-[#9C8878] italic">No active bookings requiring payment.</p>
            ) : (
              <select
                value={selectedOrderId}
                onChange={(e) => handleOrderChange(e.target.value)}
                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#EAE4DC] rounded-lg text-xs font-medium text-[#1E1916] focus:outline-none focus:border-[#1B4D3E]"
              >
                {payableOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.orderNumber} — {o.customerName} ({o.serviceDescription}) · Bal: {formatPeso(o.remainingBalance)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {selectedOrder && (
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#F0ECE5] text-center">
              <div className="bg-[#FAF8F5] p-2 rounded-lg">
                <div className="text-[10px] text-[#9C8878]">Total Amount</div>
                <div className="text-xs font-bold text-[#1E1916] tabular-nums mt-0.5">
                  {formatPeso(selectedOrder.totalAmount)}
                </div>
              </div>
              <div className="bg-[#FAF8F5] p-2 rounded-lg">
                <div className="text-[10px] text-[#9C8878]">Amount Paid</div>
                <div className="text-xs font-bold text-emerald-700 tabular-nums mt-0.5">
                  {formatPeso(selectedOrder.amountPaid)}
                </div>
              </div>
              <div className="bg-[#FAF8F5] p-2 rounded-lg">
                <div className="text-[10px] text-[#9C8878]">Remaining</div>
                <div className="text-xs font-bold text-[#B85214] tabular-nums mt-0.5">
                  {formatPeso(selectedOrder.remainingBalance)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 2. Payment Amount & Quick Actions */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#1E1916]">Payment Methods</span>
          <button
            type="button"
            onClick={handlePayFullBalance}
            className="text-xs font-semibold text-[#1B4D3E] hover:underline"
          >
            Pay full balance
          </button>
        </div>

        {/* 3. Payment Lines (Multi-rail split tender support) */}
        <div className="space-y-2.5">
          {paymentLines.map((line, idx) => {
            const compatibleAccounts = accounts.filter((a) =>
              isPaymentMethodCompatibleWithAccount(line.method, a.accountType)
            );

            return (
              <div
                key={line.id}
                className="bg-white p-3.5 rounded-xl border border-[#EAE4DC] shadow-2xs space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#6B5D52]">
                    Tender #{idx + 1}
                  </span>
                  {paymentLines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemovePaymentLine(line.id)}
                      className="text-rose-600 hover:text-rose-800 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-[#9C8878] uppercase mb-1">
                      METHOD
                    </label>
                    <select
                      value={line.method}
                      onChange={(e) =>
                        handleLineMethodChange(line.id, e.target.value as FinancialPaymentMethod)
                      }
                      className="w-full px-2.5 py-1.5 bg-[#FAF8F5] border border-[#EAE4DC] rounded-lg text-xs font-medium text-[#1E1916] focus:outline-none focus:border-[#1B4D3E]"
                    >
                      {FINANCIAL_PAYMENT_RAILS.map((m) => (
                        <option key={m} value={m}>
                          {m.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#9C8878] uppercase mb-1">
                      AMOUNT (₱)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={line.amount}
                      onChange={(e) => handleLineAmountChange(line.id, e.target.value)}
                      placeholder="0.00"
                      className="w-full px-2.5 py-1.5 bg-[#FAF8F5] border border-[#EAE4DC] rounded-lg text-xs font-bold text-[#1E1916] tabular-nums focus:outline-none focus:border-[#1B4D3E]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#9C8878] uppercase mb-1">
                    DEPOSIT ACCOUNT
                  </label>
                  <select
                    value={line.accountId}
                    onChange={(e) => handleLineAccountChange(line.id, e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-[#FAF8F5] border border-[#EAE4DC] rounded-lg text-xs text-[#1E1916] focus:outline-none focus:border-[#1B4D3E]"
                  >
                    {compatibleAccounts.length === 0 ? (
                      <option value="">No compatible account registered</option>
                    ) : (
                      compatibleAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({acc.identifierMask})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {line.method !== 'cash' && (
                  <div>
                    <label className="block text-[10px] font-bold text-[#9C8878] uppercase mb-1">
                      REFERENCE / TRACE # (OPTIONAL)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 1029384756"
                      value={line.reference}
                      onChange={(e) => handleLineReferenceChange(line.id, e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-[#FAF8F5] border border-[#EAE4DC] rounded-lg text-xs text-[#1E1916] focus:outline-none focus:border-[#1B4D3E]"
                    />
                  </div>
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={handleAddPaymentLine}
            className="w-full py-2 px-3 border border-dashed border-[#D4C8BC] hover:border-[#1B4D3E] bg-white hover:bg-[#FAF8F5] rounded-xl text-xs font-semibold text-[#1B4D3E] flex items-center justify-center gap-1.5 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Another Payment Method</span>
          </button>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-[#9C8878] uppercase mb-1">
            PAYMENT NOTES (OPTIONAL)
          </label>
          <input
            type="text"
            placeholder="e.g. Paid in full at front desk counter"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-white border border-[#EAE4DC] rounded-lg text-xs text-[#1E1916] focus:outline-none focus:border-[#1B4D3E]"
          />
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-[#EAE4DC] space-y-1.5">
          <div className="flex justify-between text-xs text-[#6B5D52]">
            <span>Payment Total:</span>
            <span className="font-bold text-[#1E1916] tabular-nums">{formatPeso(totalPayment)}</span>
          </div>
          <div className="flex justify-between text-xs text-[#6B5D52]">
            <span>Remaining After Payment:</span>
            <span className="font-bold text-[#B85214] tabular-nums">{formatPeso(remainingAfterPayment)}</span>
          </div>
        </div>
      </div>

      <SheetFooter className="mt-6 flex-row gap-2 sm:justify-end">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={onClose}
          className="flex-1 sm:flex-none px-4 py-2 border border-[#EAE4DC] hover:bg-[#FAF8F5] rounded-lg text-xs font-semibold text-[#6B5D52] transition"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={isSubmitting || totalPayment <= 0}
          onClick={handleSubmit}
          className="flex-1 sm:flex-none px-4 py-2 bg-[#1B4D3E] hover:bg-[#163E32] disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Posting...</span>
            </>
          ) : (
            <span>Record Payment</span>
          )}
        </button>
      </SheetFooter>
    </>
  );
}
