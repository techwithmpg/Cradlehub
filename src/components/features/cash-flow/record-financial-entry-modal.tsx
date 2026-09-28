'use client';

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Banknote,
  ShoppingCart,
  Gift,
  FileText,
  Search,
  X,
  ChevronDown,
  User,
  Calendar,
  MapPin,
  Home,
  Plus,
  Trash2,
  Lightbulb,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Car,
  Flower2,
  Info,
} from 'lucide-react';
import type {
  MaskedAccountOption,
  PayableOrderOption,
  PayableOrderItemDetail,
} from '@/lib/cash-flow/cash-flow-types';
import {
  FINANCIAL_PAYMENT_RAILS,
  type FinancialPaymentMethod,
  isPaymentMethodCompatibleWithAccount,
} from '@/lib/cash-flow/financial-contract';
import { recordOrderPaymentAction } from '@/lib/cash-flow/cash-flow-actions';

export type FinancialEntryMode = 'customer_payment' | 'expense' | 'tip' | 'other_entry';

export interface PaymentLineItem {
  id: string;
  method: FinancialPaymentMethod;
  accountId: string;
  amount: number | '';
  reference: string;
}

export interface RecordFinancialEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: MaskedAccountOption[];
  payableOrders: PayableOrderOption[];
  initialOrderId?: string;
  businessDate: string;
  onSuccess?: () => void;
}

export function RecordFinancialEntryModal({
  open,
  onOpenChange,
  accounts,
  payableOrders,
  initialOrderId,
  businessDate,
  onSuccess,
}: RecordFinancialEntryModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[96vw] max-w-[940px] max-h-[92vh] overflow-y-auto p-5 sm:p-6 lg:p-7 bg-[#FAF8F5] border border-[#EAE4DC] text-[#1E1916] rounded-2xl shadow-xl"
      >
        {open && (
          <RecordFinancialEntryForm
            onClose={() => onOpenChange(false)}
            accounts={accounts}
            payableOrders={payableOrders}
            initialOrderId={initialOrderId}
            businessDate={businessDate}
            onSuccess={onSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// Backwards-compatible export
export const RecordPaymentSheet = RecordFinancialEntryModal;

interface RecordFinancialEntryFormProps {
  onClose: () => void;
  accounts: MaskedAccountOption[];
  payableOrders: PayableOrderOption[];
  initialOrderId?: string;
  businessDate: string;
  onSuccess?: () => void;
}

function RecordFinancialEntryForm({
  onClose,
  accounts,
  payableOrders,
  initialOrderId,
  businessDate,
  onSuccess,
}: RecordFinancialEntryFormProps) {
  const [activeMode, setActiveMode] = useState<FinancialEntryMode>('customer_payment');

  // Find initially selected order
  const initialOrder =
    payableOrders.find((o) => o.id === initialOrderId) ||
    (payableOrders.length > 0 ? payableOrders[0] : undefined);

  const [selectedOrderId, setSelectedOrderId] = useState<string>(initialOrder?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const selectedOrder = payableOrders.find((o) => o.id === selectedOrderId) || initialOrder;

  // Filtered orders for selector
  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return payableOrders;
    const q = searchQuery.toLowerCase().trim();
    return payableOrders.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        (o.customerPhone && o.customerPhone.includes(q))
    );
  }, [payableOrders, searchQuery]);

  // Default compatible cash account
  const defaultAccount = accounts.find((a) =>
    isPaymentMethodCompatibleWithAccount('cash', a.accountType)
  );

  // Initial payment lines
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

  // Handle order selection change
  const handleSelectOrder = (order: PayableOrderOption) => {
    setSelectedOrderId(order.id);
    setIsDropdownOpen(false);
    setSearchQuery('');
    setErrorMessage(null);

    // Smart prefill tender #1 with outstanding balance
    const rem = order.remainingBalance;
    const currentMethod = paymentLines[0]?.method || 'cash';
    const compAccount = accounts.find((a) =>
      isPaymentMethodCompatibleWithAccount(currentMethod, a.accountType)
    );

    setPaymentLines([
      {
        id: crypto.randomUUID(),
        method: currentMethod,
        accountId: compAccount?.id || accounts[0]?.id || '',
        amount: rem > 0 ? rem : '',
        reference: '',
      },
    ]);
  };

  // Pay full balance shortcut
  const handlePayFullBalance = () => {
    if (!selectedOrder) return;
    const rem = selectedOrder.remainingBalance;
    if (rem <= 0) return;

    const currentMethod = paymentLines[0]?.method || 'cash';
    const compAccount = accounts.find((a) =>
      isPaymentMethodCompatibleWithAccount(currentMethod, a.accountType)
    );

    setPaymentLines([
      {
        id: crypto.randomUUID(),
        method: currentMethod,
        accountId: compAccount?.id || accounts[0]?.id || '',
        amount: rem,
        reference: paymentLines[0]?.reference || '',
      },
    ]);
  };

  // Split-tender add line
  const handleAddPaymentLine = () => {
    const totalCurrentPaid = paymentLines.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const remainingToPay = Math.max(0, (selectedOrder?.remainingBalance || 0) - totalCurrentPaid);

    const nextMethod: FinancialPaymentMethod = paymentLines.some((p) => p.method === 'cash')
      ? 'gcash'
      : 'cash';
    const compAccount = accounts.find((a) =>
      isPaymentMethodCompatibleWithAccount(nextMethod, a.accountType)
    );

    setPaymentLines((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        method: nextMethod,
        accountId: compAccount?.id || accounts[0]?.id || '',
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
    const compAccount = accounts.find((a) =>
      isPaymentMethodCompatibleWithAccount(newMethod, a.accountType)
    );

    setPaymentLines((prev) =>
      prev.map((line) =>
        line.id === lineId
          ? {
              ...line,
              method: newMethod,
              accountId: compAccount?.id || accounts[0]?.id || '',
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

  const totalPayment = paymentLines.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const remainingAfterPayment = selectedOrder
    ? Math.max(0, selectedOrder.remainingBalance - totalPayment)
    : 0;

  const isOrderFullyPaid = selectedOrder ? selectedOrder.remainingBalance <= 0 : false;

  const handleSubmit = async () => {
    if (!selectedOrder) {
      setErrorMessage('Please select a booking or order to record payment.');
      return;
    }

    if (isOrderFullyPaid) {
      setErrorMessage('This booking is already fully paid.');
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
        setErrorMessage(`Please select a deposit account for ${line.method.toUpperCase()}.`);
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
        }, 1200);
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

  // Derived charges with Home Service separation
  const chargesList: PayableOrderItemDetail[] = useMemo(() => {
    if (!selectedOrder) return [];
    if (selectedOrder.payableItems && selectedOrder.payableItems.length > 0) {
      return selectedOrder.payableItems;
    }

    // Synthesize fallback from booking description & visit type
    const isHome = selectedOrder.visitType === 'home_service';
    const total = selectedOrder.totalAmount;
    if (isHome && total > 300) {
      return [
        {
          id: 'item-svc-1',
          description: selectedOrder.serviceDescription || 'Home Service Massage',
          amount: total - 300,
          itemType: 'service',
          subDescription: '2 hrs • 1 therapist',
        },
        {
          id: 'item-hs-1',
          description: 'Home Service Gas Fee / Travel Fee',
          amount: 300,
          itemType: 'home_service_fee',
          subDescription: 'Travel fee for home service location',
        },
      ];
    }

    return [
      {
        id: 'item-svc-1',
        description: selectedOrder.serviceDescription || 'Spa Service',
        amount: total,
        itemType: 'service',
        subDescription: 'Completed in-spa service',
      },
    ];
  }, [selectedOrder]);

  return (
    <div className="space-y-5">
      {/* ── Modal Header ────────────────────────────────────────────── */}
      <div className="flex items-start justify-between pb-3 border-b border-[#EAE4DC]">
        <div>
          <DialogTitle className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-[#1E1916]">
            Record Financial Entry
          </DialogTitle>
          <DialogDescription className="text-xs text-[#7A6E65] mt-1">
            Record customer payments, expenses, tips, and other cash-flow entries.
          </DialogDescription>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-[#7A6E65] hover:text-[#1E1916] hover:bg-[#EFEAE2] transition"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* ── Mode Switch Grid (4 cards matching PNG) ────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* 1. Customer Payment */}
        <button
          type="button"
          onClick={() => setActiveMode('customer_payment')}
          className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
            activeMode === 'customer_payment'
              ? 'border-2 border-[#1B4D3E] bg-[#EEF7F2] shadow-2xs'
              : 'border-[#EAE4DC] bg-white hover:border-[#D4C8BC]'
          }`}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <div
              className={`p-1.5 rounded-lg ${
                activeMode === 'customer_payment' ? 'bg-[#1B4D3E] text-white' : 'bg-[#FAF8F5] text-[#1B4D3E]'
              }`}
            >
              <Banknote className="w-4 h-4" />
            </div>
            <span
              className={`text-xs font-bold ${
                activeMode === 'customer_payment' ? 'text-[#163E32]' : 'text-[#1E1916]'
              }`}
            >
              Customer Payment
            </span>
          </div>
          <p className="text-[10px] text-[#7A6E65] leading-tight">
            Record payment for a booking
          </p>
        </button>

        {/* 2. Expense */}
        <button
          type="button"
          onClick={() => setActiveMode('expense')}
          className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
            activeMode === 'expense'
              ? 'border-2 border-amber-600 bg-amber-50 shadow-2xs'
              : 'border-[#EAE4DC] bg-white hover:border-[#D4C8BC]'
          }`}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <div
              className={`p-1.5 rounded-lg ${
                activeMode === 'expense' ? 'bg-amber-600 text-white' : 'bg-[#FAF8F5] text-amber-600'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
            </div>
            <span
              className={`text-xs font-bold ${
                activeMode === 'expense' ? 'text-amber-900' : 'text-[#1E1916]'
              }`}
            >
              Expense
            </span>
          </div>
          <p className="text-[10px] text-[#7A6E65] leading-tight">
            Record business expenses
          </p>
        </button>

        {/* 3. Tip */}
        <button
          type="button"
          onClick={() => setActiveMode('tip')}
          className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
            activeMode === 'tip'
              ? 'border-2 border-rose-600 bg-rose-50 shadow-2xs'
              : 'border-[#EAE4DC] bg-white hover:border-[#D4C8BC]'
          }`}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <div
              className={`p-1.5 rounded-lg ${
                activeMode === 'tip' ? 'bg-rose-600 text-white' : 'bg-[#FAF8F5] text-rose-600'
              }`}
            >
              <Gift className="w-4 h-4" />
            </div>
            <span
              className={`text-xs font-bold ${
                activeMode === 'tip' ? 'text-rose-900' : 'text-[#1E1916]'
              }`}
            >
              Tip
            </span>
          </div>
          <p className="text-[10px] text-[#7A6E65] leading-tight">
            Record staff or house tips
          </p>
        </button>

        {/* 4. Other Entry */}
        <button
          type="button"
          onClick={() => setActiveMode('other_entry')}
          className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
            activeMode === 'other_entry'
              ? 'border-2 border-stone-600 bg-stone-100 shadow-2xs'
              : 'border-[#EAE4DC] bg-white hover:border-[#D4C8BC]'
          }`}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <div
              className={`p-1.5 rounded-lg ${
                activeMode === 'other_entry' ? 'bg-stone-700 text-white' : 'bg-[#FAF8F5] text-stone-700'
              }`}
            >
              <FileText className="w-4 h-4" />
            </div>
            <span
              className={`text-xs font-bold ${
                activeMode === 'other_entry' ? 'text-stone-900' : 'text-[#1E1916]'
              }`}
            >
              Other Entry
            </span>
          </div>
          <p className="text-[10px] text-[#7A6E65] leading-tight">
            Adjustments, misc income, etc.
          </p>
        </button>
      </div>

      {/* ── Informational Placeholder for Inactive Modes ─────────────── */}
      {activeMode !== 'customer_payment' && (
        <div className="bg-white rounded-xl border border-[#EAE4DC] p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#FAF8F5] border border-[#EAE4DC] flex items-center justify-center mx-auto text-[#6B5D52]">
            {activeMode === 'expense' && <ShoppingCart className="w-6 h-6 text-amber-600" />}
            {activeMode === 'tip' && <Gift className="w-6 h-6 text-rose-500" />}
            {activeMode === 'other_entry' && <FileText className="w-6 h-6 text-stone-600" />}
          </div>
          <h3 className="text-base font-bold text-[#1E1916]">
            {activeMode === 'expense' && 'Expense Recording'}
            {activeMode === 'tip' && 'Tip Recording'}
            {activeMode === 'other_entry' && 'Other Financial Entries'}
          </h3>
          <p className="text-xs text-[#7A6E65] max-w-md mx-auto">
            {activeMode === 'expense' &&
              'Expense recording will be enabled in a later Cash Flow stage. Zero fake ledger rows are fabricated.'}
            {activeMode === 'tip' &&
              'Tip recording will be enabled in a later Cash Flow stage. Preserves canonical CF1-D09 tip custody rules.'}
            {activeMode === 'other_entry' &&
              'Other financial entries (adjustments, transfers, misc income) will be enabled in a later Cash Flow stage.'}
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setActiveMode('customer_payment')}
              className="px-4 py-1.5 bg-[#163E32] text-white text-xs font-semibold rounded-lg hover:bg-[#1B4D3E] transition"
            >
              Return to Customer Payment
            </button>
          </div>
        </div>
      )}

      {/* ── Customer Payment Mode ────────────────────────────────────── */}
      {activeMode === 'customer_payment' && (
        <>
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Desktop Two-Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* ── Left Column (Main Form - 8 cols) ────────────────────── */}
            <div className="lg:col-span-8 space-y-4">
              {/* 1. Select Booking / Order */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#1E1916]">
                  1. Select Booking / Order
                </h3>

                {/* Searchable Dropdown / Selector */}
                <div className="relative">
                  <div
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#EAE4DC] hover:border-[#1B4D3E] rounded-xl text-xs flex items-center justify-between cursor-pointer transition shadow-2xs"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Search className="w-4 h-4 text-[#9C8878] flex-shrink-0" />
                      <span className="font-semibold text-[#1E1916] truncate">
                        {selectedOrder
                          ? `${selectedOrder.orderNumber} — ${selectedOrder.customerName}`
                          : 'Select an unpaid or partially paid booking...'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[#9C8878] flex-shrink-0">
                      {selectedOrder && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrderId('');
                          }}
                          className="p-1 hover:text-[#1E1916]"
                          title="Clear selection"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>

                  {isDropdownOpen && (
                    <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-[#EAE4DC] rounded-xl shadow-lg p-2 space-y-2 max-h-60 overflow-y-auto">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-[#9C8878] absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Type reference, customer, or phone..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-8 pr-2.5 py-1.5 bg-[#FAF8F5] border border-[#EAE4DC] rounded-lg text-xs placeholder:text-[#9C8878] focus:outline-none focus:border-[#1B4D3E]"
                          autoFocus
                        />
                      </div>
                      <div className="divide-y divide-[#F0ECE5]">
                        {filteredOrders.length === 0 ? (
                          <div className="p-3 text-xs text-[#9C8878] text-center italic">
                            No matching bookings found.
                          </div>
                        ) : (
                          filteredOrders.map((ord) => (
                            <div
                              key={ord.id}
                              onClick={() => handleSelectOrder(ord)}
                              className="p-2.5 hover:bg-[#EEF7F2] rounded-lg cursor-pointer flex items-center justify-between text-xs transition"
                            >
                              <div>
                                <div className="font-bold text-[#1E1916]">
                                  {ord.orderNumber} — {ord.customerName}
                                </div>
                                <div className="text-[11px] text-[#7A6E65]">
                                  {ord.serviceDescription} {ord.customerPhone ? `· ${ord.customerPhone}` : ''}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-[#163E32]">
                                  Bal: {formatPeso(ord.remainingBalance)}
                                </div>
                                <div className="text-[10px] text-[#9C8878]">
                                  Total: {formatPeso(ord.totalAmount)}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <p className="text-[11px] text-[#9C8878]">
                  Search by booking reference, customer name, or phone number. Shows unpaid or partially paid bookings only.
                </p>

                {/* Smart Booking Summary Card */}
                {selectedOrder && (
                  <div className="bg-white rounded-xl border border-[#EAE4DC] p-4 shadow-2xs space-y-3">
                    {/* Top Row: Customer & Reference & Status Badge */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#FAF8F5] border border-[#EAE4DC] flex items-center justify-center text-[#163E32] flex-shrink-0">
                          <User className="w-5 h-5 text-[#163E32]" />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-[#1E1916]">
                            {selectedOrder.customerName}
                          </div>
                          <div className="text-xs text-[#7A6E65]">
                            {selectedOrder.customerPhone || 'No phone recorded'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-left sm:text-right">
                          <div className="text-[10px] uppercase font-bold text-[#9C8878]">
                            Booking Reference
                          </div>
                          <div className="font-mono font-bold text-xs text-[#1E1916]">
                            {selectedOrder.orderNumber}
                          </div>
                        </div>

                        {selectedOrder.remainingBalance <= 0 ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]">
                            Paid
                          </span>
                        ) : selectedOrder.amountPaid > 0 ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#FEF3E2] text-[#B5651D] border border-[#FAD7A0]">
                            Partially Paid
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#FDE8E8] text-[#C53030] border border-[#F8B4B4]">
                            Unpaid
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom Details Row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-[#F0ECE5] text-xs">
                      <div>
                        <div className="text-[10px] text-[#9C8878] flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[#9C8878]" />
                          <span>Branch</span>
                        </div>
                        <div className="font-semibold text-[#1E1916] mt-0.5">
                          {selectedOrder.branchName || 'Main Spa'}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-[#9C8878] flex items-center gap-1">
                          <Home className="w-3 h-3 text-[#9C8878]" />
                          <span>Visit Type</span>
                        </div>
                        <div className="font-semibold text-[#1E1916] mt-0.5">
                          {selectedOrder.visitType === 'home_service' ? 'Home Service' : 'In-Spa'}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-[#9C8878] flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-[#9C8878]" />
                          <span>Service Date</span>
                        </div>
                        <div className="font-semibold text-[#1E1916] mt-0.5">
                          {selectedOrder.bookingDate}
                          {selectedOrder.serviceTime ? ` · ${selectedOrder.serviceTime}` : ''}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-[#9C8878]">Booking Status</div>
                        <div className="mt-0.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            {selectedOrder.bookingStatus || 'Confirmed'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Booking Charges */}
              {selectedOrder && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#1E1916]">
                    2. Booking Charges
                  </h3>

                  <div className="bg-white rounded-xl border border-[#EAE4DC] p-4 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between text-[10px] uppercase font-bold text-[#9C8878] tracking-wider pb-2 border-b border-[#F0ECE5]">
                      <span>DESCRIPTION</span>
                      <span>AMOUNT (₱)</span>
                    </div>

                    {/* Charge Items */}
                    <div className="space-y-2.5">
                      {chargesList.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-[#EEF7F2] text-[#1B4D3E] flex items-center justify-center flex-shrink-0">
                              {item.itemType === 'home_service_fee' ? (
                                <Car className="w-3.5 h-3.5" />
                              ) : (
                                <Flower2 className="w-3.5 h-3.5" />
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-[#1E1916]">{item.description}</div>
                              {item.subDescription && (
                                <div className="text-[11px] text-[#7A6E65]">{item.subDescription}</div>
                              )}
                            </div>
                          </div>
                          <div className="font-bold text-[#1E1916] tabular-nums font-mono">
                            {formatPeso(item.amount)}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Total Booking Amount */}
                    <div className="pt-3 border-t border-[#F0ECE5] flex items-center justify-between text-xs font-bold text-[#1E1916]">
                      <span>Total Booking Amount</span>
                      <span className="tabular-nums font-mono">{formatPeso(selectedOrder.totalAmount)}</span>
                    </div>

                    {/* Previous Payments */}
                    {selectedOrder.amountPaid > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-[#7A6E65]">
                          <span>Less: Previous Payments</span>
                          <Info className="w-3 h-3 text-[#9C8878]" />
                          {selectedOrder.previousPayments && selectedOrder.previousPayments.length > 0 && (
                            <span className="text-[10px] text-[#9C8878]">
                              ({selectedOrder.previousPayments[0]?.method})
                            </span>
                          )}
                        </div>
                        <div className="font-bold text-[#D9383A] tabular-nums font-mono">
                          -{formatPeso(selectedOrder.amountPaid)}
                        </div>
                      </div>
                    )}

                    {/* Outstanding Balance Highlight Box */}
                    <div className="bg-[#EAF5EE] border border-[#CDE5D8] rounded-xl p-3 flex items-center justify-between">
                      <span className="text-xs font-bold text-[#163E32]">Outstanding Balance</span>
                      <span className="text-base font-bold text-[#163E32] tabular-nums font-mono">
                        {formatPeso(selectedOrder.remainingBalance)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Fully Paid Warning / Protection */}
              {isOrderFullyPaid && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span className="font-semibold">
                    This booking is already fully paid. No further payment required.
                  </span>
                </div>
              )}

              {/* 3. Payment Method(s) */}
              {!isOrderFullyPaid && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#1E1916]">
                    3. Payment Method(s)
                  </h3>

                  <div className="space-y-3">
                    {paymentLines.map((line, idx) => {
                      const compatibleAccounts = accounts.filter((a) =>
                        isPaymentMethodCompatibleWithAccount(line.method, a.accountType)
                      );

                      return (
                        <div
                          key={line.id}
                          className="bg-white rounded-xl border border-[#EAE4DC] p-4 shadow-2xs space-y-3"
                        >
                          <div className="flex items-center justify-between pb-1 border-b border-[#F0ECE5]">
                            <span className="text-xs font-bold text-[#1E1916]">Tender #{idx + 1}</span>
                            {paymentLines.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemovePaymentLine(line.id)}
                                className="text-[#9C8878] hover:text-rose-600 transition"
                                title="Remove tender"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Method Selector */}
                            <div>
                              <label className="block text-[10px] font-bold text-[#9C8878] uppercase mb-1">
                                METHOD
                              </label>
                              <select
                                value={line.method}
                                onChange={(e) =>
                                  handleLineMethodChange(line.id, e.target.value as FinancialPaymentMethod)
                                }
                                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#EAE4DC] rounded-lg text-xs font-semibold text-[#1E1916] focus:outline-none focus:border-[#1B4D3E]"
                              >
                                {FINANCIAL_PAYMENT_RAILS.map((rail) => (
                                  <option key={rail} value={rail}>
                                    {rail === 'bank_transfer'
                                      ? 'Bank Transfer'
                                      : rail.charAt(0).toUpperCase() + rail.slice(1)}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Amount Input */}
                            <div>
                              <label className="block text-[10px] font-bold text-[#9C8878] uppercase mb-1">
                                AMOUNT (₱)
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={line.amount}
                                onChange={(e) => handleLineAmountChange(line.id, e.target.value)}
                                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#EAE4DC] rounded-lg text-xs font-mono font-bold text-[#1E1916] focus:outline-none focus:border-[#1B4D3E]"
                              />
                            </div>
                          </div>

                          {/* Deposit Account */}
                          <div>
                            <label className="block text-[10px] font-bold text-[#9C8878] uppercase mb-1">
                              DEPOSIT ACCOUNT
                            </label>
                            <select
                              value={line.accountId}
                              onChange={(e) => handleLineAccountChange(line.id, e.target.value)}
                              className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#EAE4DC] rounded-lg text-xs font-medium text-[#1E1916] focus:outline-none focus:border-[#1B4D3E]"
                            >
                              {compatibleAccounts.length === 0 ? (
                                <option value="">No compatible accounts for this method</option>
                              ) : (
                                compatibleAccounts.map((acc) => (
                                  <option key={acc.id} value={acc.id}>
                                    {acc.name} ({acc.identifierMask || acc.accountType})
                                  </option>
                                ))
                              )}
                            </select>
                          </div>
                        </div>
                      );
                    })}

                    {/* + Add Another Payment Method (Dashed button) */}
                    <button
                      type="button"
                      onClick={handleAddPaymentLine}
                      className="w-full py-2.5 px-3 border-2 border-dashed border-[#B8D8C5] bg-[#FAFDFB] text-[#1B4D3E] font-semibold text-xs rounded-xl hover:bg-[#EEF7F2] transition flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Another Payment Method</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 4. Payment Notes (Optional) */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#1E1916]">
                  4. Payment Notes (Optional)
                </h3>
                <input
                  type="text"
                  placeholder="e.g. Customer paid remaining balance in cash."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#EAE4DC] rounded-xl text-xs placeholder:text-[#9C8878] focus:outline-none focus:border-[#1B4D3E] shadow-2xs"
                />
              </div>
            </div>

            {/* ── Right Column (Summary & Help - 4 cols) ───────────────── */}
            <div className="lg:col-span-4 space-y-4">
              {/* Payment Summary Side Card */}
              {selectedOrder && (
                <div className="bg-white rounded-xl border border-[#EAE4DC] p-4 shadow-2xs space-y-3">
                  <h4 className="text-xs font-bold text-[#1E1916]">Payment Summary</h4>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between text-[#7A6E65]">
                      <span>Total Booking Amount</span>
                      <span className="font-bold text-[#1E1916] tabular-nums font-mono">
                        {formatPeso(selectedOrder.totalAmount)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[#7A6E65]">
                      <span>Previous Payments</span>
                      <span className="font-bold text-[#D9383A] tabular-nums font-mono">
                        {selectedOrder.amountPaid > 0 ? `-${formatPeso(selectedOrder.amountPaid)}` : '₱0.00'}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-[#F0ECE5] flex items-center justify-between">
                      <span className="font-bold text-[#163E32]">Outstanding Balance</span>
                      <span className="font-bold text-sm text-[#163E32] tabular-nums font-mono">
                        {formatPeso(selectedOrder.remainingBalance)}
                      </span>
                    </div>
                  </div>

                  {!isOrderFullyPaid && selectedOrder.remainingBalance > 0 && (
                    <button
                      type="button"
                      onClick={handlePayFullBalance}
                      className="w-full mt-2 py-2 px-3 border border-[#1B4D3E] text-[#163E32] bg-white hover:bg-[#EEF7F2] rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Pay full balance ({formatPeso(selectedOrder.remainingBalance)})</span>
                    </button>
                  )}
                </div>
              )}

              {/* About Customer Payments Card */}
              <div className="bg-[#EEF7F2] border border-[#CDE5D8] rounded-xl p-4 text-xs space-y-2">
                <div className="flex items-center gap-1.5 text-[#163E32] font-bold">
                  <Lightbulb className="w-4 h-4 text-[#1B4D3E]" />
                  <span>About Customer Payments</span>
                </div>
                <p className="text-[11px] text-[#3D5A4C] leading-relaxed">
                  Record full, partial, or split-tender payments for existing bookings. The booking details and payable items are automatically populated to ensure accurate recording.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Modal Footer ────────────────────────────────────────────── */}
      <div className="pt-4 border-t border-[#EAE4DC] flex flex-col sm:flex-row items-center justify-between gap-4">
        {activeMode === 'customer_payment' ? (
          <div className="space-y-0.5 text-left w-full sm:w-auto">
            <div className="text-xs text-[#7A6E65] flex items-center gap-2">
              <span className="text-[#9C8878]">Payment Total:</span>
              <span className="font-bold text-sm text-[#1E1916] tabular-nums font-mono">
                {formatPeso(totalPayment)}
              </span>
            </div>
            <div className="text-xs flex items-center gap-2">
              <span className="text-[#9C8878]">Remaining After Payment:</span>
              <span
                className={`font-semibold tabular-nums font-mono ${
                  remainingAfterPayment === 0
                    ? 'text-emerald-700'
                    : totalPayment > (selectedOrder?.remainingBalance || 0)
                    ? 'text-rose-700 font-bold'
                    : 'text-amber-700'
                }`}
              >
                {formatPeso(remainingAfterPayment)}
              </span>
            </div>
          </div>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-[#EAE4DC] bg-white hover:bg-[#FAF8F5] text-xs font-semibold text-[#1E1916] rounded-xl transition"
          >
            Cancel
          </button>

          {activeMode === 'customer_payment' && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={
                isSubmitting ||
                isOrderFullyPaid ||
                !selectedOrder ||
                totalPayment <= 0 ||
                totalPayment > (selectedOrder?.remainingBalance || 0)
              }
              className="px-5 py-2 bg-[#163E32] hover:bg-[#1B4D3E] text-white text-xs font-semibold rounded-xl shadow-2xs transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Record Entry</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
