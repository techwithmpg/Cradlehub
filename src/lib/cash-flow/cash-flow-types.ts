import type { FinancialPaymentMethod, FinancialAccountType } from './financial-contract';

export interface MaskedAccountOption {
  id: string;
  name: string;
  accountType: FinancialAccountType;
  identifierMask: string;
  branchId: string | null;
}

export interface TodayKpiSummary {
  recordedPayments: number;
  outstandingBalance: number;
  paidBookingsCount: number;
  needsPaymentCount: number;
  unreconciledBookingCount?: number;
  recordedPaymentsTrend?: string | null;
  outstandingTrend?: string | null;
  paidBookingsTrend?: string | null;
  needsPaymentTrend?: string | null;
}

export interface PaymentMixItem {
  method: FinancialPaymentMethod | 'other';
  label: string;
  amount: number;
  percentage: number;
  transactionCount: number;
}

export interface CashFlowCoverageCategory {
  id: string;
  label: string;
  amount: number;
  countLabel: string;
  isAvailable: boolean;
  statusText?: string;
  iconType:
    | 'calendar'
    | 'home'
    | 'credit_card'
    | 'shopping_cart'
    | 'gift'
    | 'user'
    | 'users'
    | 'percent'
    | 'wallet'
    | 'arrows'
    | 'reply'
    | 'sliders'
    | 'plus';
}

export interface RecentPaymentItem {
  id: string;
  time: string;
  type: string;
  customerName: string;
  reference: string;
  serviceDescription: string;
  durationMinutes?: number | null;
  paymentMethodDisplay: string;
  amount: number;
  status: 'paid' | 'partial' | 'pending' | 'reversed';
  orderId?: string | null;
}

export interface LedgerKpiSummary {
  inflow: number;
  outflow: number;
  netFlow: number;
  unreconciledText: string;
  unreconciledCount?: number;
}

export interface LedgerRecordItem {
  id: string;
  dateTime: string;
  reference: string;
  customerSource: string;
  category: string;
  method: string;
  inflow: number | null;
  outflow: number | null;
  netEffect: number;
  status: string;
  isReconciliationOnly?: boolean;
}

export interface DayCloseSummaryData {
  businessDate: string;
  isBalanced: boolean;
  readyForReview: boolean;
  lastUpdatedText: string;
  reconciliationStatus: 'not_started' | 'draft' | 'submitted' | 'approved';
  expectedCash: number | null;
  actualCash: number | null;
  cashVariance: number | null;
  channelVariance: number | null;
  recordedInflow: number;
  recordedOutflow: number;
  netPosition: number;
  openIssuesCount: number;
  paymentBreakdown: PaymentMixItem[];
  coverageCategories: CashFlowCoverageCategory[];
  timeline: Array<{
    id: string;
    time: string;
    title: string;
    amount: number;
    paymentMethod: string;
  }>;
  isFinalizationSupported: boolean;
}

export interface HistoricalDayCloseItem {
  id: string;
  date: string;
  branchName: string;
  status: 'reviewed' | 'closed' | 'needs_review' | 'reopened';
  inflow: number;
  outflow: number;
  net: number;
  reviewedBy: string | null;
}

export interface HistoryTabSummary {
  closedDaysThisMonth: number;
  totalInflowThisMonth: number;
  totalOutflowThisMonth: number;
  reviewExceptions: number;
  records: HistoricalDayCloseItem[];
  selectedClose?: {
    date: string;
    statusText: string;
    inflow: number;
    outflow: number;
    netPosition: number;
    totalBookings: number;
    totalCustomers: number;
    reviewedBy: string | null;
    paymentMix: PaymentMixItem[];
  } | null;
  auditTrail: Array<{
    id: string;
    time: string;
    user: string;
    action: string;
    details: string;
  }>;
}

export interface PayableOrderItemDetail {
  id: string;
  description: string;
  amount: number;
  itemType?: 'service' | 'home_service_fee' | 'retail_product' | 'surcharge' | 'discount' | 'manual_adjustment' | 'other';
  subDescription?: string | null;
}

export interface PayableOrderPreviousPayment {
  date: string;
  amount: number;
  method: string;
}

export interface PayableOrderOption {
  id: string;
  sourceKind: 'booking_order' | 'legacy_booking';
  /** Explicit order-level eligibility; never inferred from a representative child status. */
  paymentEligible?: boolean;
  orderNumber: string;
  customerName: string;
  customerPhone?: string | null;
  serviceDescription: string;
  totalAmount: number;
  amountPaid: number;
  remainingBalance: number;
  bookingDate: string;
  serviceTime?: string | null;
  branchName?: string;
  visitType?: 'in_spa' | 'home_service';
  bookingStatus?: string;
  paymentStatus?: 'unpaid' | 'partially_paid' | 'paid';
  payableItems?: PayableOrderItemDetail[];
  previousPayments?: PayableOrderPreviousPayment[];
}

export interface ExpenseCategoryOption {
  id: string;
  code: string;
  name: string;
  description?: string | null;
}

export interface StaffOption {
  id: string;
  name: string;
  role: string;
}

export interface RecordExpenseInput {
  branchId?: string;
  categoryId: string;
  financialAccountId: string;
  amount: number;
  payee: string;
  description: string;
  receiptReference?: string;
  businessDate?: string;
  notes?: string;
  idempotencyKey?: string;
}

export interface RecordTipInput {
  branchId?: string;
  beneficiaryStaffId: string;
  custodyType: 'direct_cash' | 'company_custodied';
  amount: number;
  financialAccountId?: string;
  paymentMethod?: FinancialPaymentMethod;
  businessDate?: string;
  notes?: string;
  idempotencyKey?: string;
}

export interface RecordOtherEntryInput {
  branchId?: string;
  entryType: 'misc_income' | 'cash_addition' | 'cash_removal' | 'transfer';
  amount: number;
  businessDate?: string;
  notes?: string;
  idempotencyKey?: string;
  // misc_income specific
  receivingAccountId?: string;
  incomeDescription?: string;
  payeeSource?: string;
  paymentMethod?: FinancialPaymentMethod;
  // cash_addition / cash_removal specific
  cashDrawerId?: string;
  adjustmentReason?: string;
  // transfer specific
  sourceAccountId?: string;
  destinationAccountId?: string;
}

export interface OperationalEntryResult {
  ok: boolean;
  error?: string;
  code?: string;
  warning?: string;
  transactionId?: string;
  idempotentReplay?: boolean;
}

export interface CashSessionSummary {
  id: string;
  branchId: string;
  businessDate: string;
  cashDrawerAccountId: string;
  cashDrawerName: string;
  status: 'open' | 'closed';
  openingFloat: number;
  openingNote?: string | null;
  openedBy: string;
  openedByName?: string;
  openedAt: string;
  currentCustodianId?: string;
  currentCustodianName?: string;
  closedBy?: string | null;
  closedByName?: string | null;
  closedAt?: string | null;
  expectedCash: number;
  countedCash?: number | null;
  expectedCashAtClose?: number | null;
  variance?: number | null;
  closingNote?: string | null;
}

export interface OpenCashSessionInput {
  branchId: string;
  cashDrawerAccountId: string;
  businessDate: string;
  openingFloat: number;
  openingNote?: string;
  idempotencyKey: string;
}

export interface OpenCashSessionResult {
  ok: boolean;
  error?: string;
  code?: string;
  session?: CashSessionSummary;
  idempotentReplay?: boolean;
}

export interface CloseCashSessionInput {
  sessionId: string;
  countedCash: number;
  closingNote?: string;
  idempotencyKey: string;
}

export interface CloseCashSessionResult {
  ok: boolean;
  error?: string;
  code?: string;
  idempotentReplay?: boolean;
  session?: {
    id: string;
    branchId: string;
    cashDrawerAccountId: string;
    cashDrawerName?: string;
    businessDate: string;
    status: 'closed';
    openingFloat: number;
    expectedCash: number;
    countedCash: number;
    variance: number;
    closedBy: string;
    closedByName?: string;
    closedAt: string;
  };
}

export interface HandoverCashSessionInput {
  sessionId: string;
  incomingCustodianId: string;
  countedCash: number;
  notes?: string;
  idempotencyKey: string;
}

export interface HandoverCashSessionResult {
  ok: boolean;
  error?: string;
  code?: string;
  idempotentReplay?: boolean;
  handover?: {
    id: string;
    sessionId: string;
    outgoingCustodianId: string;
    outgoingCustodianName?: string;
    incomingCustodianId: string;
    incomingCustodianName?: string;
    expectedCash: number;
    countedCash: number;
    variance: number;
    recordedAt: string;
  };
}

export interface CashFlowWorkspaceData {
  branchId: string;
  branchName: string;
  businessDate: string;
  accounts: MaskedAccountOption[];
  expenseCategories?: ExpenseCategoryOption[];
  staffOptions?: StaffOption[];
  cashSessions?: {
    activeSessions: CashSessionSummary[];
    availableDrawers: MaskedAccountOption[];
  };
  today: {
    kpis: TodayKpiSummary;
    paymentMix: PaymentMixItem[];
    totalInflow: number;
    coverage: CashFlowCoverageCategory[];
    recentPayments: RecentPaymentItem[];
  };
  ledger: {
    kpis: LedgerKpiSummary;
    records: LedgerRecordItem[];
    totalRecords: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  dayClose: DayCloseSummaryData;
  history: HistoryTabSummary;
  payableOrders: PayableOrderOption[];
}
