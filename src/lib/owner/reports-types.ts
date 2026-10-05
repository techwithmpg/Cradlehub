/**
 * Canonical Data Contracts and Types for Owner Reports Workspace
 * Follows strict separation of Canonical CradleHub Records vs External Master Sheet Evidence.
 */

export type ReportTab =
  | "overview"
  | "branch"
  | "branches"
  | "financial"
  | "service"
  | "services"
  | "staff"
  | "sheet"
  | "sheet-evidence";

export type DatePreset = "today" | "last7" | "last30" | "thisMonth" | "custom";

export interface OwnerReportsRequest {
  tab?: ReportTab;
  branchId?: string; // "all" or specific branch UUID
  preset?: string;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
}

export interface BranchOption {
  id: string;
  name: string;
}

export interface KpiSummary {
  canonicalRevenue: number;
  completedServices: number;
  totalBookings: number;
  averageBookingValue: number;
  collectedPayments: number;
  averageTransaction: number;
  uniqueCustomers: number;
  activeStaffCount: number;
  averageServicesPerStaff: number;
  avgServicesPerStaff?: number;
}

export interface RevenueByBranchItem {
  branchId?: string;
  name: string;
  revenue: number;
  count: number;
  completedCount?: number;
  avgBookingValue?: number;
  share?: number;
}

export interface TrendDataPoint {
  date: string;
  count: number;
  completedCount: number;
  revenue: number;
  collected: number;
  branchSeries?: Record<string, number>;
}

export interface PaymentMethodBreakdownItem {
  method: string;
  label: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface ServiceReportItem {
  serviceId: string;
  name: string;
  category: string;
  completedCount: number;
  revenue: number;
  avgValue: number;
  share: number;
  branchBreakdown?: Record<string, number>;
}

export interface ServiceCategoryMixItem {
  category: string;
  count: number;
  revenue: number;
  share: number;
}

export interface StaffProductivityReportItem {
  staffId: string;
  name: string;
  tier: string;
  branchId?: string;
  branchName?: string;
  total: number;
  completed: number;
  completionRate: number;
  revenue: number;
  avgPerService: number;
  topService?: string;
}

export interface DailyFinancialItem {
  date: string;
  recordedRevenue: number;
  collectedPayments: number;
  transactions: number;
  completedBookings: number;
}

export interface TopPaymentDayItem {
  date: string;
  revenue: number;
  collected: number;
  transactions: number;
}

export interface MasterSheetEvidenceSummary {
  status: "available" | "unavailable" | "forbidden" | "no_source";
  observedAt: string;
  coverage: "FULL_COVERAGE" | "PARTIAL_COVERAGE" | "NO_COVERAGE" | "UNAVAILABLE";
  coverageFrom?: string;
  coverageTo?: string;
  sourceWorkbook?: string;
  currentTab?: string;
  previousTab?: string;
  mappedBranch?: string;
  mappingStatus?: "PROVISIONAL";
  scopeNote?: string;
  sources?: Array<{
    workbook: string;
    branch: string;
    mapping: "PROVISIONAL";
    coverage: "FULL_COVERAGE" | "PARTIAL_COVERAGE" | "NO_COVERAGE" | "UNAVAILABLE";
    from?: string;
    to?: string;
    currentTab?: string;
    previousTab?: string;
  }>;
  totalRecords: number;
  visitCount: number;
  dutyCount: number;
  needsReviewCount: number;
  evidenceAmount: number;
  amountKnownCount?: number;
  amountUnknownCount?: number;
  effectOnCanonicalTotals: 0;
  recentVisits?: Array<{
    id: string;
    date: string | null;
    time: string | null;
    customer: string | null;
    attendant: string | null;
    services: string;
    channel: string;
    amount: number | null;
    reasons: string[];
    source: string;
    workbook?: string;
  }>;
  recentReviews?: Array<{
    id: string;
    date: string | null;
    classification: string;
    reasons: string[];
    source: string;
    workbook?: string;
  }>;
}

export interface OwnerReportsData {
  preset: string;
  from: string;
  to: string;
  branchId?: string;
  branchName?: string;
  dateRangeLabel: string;
  generatedAt: string;
  branches?: BranchOption[];

  // Top KPIs
  kpis?: KpiSummary;

  // Branch breakdowns (Overview & Branch tabs)
  revenueData: RevenueByBranchItem[];

  // Time-series Trend Data (Overview, Branch, Financial tabs)
  trendData: TrendDataPoint[];

  // Payment Breakdown (Overview & Financial tabs)
  paymentBreakdown?: {
    methods: PaymentMethodBreakdownItem[];
    totalCollected: number;
    totalTransactions: number;
  };

  // Service Reports data
  serviceData?: ServiceReportItem[];
  categoryMix?: ServiceCategoryMixItem[];

  // Staff Reports data
  staffData: StaffProductivityReportItem[];

  // Financial Reports data
  dailyFinancials?: DailyFinancialItem[];
  topPaymentDays?: TopPaymentDayItem[];

  // Master Sheet Operational Evidence (External, read-only)
  sheetEvidence?: MasterSheetEvidenceSummary;

  // Backwards-compatible legacy properties
  cashSummary?: {
    fromDate: string;
    toDate: string;
    total_expected: number;
    total_collected: number;
    total_unpaid: number;
    paid_count: number;
    unpaid_count: number;
    total_count: number;
    by_method: {
      cash: number;
      gcash: number;
      maya: number;
      card: number;
      pay_on_site: number;
      other: number;
    };
  };
}

export type OwnerReportsResult =
  | { success: true; data: OwnerReportsData }
  | { success: false; error: string };
