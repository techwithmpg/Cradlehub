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
  Lock,
  UploadCloud,
} from 'lucide-react';
import type {
  MaskedAccountOption,
  PayableOrderOption,
  PayableOrderItemDetail,
  ExpenseCategoryOption,
  StaffOption,
  CashSessionSummary,
} from '@/lib/cash-flow/cash-flow-types';
import {
  FINANCIAL_PAYMENT_RAILS,
  type FinancialPaymentMethod,
  isPaymentMethodCompatibleWithAccount,
} from '@/lib/cash-flow/financial-contract';
import {
  recordOrderPaymentAction,
  recordLegacyBookingPaymentAction,
  recordExpenseAction,
  recordTipAction,
  recordOtherEntryAction,
} from '@/lib/cash-flow/cash-flow-actions';

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
  expenseCategories?: ExpenseCategoryOption[];
  staffOptions?: StaffOption[];
  payableOrders?: PayableOrderOption[];
  activeCashSessions?: CashSessionSummary[];
  initialOrderId?: string;
  initialMode?: FinancialEntryMode;
  branchId?: string;
  businessDate: string;
  onSuccess?: () => void;
}

export function RecordFinancialEntryModal({
  open,
  onOpenChange,
  accounts,
  expenseCategories,
  staffOptions,
  payableOrders,
  activeCashSessions = [],
  initialOrderId,
  initialMode,
  branchId,
  businessDate,
  onSuccess,
}: RecordFinancialEntryModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex flex-col p-0 gap-0 overflow-hidden w-[96vw] md:w-[min(94vw,1000px)] max-w-none sm:max-w-none max-h-[90vh] bg-[#FAF8F5] border border-[#EAE4DC] text-[#1E1916] rounded-2xl shadow-2xl"
      >
        {open && (
          <RecordFinancialEntryForm
            onClose={() => onOpenChange(false)}
            accounts={accounts}
            expenseCategories={expenseCategories}
            staffOptions={staffOptions}
            payableOrders={payableOrders}
            activeCashSessions={activeCashSessions}
            initialOrderId={initialOrderId}
            initialMode={initialMode}
            branchId={branchId}
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
  expenseCategories?: ExpenseCategoryOption[];
  staffOptions?: StaffOption[];
  payableOrders?: PayableOrderOption[];
  activeCashSessions?: CashSessionSummary[];
  initialOrderId?: string;
  initialMode?: FinancialEntryMode;
  branchId?: string;
  businessDate: string;
  onSuccess?: () => void;
}

function RecordFinancialEntryForm({
  onClose,
  accounts,
  expenseCategories = [],
  staffOptions = [],
  payableOrders = [],
  activeCashSessions = [],
  initialOrderId,
  initialMode,
  branchId,
  businessDate,
  onSuccess,
}: RecordFinancialEntryFormProps) {
  const [activeMode, setActiveMode] = useState<FinancialEntryMode>(initialMode || 'customer_payment');

  // Find initially selected order
  const initialOrder =
    payableOrders.find((o) => o.id === initialOrderId) ||
    (payableOrders.length === 1 ? payableOrders[0] : undefined);

  const [selectedOrderId, setSelectedOrderId] = useState<string>(initialOrder?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(payableOrders.length > 1 && initialMode !== 'expense');

  const selectedOrder = payableOrders.find((o) => o.id === selectedOrderId);

  // Filtered orders for selector
  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return payableOrders;
    const q = searchQuery.toLowerCase().trim();
    const digits = q.replace(/\D/g, '');
    return payableOrders.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        Boolean(o.customerPhone && (
          o.customerPhone.toLowerCase().includes(q) ||
          (digits && o.customerPhone.replace(/\D/g, '').includes(digits))
        ))
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
      accountId: defaultAccount?.id || '',
      amount: selectedOrder && selectedOrder.remainingBalance > 0 ? selectedOrder.remainingBalance : '',
      reference: '',
    },
  ]);

  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const paymentAttemptRef = React.useRef<{ signature: string; key: string } | null>(null);

  // Fallbacks for categories and staff
  const effectiveCategories = useMemo(() => {
    if (expenseCategories && expenseCategories.length > 0) return expenseCategories;
    return [
      { id: 'cat-fuel', code: 'fuel', name: 'Fuel & Transportation' },
      { id: 'cat-supplies', code: 'supplies', name: 'Spa Supplies & Materials' },
      { id: 'cat-laundry', code: 'laundry', name: 'Laundry Services' },
      { id: 'cat-utilities', code: 'utilities', name: 'Water & Utilities' },
      { id: 'cat-allowance', code: 'staff_allowance', name: 'Staff Allowance & Meals' },
      { id: 'cat-maintenance', code: 'maintenance', name: 'Repairs & Maintenance' },
      { id: 'cat-telecom', code: 'telecom', name: 'Telecom & Internet' },
      { id: 'cat-services', code: 'services', name: 'Business Services' },
      { id: 'cat-other', code: 'other', name: 'Other Operating Expense' },
    ];
  }, [expenseCategories]);

  const effectiveStaff = useMemo(() => {
    if (staffOptions && staffOptions.length > 0) return staffOptions;
    return [
      { id: 'staff-general', name: 'Duty Staff / Therapist', role: 'staff' },
    ];
  }, [staffOptions]);

  // Operational Expense state
  const [expenseAmount, setExpenseAmount] = useState<number | ''>('');
  const [expenseCategoryId, setExpenseCategoryId] = useState<string>(() => effectiveCategories[0]?.id || '');
  const [expenseAccountId, setExpenseAccountId] = useState<string>(() => defaultAccount?.id || accounts[0]?.id || '');
  const [expensePayee, setExpensePayee] = useState<string>('');
  const [expenseDescription, setExpenseDescription] = useState<string>('');
  const [expenseReceiptRef, setExpenseReceiptRef] = useState<string>('');
  const [expenseNotes, setExpenseNotes] = useState<string>('');

  // Receipt attachment state (CF7)
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const receiptFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const expenseAttemptRef = React.useRef<{ signature: string; key: string } | null>(null);

  const handleRemoveReceipt = () => {
    if (receiptPreviewUrl) {
      URL.revokeObjectURL(receiptPreviewUrl);
    }
    setReceiptFile(null);
    setReceiptPreviewUrl(null);
    setReceiptError(null);
    if (receiptFileInputRef.current) {
      receiptFileInputRef.current.value = '';
    }
  };

  const handleReceiptFileChange = (file: File | null) => {
    if (!file) return;
    const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

    if (!ALLOWED_MIME.includes(file.type)) {
      setReceiptError('Invalid file type. Allowed formats: JPEG, PNG, WebP, PDF.');
      return;
    }
    if (file.size > MAX_SIZE) {
      setReceiptError('File size exceeds the 5 MB limit.');
      return;
    }

    if (receiptPreviewUrl) {
      URL.revokeObjectURL(receiptPreviewUrl);
    }

    setReceiptError(null);
    setReceiptFile(file);
    if (file.type.startsWith('image/')) {
      setReceiptPreviewUrl(URL.createObjectURL(file));
    } else {
      setReceiptPreviewUrl(null);
    }
  };

  // Tip state
  const [tipCustodyType, setTipCustodyType] = useState<'direct_cash' | 'company_custodied'>('direct_cash');
  const [tipBeneficiaryStaffId, setTipBeneficiaryStaffId] = useState<string>(() => effectiveStaff[0]?.id || '');
  const [tipAmount, setTipAmount] = useState<number | ''>('');
  const [tipAccountId, setTipAccountId] = useState<string>(() => defaultAccount?.id || accounts[0]?.id || '');
  const [tipPaymentMethod, setTipPaymentMethod] = useState<FinancialPaymentMethod>('cash');
  const [tipNotes, setTipNotes] = useState<string>('');

  // Other Entry / CF8-C Cash Operations state
  const [otherEntryType, setOtherEntryType] = useState<
    'misc_income' | 'cash_addition' | 'cash_removal' | 'transfer' | 'generic_adjustment'
  >('misc_income');
  const [otherAmount, setOtherAmount] = useState<number | ''>('');
  const [otherNotes, setOtherNotes] = useState('');
  const [miscReceivingAccountId, setMiscReceivingAccountId] = useState(() => accounts[0]?.id || '');
  const [miscDescription, setMiscDescription] = useState('');
  const [miscPayeeSource, setMiscPayeeSource] = useState('');
  const [miscPaymentMethod, setMiscPaymentMethod] = useState<FinancialPaymentMethod>('cash');

  const preferredCashDrawerId =
    activeCashSessions.find(
      (session) => session.status === 'open' && session.businessDate === businessDate
    )?.cashDrawerAccountId ||
    defaultAccount?.id ||
    accounts.find((account) => account.accountType === 'cash_drawer')?.id ||
    '';

  const [cashDrawerId, setCashDrawerId] = useState(() => preferredCashDrawerId);
  const [cashAdjustmentReason, setCashAdjustmentReason] = useState('');

  const [transferSourceAccountId, setTransferSourceAccountId] = useState(
    () => preferredCashDrawerId || accounts[0]?.id || ''
  );

  const [transferDestAccountId, setTransferDestAccountId] = useState(() => {
    const sourceId = preferredCashDrawerId || accounts[0]?.id || '';
    return accounts.find((account) => account.id !== sourceId)?.id || '';
  });

  const activeCashSessionsForDate = useMemo(
    () =>
      activeCashSessions.filter(
        (session) => session.status === 'open' && session.businessDate === businessDate
      ),
    [activeCashSessions, businessDate]
  );

  const openCashDrawerIds = useMemo(
    () => new Set(activeCashSessionsForDate.map((session) => session.cashDrawerAccountId)),
    [activeCashSessionsForDate]
  );

  const selectedCashSession = activeCashSessionsForDate.find(
    (session) => session.cashDrawerAccountId === cashDrawerId
  );

  const transferDestinationOptions = accounts.filter(
    (account) => account.id !== transferSourceAccountId
  );

  const transferSourceAccount = accounts.find(
    (account) => account.id === transferSourceAccountId
  );

  const transferDestinationAccount = accounts.find(
    (account) => account.id === transferDestAccountId
  );

  const transferTouchesClosedDrawer =
    [transferSourceAccount, transferDestinationAccount].some(
      (account) =>
        account?.accountType === 'cash_drawer' &&
        !openCashDrawerIds.has(account.id)
    );

  const adjustmentAmount =
    typeof otherAmount === 'number' && Number.isFinite(otherAmount)
      ? otherAmount
      : 0;

  const expectedCashAfterAdjustment = selectedCashSession
    ? selectedCashSession.expectedCash +
      (otherEntryType === 'cash_addition'
        ? adjustmentAmount
        : otherEntryType === 'cash_removal'
          ? -adjustmentAmount
          : 0)
    : null;

  const cashAdjustmentBlocked =
    (otherEntryType === 'cash_addition' || otherEntryType === 'cash_removal') &&
    (
      !cashDrawerId ||
      !openCashDrawerIds.has(cashDrawerId) ||
      !cashAdjustmentReason.trim()
    );

  const transferBlocked =
    otherEntryType === 'transfer' &&
    (
      !transferSourceAccountId ||
      !transferDestAccountId ||
      transferSourceAccountId === transferDestAccountId ||
      transferDestinationOptions.length === 0 ||
      transferTouchesClosedDrawer
    );

  const otherEntryAttemptRef = React.useRef<{
    signature: string;
    key: string;
  } | null>(null);
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
        accountId: compAccount?.id || '',
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
        accountId: compAccount?.id || '',
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
        accountId: compAccount?.id || '',
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
              accountId: compAccount?.id || '',
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
  const hasMissingCompatibleAccount = paymentLines.some((line) =>
    !accounts.some((account) =>
      account.id === line.accountId &&
      isPaymentMethodCompatibleWithAccount(line.method, account.accountType)
    )
  );
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

    if (hasMissingCompatibleAccount) {
      setErrorMessage('No compatible financial account is configured for the selected payment method. Ask an administrator to set up the account.');
      return;
    }
    for (const line of paymentLines) {
      if (!line.amount || Number(line.amount) <= 0) {
        setErrorMessage('All payment lines must have an amount greater than zero.');
        return;
      }
    }
    if (selectedOrder.sourceKind === 'legacy_booking' && !branchId) {
      setErrorMessage('Branch context is required to record this booking payment.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const payments = paymentLines.map((p) => ({
      amount: Number(p.amount),
      paymentMethod: p.method,
      financialAccountId: p.accountId,
      externalReference: p.reference.trim() || null,
    }));
    const signature = JSON.stringify({
      sourceKind: selectedOrder.sourceKind,
      sourceId: selectedOrder.id,
      amountPaid: selectedOrder.amountPaid,
      businessDate,
      payments,
      notes: notes.trim(),
    });
    if (paymentAttemptRef.current?.signature !== signature) {
      paymentAttemptRef.current = { signature, key: crypto.randomUUID() };
    }
    const idempotencyKey = paymentAttemptRef.current.key;

    try {
      const result = selectedOrder.sourceKind === 'legacy_booking'
        ? await recordLegacyBookingPaymentAction({
          bookingId: selectedOrder.id,
          branchId: branchId!,
          expectedAmountPaid: selectedOrder.amountPaid,
          idempotencyKey,
          payments,
          businessDate,
          notes: notes.trim() || null,
        })
        : await recordOrderPaymentAction({
          orderId: selectedOrder.id,
          idempotencyKey,
          payments,
          businessDate,
          notes: notes.trim() || null,
        });
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

  const handleExpenseSubmit = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setReceiptError(null);

    const amt = typeof expenseAmount === 'number' ? expenseAmount : parseFloat(expenseAmount);
    if (!amt || amt <= 0) {
      setErrorMessage('Please enter a valid expense amount greater than ₱0.00.');
      return;
    }
    if (!expenseCategoryId) {
      setErrorMessage('Please select an expense category.');
      return;
    }
    if (!expenseAccountId) {
      setErrorMessage('Please select a payment account.');
      return;
    }
    if (!expenseDescription.trim()) {
      setErrorMessage('Please provide an expense description.');
      return;
    }

    const effectiveBranchId =
      branchId ||
      accounts.find((a) => a.id === expenseAccountId)?.branchId ||
      accounts[0]?.branchId ||
      '';

    const signature = JSON.stringify({
      effectiveBranchId, businessDate, amt, expenseCategoryId, expenseAccountId,
      expensePayee, expenseDescription, expenseReceiptRef, expenseNotes,
      receipt: receiptFile && [receiptFile.name, receiptFile.size, receiptFile.type, receiptFile.lastModified],
    });
    if (expenseAttemptRef.current?.signature !== signature) {
      expenseAttemptRef.current = {
        signature,
        key: `cf7_exp_${typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}_${Math.random().toString(36).slice(2)}`}`,
      };
    }
    const receiptForm = receiptFile ? new FormData() : undefined;
    if (receiptFile) receiptForm?.set('receipt', receiptFile);

    setIsUploadingReceipt(Boolean(receiptFile));
    setIsSubmitting(true);
    try {
      const res = await recordExpenseAction({
        branchId: effectiveBranchId || undefined,
        amount: amt,
        categoryId: expenseCategoryId,
        financialAccountId: expenseAccountId,
        payee: expensePayee.trim() || 'Direct Vendor',
        description: expenseDescription.trim(),
        receiptReference: expenseReceiptRef.trim() || undefined,
        businessDate,
        notes: expenseNotes.trim() || undefined,
        idempotencyKey: expenseAttemptRef.current.key,
      }, receiptForm);

      if (!res.ok) {
        setErrorMessage(res.error || 'Failed to record expense.');
        return;
      }

      setSuccessMessage(res.warning || 'Operational expense recorded successfully!');
      if (onSuccess) onSuccess();
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
      setIsUploadingReceipt(false);
    }
  };

  const handleTipSubmit = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    const amt = typeof tipAmount === 'number' ? tipAmount : parseFloat(tipAmount);
    if (!amt || amt <= 0) {
      setErrorMessage('Please enter a valid tip amount greater than ₱0.00.');
      return;
    }
    if (!tipBeneficiaryStaffId) {
      setErrorMessage('Please select the therapist receiving the tip.');
      return;
    }
    if (tipCustodyType === 'company_custodied' && !tipAccountId) {
      setErrorMessage('Please select the account receiving company-custodied tip funds.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await recordTipAction({
        amount: amt,
        beneficiaryStaffId: tipBeneficiaryStaffId,
        custodyType: tipCustodyType,
        financialAccountId: tipCustodyType === 'company_custodied' ? tipAccountId : undefined,
        paymentMethod: tipPaymentMethod,
        businessDate,
        notes: tipNotes.trim() || undefined,
        idempotencyKey: `cf6_tip_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      });

      if (!res.ok) {
        setErrorMessage(res.error || 'Failed to record tip.');
        return;
      }

      setSuccessMessage(
        tipCustodyType === 'direct_cash'
          ? 'Direct therapist tip recorded for transparency (zero company custody).'
          : 'Company-custodied tip recorded (liability pending disbursement).'
      );
      if (onSuccess) onSuccess();
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtherEntrySubmit = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (otherEntryType === 'generic_adjustment') {
      setErrorMessage('Policy Required: Generic adjustments remain locked pending management reconciliation policy.');
      return;
    }

    const amt = typeof otherAmount === 'number' ? otherAmount : parseFloat(otherAmount);
    if (!amt || amt <= 0) {
      setErrorMessage('Please enter a valid amount greater than ₱0.00.');
      return;
    }

    if (otherEntryType === 'cash_addition' || otherEntryType === 'cash_removal') {
      if (!cashDrawerId || !openCashDrawerIds.has(cashDrawerId)) {
        setErrorMessage('Open the cash drawer before recording physical cash operations.');
        return;
      }

      if (!cashAdjustmentReason.trim()) {
        setErrorMessage('A reason is required for every cash adjustment.');
        return;
      }
    }

    if (otherEntryType === 'transfer') {
      if (!transferSourceAccountId || !transferDestAccountId) {
        setErrorMessage('Configure a real destination financial account before recording a transfer.');
        return;
      }

      if (transferSourceAccountId === transferDestAccountId) {
        setErrorMessage('Source and destination accounts must be different.');
        return;
      }

      if (transferTouchesClosedDrawer) {
        setErrorMessage('Any cash drawer used in a transfer must have an open cash session.');
        return;
      }
    }

    const otherEntrySignature = JSON.stringify({
      entryType: otherEntryType,
      amount: amt,
      businessDate,
      branchId,
      notes: otherNotes.trim(),
      receivingAccountId: otherEntryType === 'misc_income' ? miscReceivingAccountId : null,
      incomeDescription: otherEntryType === 'misc_income' ? miscDescription.trim() : null,
      payeeSource: otherEntryType === 'misc_income' ? miscPayeeSource.trim() : null,
      paymentMethod: otherEntryType === 'misc_income' ? miscPaymentMethod : null,
      cashDrawerId:
        otherEntryType === 'cash_addition' || otherEntryType === 'cash_removal'
          ? cashDrawerId
          : null,
      adjustmentReason:
        otherEntryType === 'cash_addition' || otherEntryType === 'cash_removal'
          ? cashAdjustmentReason.trim()
          : null,
      sourceAccountId: otherEntryType === 'transfer' ? transferSourceAccountId : null,
      destinationAccountId: otherEntryType === 'transfer' ? transferDestAccountId : null,
    });

    if (otherEntryAttemptRef.current?.signature !== otherEntrySignature) {
      otherEntryAttemptRef.current = {
        signature: otherEntrySignature,
        key: `cf8c_${crypto.randomUUID()}`,
      };
    }

    const otherEntryIdempotencyKey = otherEntryAttemptRef.current.key;

    setIsSubmitting(true);
    try {
      const res = await recordOtherEntryAction({
        entryType: otherEntryType,
        amount: amt,
        businessDate,
        notes: otherNotes.trim() || undefined,
        receivingAccountId: otherEntryType === 'misc_income' ? miscReceivingAccountId : undefined,
        incomeDescription: otherEntryType === 'misc_income' ? miscDescription : undefined,
        payeeSource: otherEntryType === 'misc_income' ? miscPayeeSource : undefined,
        paymentMethod: otherEntryType === 'misc_income' ? miscPaymentMethod : undefined,
        cashDrawerId: (otherEntryType === 'cash_addition' || otherEntryType === 'cash_removal') ? cashDrawerId : undefined,
        adjustmentReason: (otherEntryType === 'cash_addition' || otherEntryType === 'cash_removal') ? cashAdjustmentReason : undefined,
        sourceAccountId: otherEntryType === 'transfer' ? transferSourceAccountId : undefined,
        destinationAccountId: otherEntryType === 'transfer' ? transferDestAccountId : undefined,
        idempotencyKey: otherEntryIdempotencyKey,
      });

      if (!res.ok) {
        setErrorMessage(res.error || 'Failed to record financial entry.');
        return;
      }

      setSuccessMessage('Financial entry recorded successfully!');
      if (onSuccess) onSuccess();
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred.');
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
    <div className="flex flex-col h-full max-h-[90vh] overflow-hidden">
      {/* ── Fixed Modal Header ────────────────────────────────────────── */}
      <div className="shrink-0 px-6 py-4 border-b border-[#EAE4DC] flex items-start justify-between bg-[#FAF8F5]">
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

      {/* ── Scrollable Content Body ──────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-6">
        {/* ── Mode Switch Grid (4 cards matching PNG) ────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* 1. Customer Payment */}
          <button
            type="button"
            onClick={() => setActiveMode('customer_payment')}
            className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
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
                className={`text-xs font-bold whitespace-nowrap ${
                  activeMode === 'customer_payment' ? 'text-[#163E32]' : 'text-[#1E1916]'
                }`}
              >
                Customer Payment
              </span>
            </div>
            <p className="text-[11px] text-[#7A6E65] leading-snug">
              Record payment for a booking
            </p>
          </button>

        {/* 2. Expense */}
        <button
          type="button"
          onClick={() => setActiveMode('expense')}
          className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
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
              className={`text-xs font-bold whitespace-nowrap ${
                activeMode === 'expense' ? 'text-amber-900' : 'text-[#1E1916]'
              }`}
            >
              Expense
            </span>
          </div>
          <p className="text-[11px] text-[#7A6E65] leading-snug">
            Record business expenses
          </p>
        </button>

        {/* 3. Tip */}
        <button
          type="button"
          onClick={() => setActiveMode('tip')}
          className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
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
              className={`text-xs font-bold whitespace-nowrap ${
                activeMode === 'tip' ? 'text-rose-900' : 'text-[#1E1916]'
              }`}
            >
              Tip
            </span>
          </div>
          <p className="text-[11px] text-[#7A6E65] leading-snug">
            Record staff or house tips
          </p>
        </button>

        {/* 4. Other Entry */}
        <button
          type="button"
          onClick={() => setActiveMode('other_entry')}
          className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
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
              className={`text-xs font-bold whitespace-nowrap ${
                activeMode === 'other_entry' ? 'text-stone-900' : 'text-[#1E1916]'
              }`}
            >
              Other Entry
            </span>
          </div>
          <p className="text-[11px] text-[#7A6E65] leading-snug">
            Adjustments, misc income, etc.
          </p>
        </button>
      </div>

      {/* ── Operational Expense Mode ─────────────────────────────────── */}
      {activeMode === 'expense' && (
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

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2.2fr)_minmax(270px,0.9fr)] gap-6 items-start">
            {/* Left Column (Main Form - ~71%) */}
            <div className="space-y-5">
              {/* 1. Category & Account */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#1E1916]">
                  1. Expense Classification & Payment Account
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#7A6E65] mb-1">
                      Expense Category <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={expenseCategoryId}
                      onChange={(e) => setExpenseCategoryId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#EAE4DC] hover:border-[#1B4D3E] rounded-xl text-xs text-[#1E1916] focus:outline-none focus:border-[#1B4D3E]"
                    >
                      {effectiveCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#7A6E65] mb-1">
                      Disbursement Account <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={expenseAccountId}
                      onChange={(e) => setExpenseAccountId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#EAE4DC] hover:border-[#1B4D3E] rounded-xl text-xs text-[#1E1916] focus:outline-none focus:border-[#1B4D3E]"
                    >
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.identifierMask})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 2. Payee & Description */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#1E1916]">
                  2. Expense Details & Justification
                </h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#7A6E65] mb-1">
                        Payee / Vendor <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Shell Gas Station, Clean Linen Services"
                        value={expensePayee}
                        onChange={(e) => setExpensePayee(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-[#EAE4DC] rounded-xl text-xs text-[#1E1916] placeholder:text-[#9C8878] focus:outline-none focus:border-[#1B4D3E]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#7A6E65] mb-1">
                        Receipt / OR Reference
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., OR-987654"
                        value={expenseReceiptRef}
                        onChange={(e) => setExpenseReceiptRef(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-[#EAE4DC] rounded-xl text-xs text-[#1E1916] placeholder:text-[#9C8878] focus:outline-none focus:border-[#1B4D3E]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#7A6E65] mb-1">
                      Description <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Fuel for home service van (3 appointments)"
                      value={expenseDescription}
                      onChange={(e) => setExpenseDescription(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#EAE4DC] rounded-xl text-xs text-[#1E1916] placeholder:text-[#9C8878] focus:outline-none focus:border-[#1B4D3E]"
                    />
                  </div>

                  {/* Receipt Photo Attachment (CF7) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-[#7A6E65]">
                        Receipt Attachment <span className="text-[10px] font-normal text-[#9C8878]">(Optional)</span>
                      </label>
                      {receiptFile && (
                        <span className="text-[10px] text-[#1B4D3E] font-medium">
                          {(receiptFile.size / (1024 * 1024)).toFixed(2)} MB
                        </span>
                      )}
                    </div>

                    <input
                      ref={receiptFileInputRef}
                      type="file"
                      data-testid="expense-receipt-file-input"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        handleReceiptFileChange(file);
                      }}
                    />

                    {!receiptFile ? (
                      <div
                        onClick={() => receiptFileInputRef.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const file = e.dataTransfer.files?.[0] || null;
                          handleReceiptFileChange(file);
                        }}
                        className="group border border-dashed border-[#D4C8BC] hover:border-[#1B4D3E] bg-[#FAF8F5] hover:bg-[#F5F2EC] rounded-xl p-3.5 text-center cursor-pointer transition flex flex-col items-center justify-center gap-1.5"
                      >
                        <div className="p-2 rounded-full bg-white text-[#6B5D52] group-hover:text-[#1B4D3E] shadow-2xs transition">
                          <UploadCloud className="w-4 h-4" />
                        </div>
                        <div className="text-xs text-[#1E1916] font-medium">
                          <span className="text-[#1B4D3E] underline font-semibold">Click to upload receipt</span> or drag and drop
                        </div>
                        <p className="text-[10px] text-[#9C8878]">
                          JPEG, PNG, WebP or PDF (max 5 MB) · Private audit evidence
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-2.5 bg-white border border-[#EAE4DC] rounded-xl">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {receiptPreviewUrl ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={receiptPreviewUrl}
                              alt="Receipt preview"
                              className="w-10 h-10 object-cover rounded-lg border border-[#EAE4DC] flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0 text-amber-800">
                              <FileText className="w-5 h-5" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-[#1E1916] truncate max-w-[220px]">
                              {receiptFile.name}
                            </p>
                            <p className="text-[10px] text-[#7A6E65]">
                              {(receiptFile.size / (1024 * 1024)).toFixed(2)} MB · {receiptFile.type || 'Document'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => receiptFileInputRef.current?.click()}
                            className="px-2 py-1 text-[11px] font-semibold text-[#1B4D3E] hover:bg-[#EEF8F2] rounded-lg transition"
                          >
                            Replace
                          </button>
                          <button
                            type="button"
                            onClick={handleRemoveReceipt}
                            className="p-1 text-[#9C8878] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Remove receipt"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    {receiptError && (
                      <p className="mt-1 text-[11px] text-rose-600 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{receiptError}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* 3. Amount & Notes */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#1E1916]">
                  3. Outflow Amount & Internal Notes
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#7A6E65] mb-1">
                      Amount (PHP) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A6E65] font-bold text-xs">₱</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="0.00"
                        value={expenseAmount}
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value));
                          setExpenseAmount(val);
                        }}
                        className="w-full pl-7 pr-3 py-2 bg-white border border-[#EAE4DC] rounded-xl text-xs font-bold font-mono text-[#1E1916] placeholder:text-[#9C8878] focus:outline-none focus:border-[#1B4D3E]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#7A6E65] mb-1">
                      Internal Notes
                    </label>
                    <input
                      type="text"
                      placeholder="Optional notes or context..."
                      value={expenseNotes}
                      onChange={(e) => setExpenseNotes(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#EAE4DC] rounded-xl text-xs text-[#1E1916] placeholder:text-[#9C8878] focus:outline-none focus:border-[#1B4D3E]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column (Summary & Help - ~29%) */}
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-[#EAE4DC] p-4 shadow-2xs space-y-3">
                <h4 className="text-xs font-bold text-[#1E1916]">Expense Summary</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-[#7A6E65]">
                    <span>Category</span>
                    <span className="font-semibold text-[#1E1916]">
                      {effectiveCategories.find((c) => c.id === expenseCategoryId)?.name || 'General'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[#7A6E65]">
                    <span>Payment Account</span>
                    <span className="font-semibold text-[#1E1916] truncate max-w-[140px]">
                      {accounts.find((a) => a.id === expenseAccountId)?.name || 'Account'}
                    </span>
                  </div>
                  {receiptFile && (
                    <div className="flex items-center justify-between text-[#7A6E65]">
                      <span>Receipt File</span>
                      <span className="font-semibold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Attached
                      </span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-[#F0ECE5] flex items-center justify-between">
                    <span className="font-bold text-[#D9383A]">Disbursement Total</span>
                    <span className="font-bold text-sm text-[#D9383A] tabular-nums font-mono">
                      -{formatPeso(typeof expenseAmount === 'number' ? expenseAmount : 0)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-[#FEF3E2] border border-[#FAD7A0] rounded-xl p-4 text-xs space-y-2">
                <div className="flex items-center gap-1.5 text-[#B5651D] font-bold">
                  <Lightbulb className="w-4 h-4 text-[#B5651D]" />
                  <span>About Operational Expenses</span>
                </div>
                <p className="text-[11px] text-[#7A4B1A] leading-relaxed">
                  Operational expenses immediately post a verified signed negative movement against the selected account. No fake booking orders are fabricated.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Tip Recording Mode ───────────────────────────────────────── */}
      {activeMode === 'tip' && (
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

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2.2fr)_minmax(270px,0.9fr)] gap-6 items-start">
            {/* Left Column (Main Form - ~71%) */}
            <div className="space-y-5">
              {/* 1. Custody Type Toggle (CF1-D09) */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#1E1916]">
                  1. Tip Custody Model (CF1-D09)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTipCustodyType('direct_cash')}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                      tipCustodyType === 'direct_cash'
                        ? 'border-2 border-emerald-600 bg-emerald-50/70 shadow-2xs'
                        : 'border-[#EAE4DC] bg-white hover:border-[#D4C8BC]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-[#1E1916]">Direct Cash Tip</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                        Zero Custody
                      </span>
                    </div>
                    <p className="text-[11px] text-[#7A6E65] leading-snug">
                      Cash handed directly to therapist. Zero company custody, 0 movements on shop accounts.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTipCustodyType('company_custodied')}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                      tipCustodyType === 'company_custodied'
                        ? 'border-2 border-rose-600 bg-rose-50/70 shadow-2xs'
                        : 'border-[#EAE4DC] bg-white hover:border-[#D4C8BC]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-[#1E1916]">Company Custodied</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold">
                        Pending Payout
                      </span>
                    </div>
                    <p className="text-[11px] text-[#7A6E65] leading-snug">
                      Customer pays via GCash, Maya, Card, or Drawer. Company holds funds pending payout.
                    </p>
                  </button>
                </div>
              </div>

              {/* 2. Beneficiary & Amount */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#1E1916]">
                  2. Beneficiary Therapist & Amount
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#7A6E65] mb-1">
                      Beneficiary Staff Member <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={tipBeneficiaryStaffId}
                      onChange={(e) => setTipBeneficiaryStaffId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#EAE4DC] hover:border-[#1B4D3E] rounded-xl text-xs text-[#1E1916] focus:outline-none focus:border-[#1B4D3E]"
                    >
                      {effectiveStaff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.role})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#7A6E65] mb-1">
                      Tip Amount (PHP) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A6E65] font-bold text-xs">₱</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="0.00"
                        value={tipAmount}
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value));
                          setTipAmount(val);
                        }}
                        className="w-full pl-7 pr-3 py-2 bg-white border border-[#EAE4DC] rounded-xl text-xs font-bold font-mono text-[#1E1916] placeholder:text-[#9C8878] focus:outline-none focus:border-[#1B4D3E]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Account selection when Company Custodied */}
              {tipCustodyType === 'company_custodied' && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#1E1916]">
                    3. Receiving Account & Rail
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#7A6E65] mb-1">
                        Receiving Account <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={tipAccountId}
                        onChange={(e) => setTipAccountId(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-[#EAE4DC] hover:border-[#1B4D3E] rounded-xl text-xs text-[#1E1916] focus:outline-none focus:border-[#1B4D3E]"
                      >
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({a.identifierMask})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#7A6E65] mb-1">
                        Payment Method
                      </label>
                      <select
                        value={tipPaymentMethod}
                        onChange={(e) => setTipPaymentMethod(e.target.value as FinancialPaymentMethod)}
                        className="w-full px-3 py-2 bg-white border border-[#EAE4DC] hover:border-[#1B4D3E] rounded-xl text-xs text-[#1E1916] focus:outline-none focus:border-[#1B4D3E]"
                      >
                        <option value="cash">Cash</option>
                        <option value="gcash">GCash</option>
                        <option value="maya">Maya</option>
                        <option value="card">Card Terminal</option>
                        <option value="bank_transfer">Bank Transfer</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-semibold text-[#7A6E65] mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="Optional customer reference or shift context..."
                  value={tipNotes}
                  onChange={(e) => setTipNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#EAE4DC] rounded-xl text-xs text-[#1E1916] placeholder:text-[#9C8878] focus:outline-none focus:border-[#1B4D3E]"
                />
              </div>
            </div>

            {/* Right Column (Summary & Help - ~29%) */}
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-[#EAE4DC] p-4 shadow-2xs space-y-3">
                <h4 className="text-xs font-bold text-[#1E1916]">Tip Summary</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-[#7A6E65]">
                    <span>Beneficiary</span>
                    <span className="font-semibold text-[#1E1916]">
                      {effectiveStaff.find((s) => s.id === tipBeneficiaryStaffId)?.name || 'Staff'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[#7A6E65]">
                    <span>Custody Type</span>
                    <span className="font-semibold text-[#1E1916]">
                      {tipCustodyType === 'direct_cash' ? 'Direct Cash' : 'Company Custodied'}
                    </span>
                  </div>
                  {tipCustodyType === 'company_custodied' && (
                    <div className="flex items-center justify-between text-[#7A6E65]">
                      <span>Account</span>
                      <span className="font-semibold text-[#1E1916] truncate max-w-[140px]">
                        {accounts.find((a) => a.id === tipAccountId)?.name || 'Account'}
                      </span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-[#F0ECE5] flex items-center justify-between">
                    <span className="font-bold text-[#163E32]">Tip Amount</span>
                    <span className="font-bold text-sm text-[#163E32] tabular-nums font-mono">
                      {formatPeso(typeof tipAmount === 'number' ? tipAmount : 0)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-[#EEF7F2] border border-[#CDE5D8] rounded-xl p-4 text-xs space-y-2">
                <div className="flex items-center gap-1.5 text-[#163E32] font-bold">
                  <Lightbulb className="w-4 h-4 text-[#1B4D3E]" />
                  <span>About Tip Custody</span>
                </div>
                <p className="text-[11px] text-[#3D5A4C] leading-relaxed">
                  Per rule CF1-D09, direct cash tips are zero company custody. Company-custodied tips are recorded as pending liability to therapist.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Other Entry Mode ─────────────────────────────────────────── */}
      {activeMode === 'other_entry' && (
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

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2.2fr)_minmax(270px,0.9fr)] gap-6 items-start">
            {/* Left Column (Main Form - ~71%) */}
            <div className="space-y-5">
              {/* 1. Entry Type Selector */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#1E1916]">
                  1. Select Entry Type
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setOtherEntryType('misc_income')}
                    className={`p-2.5 rounded-xl border text-center transition ${
                      otherEntryType === 'misc_income'
                        ? 'border-2 border-stone-800 bg-stone-100 font-bold text-stone-900'
                        : 'border-[#EAE4DC] bg-white text-[#7A6E65] hover:border-[#D4C8BC]'
                    }`}
                  >
                    <span className="text-xs">Misc Income</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOtherEntryType('cash_addition')}
                    className={`p-2.5 rounded-xl border text-center transition ${
                      otherEntryType === 'cash_addition'
                        ? 'border-2 border-emerald-700 bg-emerald-50 font-bold text-emerald-900'
                        : 'border-[#EAE4DC] bg-white text-[#7A6E65] hover:border-[#D4C8BC]'
                    }`}
                  >
                    <span className="text-xs">Cash Addition</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOtherEntryType('cash_removal')}
                    className={`p-2.5 rounded-xl border text-center transition ${
                      otherEntryType === 'cash_removal'
                        ? 'border-2 border-rose-700 bg-rose-50 font-bold text-rose-900'
                        : 'border-[#EAE4DC] bg-white text-[#7A6E65] hover:border-[#D4C8BC]'
                    }`}
                  >
                    <span className="text-xs">Cash Removal</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOtherEntryType('transfer')}
                    className={`p-2.5 rounded-xl border text-center transition ${
                      otherEntryType === 'transfer'
                        ? 'border-2 border-blue-700 bg-blue-50 font-bold text-blue-900'
                        : 'border-[#EAE4DC] bg-white text-[#7A6E65] hover:border-[#D4C8BC]'
                    }`}
                  >
                    <span className="text-xs">Transfer / Safe Drop</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOtherEntryType('generic_adjustment')}
                    className={`p-2.5 rounded-xl border text-center transition flex items-center justify-center gap-1 ${
                      otherEntryType === 'generic_adjustment'
                        ? 'border-2 border-stone-800 bg-stone-100 font-bold text-stone-900'
                        : 'border-[#EAE4DC] bg-white text-[#7A6E65] hover:border-[#D4C8BC]'
                    }`}
                  >
                    <Lock className="w-3 h-3 text-[#7A6E65]" />
                    <span className="text-xs">Adjustment (Locked)</span>
                  </button>
                </div>
              </div>

              {/* 2. Dynamic fields per Entry Type */}
              {otherEntryType === 'generic_adjustment' && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <Lock className="w-4 h-4 text-amber-700" />
                    <span>General Adjustment Locked</span>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    General adjustment entries without formal approval policy are locked. Use Cash Addition / Removal with strict reason attribution, or record specific customer/expense adjustments.
                  </p>
                </div>
              )}
              {otherEntryType === 'misc_income' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#7A6E65] mb-1">
                        Receiving Account <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={miscReceivingAccountId}
                        onChange={(e) => {
                          const accId = e.target.value;
                          setMiscReceivingAccountId(accId);
                          const acc = accounts.find((a) => a.id === accId);
                          if (acc?.accountType === 'gcash') setMiscPaymentMethod('gcash');
                          else if (acc?.accountType === 'maya') setMiscPaymentMethod('maya');
                          else if (acc?.accountType === 'bank_transfer') setMiscPaymentMethod('bank_transfer');
                          else if (acc?.accountType === 'card_terminal') setMiscPaymentMethod('card');
                          else setMiscPaymentMethod('cash');
                        }}
                        className="w-full px-3 py-2 bg-white border border-[#EAE4DC] rounded-xl text-xs text-[#1E1916] focus:outline-none focus:border-[#1B4D3E]"
                      >
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({a.identifierMask})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#7A6E65] mb-1">
                        Payer / Source
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Event organizer, scrap vendor"
                        value={miscPayeeSource}
                        onChange={(e) => setMiscPayeeSource(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-[#EAE4DC] rounded-xl text-xs text-[#1E1916] focus:outline-none focus:border-[#1B4D3E]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#7A6E65] mb-1">
                      Income Description <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Space rental fee for photoshoot"
                      value={miscDescription}
                      onChange={(e) => setMiscDescription(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#EAE4DC] rounded-xl text-xs text-[#1E1916] focus:outline-none focus:border-[#1B4D3E]"
                    />
                  </div>
                </div>
              )}

              {(otherEntryType === 'cash_addition' || otherEntryType === 'cash_removal') && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#7A6E65] mb-1">
                      Cash Drawer Account <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={cashDrawerId}
                      onChange={(e) => setCashDrawerId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#EAE4DC] rounded-xl text-xs text-[#1E1916] focus:outline-none focus:border-[#1B4D3E]"
                    >
                      {accounts
                        .filter((a) => a.accountType === 'cash_drawer')
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({a.identifierMask})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#7A6E65] mb-1">
                      Adjustment Reason <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder={
                        otherEntryType === 'cash_addition'
                          ? 'e.g., Opening petty cash float replenishment'
                          : 'e.g., Mid-day safe drop deposit'
                      }
                      value={cashAdjustmentReason}
                      onChange={(e) => setCashAdjustmentReason(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#EAE4DC] rounded-xl text-xs text-[#1E1916] focus:outline-none focus:border-[#1B4D3E]"
                    />
                  </div>
                </div>
              )}

              {otherEntryType === 'transfer' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#7A6E65] mb-1">
                        Source Account (Outflow) <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={transferSourceAccountId}
                        onChange={(e) => setTransferSourceAccountId(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-[#EAE4DC] rounded-xl text-xs text-[#1E1916] focus:outline-none focus:border-[#1B4D3E]"
                      >
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({a.identifierMask})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#7A6E65] mb-1">
                        Destination Account (Inflow) <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={transferDestAccountId}
                        onChange={(e) => setTransferDestAccountId(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-[#EAE4DC] rounded-xl text-xs text-[#1E1916] focus:outline-none focus:border-[#1B4D3E]"
                      >
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({a.identifierMask})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. Amount & Notes */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#1E1916]">
                  3. Entry Amount & Notes
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#7A6E65] mb-1">
                      Amount (PHP) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A6E65] font-bold text-xs">₱</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="0.00"
                        value={otherAmount}
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value));
                          setOtherAmount(val);
                        }}
                        className="w-full pl-7 pr-3 py-2 bg-white border border-[#EAE4DC] rounded-xl text-xs font-bold font-mono text-[#1E1916] focus:outline-none focus:border-[#1B4D3E]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#7A6E65] mb-1">
                      Notes
                    </label>
                    <input
                      type="text"
                      placeholder="Optional remarks..."
                      value={otherNotes}
                      onChange={(e) => setOtherNotes(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#EAE4DC] rounded-xl text-xs text-[#1E1916] focus:outline-none focus:border-[#1B4D3E]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column (Summary & Help - ~29%) */}
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-[#EAE4DC] p-4 shadow-2xs space-y-3">
                <h4 className="text-xs font-bold text-[#1E1916]">Entry Summary</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-[#7A6E65]">
                    <span>Type</span>
                    <span className="font-semibold text-[#1E1916]">
                      {otherEntryType === 'misc_income'
                        ? 'Misc Income'
                        : otherEntryType === 'cash_addition'
                        ? 'Cash Addition'
                        : otherEntryType === 'cash_removal'
                        ? 'Cash Removal'
                        : 'Transfer'}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-[#F0ECE5] flex items-center justify-between">
                    <span className="font-bold text-[#1E1916]">Transaction Amount</span>
                    <span className="font-bold text-sm text-[#1E1916] tabular-nums font-mono">
                      {formatPeso(typeof otherAmount === 'number' ? otherAmount : 0)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-[#FAF8F5] border border-[#EAE4DC] rounded-xl p-4 text-xs space-y-2">
                <div className="flex items-center gap-1.5 text-[#1E1916] font-bold">
                  <Lightbulb className="w-4 h-4 text-[#7A6E65]" />
                  <span>Audit Trail Guaranteed</span>
                </div>
                <p className="text-[11px] text-[#7A6E65] leading-relaxed">
                  Every entry writes a single canonical financial transaction header and signed account movements with full staff attribution.
                </p>
              </div>
            </div>
          </div>
        </>
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
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2.2fr)_minmax(270px,0.9fr)] gap-6 items-start">
            {/* ── Left Column (Main Form - ~71%) ────────────────────── */}
            <div className="space-y-5">
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
                  {hasMissingCompatibleAccount && (
                    <p role="alert" className="text-xs text-amber-800">
                      No compatible financial account is configured for the selected payment method. Ask an administrator to set up the account before recording payment.
                    </p>
                  )}
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

            {/* ── Right Column (Summary & Help - ~29%) ───────────────── */}
            <div className="space-y-4">
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
      </div>

      {/* ── Stable Modal Footer (shrink-0) ────────────────────────────── */}
      <div className="shrink-0 px-6 py-4 border-t border-[#EAE4DC] bg-[#FAF8F5] flex flex-col sm:flex-row items-center justify-between gap-4">
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
        ) : activeMode === 'expense' ? (
          <div className="space-y-0.5 text-left w-full sm:w-auto">
            <div className="text-xs text-[#7A6E65] flex items-center gap-2">
              <span className="text-[#9C8878]">Expense Outflow:</span>
              <span className="font-bold text-sm text-[#D9383A] tabular-nums font-mono">
                -{formatPeso(typeof expenseAmount === 'number' ? expenseAmount : 0)}
              </span>
            </div>
            <div className="text-xs text-[#7A6E65]">
              Disbursed from {accounts.find((a) => a.id === expenseAccountId)?.name || 'Account'}
            </div>
          </div>
        ) : activeMode === 'tip' ? (
          <div className="space-y-0.5 text-left w-full sm:w-auto">
            <div className="text-xs text-[#7A6E65] flex items-center gap-2">
              <span className="text-[#9C8878]">Tip Total:</span>
              <span className="font-bold text-sm text-[#163E32] tabular-nums font-mono">
                {formatPeso(typeof tipAmount === 'number' ? tipAmount : 0)}
              </span>
            </div>
            <div className="text-xs text-[#7A6E65]">
              {tipCustodyType === 'direct_cash'
                ? 'Direct to Therapist (Zero company custody)'
                : 'Company Custodied (Pending liability)'}
            </div>
          </div>
        ) : (
          <div className="space-y-0.5 text-left w-full sm:w-auto">
            <div className="text-xs text-[#7A6E65] flex items-center gap-2">
              <span className="text-[#9C8878]">Entry Amount:</span>
              <span className="font-bold text-sm text-[#1E1916] tabular-nums font-mono">
                {formatPeso(typeof otherAmount === 'number' ? otherAmount : 0)}
              </span>
            </div>
            <div className="text-xs text-[#7A6E65]">
              {otherEntryType === 'misc_income'
                ? 'Miscellaneous Operating Inflow'
                : otherEntryType === 'cash_addition'
                ? 'Cash Addition to Drawer'
                : otherEntryType === 'cash_removal'
                ? 'Cash Removal from Drawer'
                : otherEntryType === 'transfer'
                ? 'Transfer / Safe Drop (Net Zero)'
                : 'Generic Adjustment (Locked)'}
            </div>
          </div>
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
                hasMissingCompatibleAccount ||
                totalPayment > (selectedOrder?.remainingBalance || 0)
              }
              className="px-5 py-2 bg-[#163E32] hover:bg-[#1B4D3E] text-white text-xs font-semibold rounded-xl shadow-2xs transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Record Entry</span>
            </button>
          )}

          {activeMode === 'expense' && (
            <button
              type="button"
              onClick={handleExpenseSubmit}
              disabled={
                isSubmitting ||
                isUploadingReceipt ||
                !expenseAmount ||
                Number(expenseAmount) <= 0 ||
                !expenseDescription.trim()
              }
              className="px-5 py-2 bg-[#163E32] hover:bg-[#1B4D3E] text-white text-xs font-semibold rounded-xl shadow-2xs transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {(isSubmitting || isUploadingReceipt) && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>
                {isUploadingReceipt
                  ? 'Uploading Receipt...'
                  : isSubmitting
                  ? 'Recording Expense...'
                  : 'Record Expense'}
              </span>
            </button>
          )}

          {activeMode === 'tip' && (
            <button
              type="button"
              onClick={handleTipSubmit}
              disabled={isSubmitting || !tipAmount || Number(tipAmount) <= 0 || !tipBeneficiaryStaffId}
              className="px-5 py-2 bg-[#163E32] hover:bg-[#1B4D3E] text-white text-xs font-semibold rounded-xl shadow-2xs transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Record Tip</span>
            </button>
          )}

          {activeMode === 'other_entry' && (
            <button
              type="button"
              onClick={handleOtherEntrySubmit}
              disabled={
                isSubmitting ||
                !otherAmount ||
                Number(otherAmount) <= 0 ||
                otherEntryType === 'generic_adjustment' ||
                cashAdjustmentBlocked ||
                transferBlocked
              }
              className="px-5 py-2 bg-[#163E32] hover:bg-[#1B4D3E] text-white text-xs font-semibold rounded-xl shadow-2xs transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Record Other Entry</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
