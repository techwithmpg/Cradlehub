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
}

export interface DayCloseSummaryData {
  businessDate: string;
  isBalanced: boolean;
  readyForReview: boolean;
  lastUpdatedText: string;
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

export interface PayableOrderOption {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone?: string | null;
  serviceDescription: string;
  totalAmount: number;
  amountPaid: number;
  remainingBalance: number;
  bookingDate: string;
  payableItems?: Array<{
    id: string;
    description: string;
    amount: number;
  }>;
}

export interface CashFlowWorkspaceData {
  branchId: string;
  branchName: string;
  businessDate: string;
  accounts: MaskedAccountOption[];
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
