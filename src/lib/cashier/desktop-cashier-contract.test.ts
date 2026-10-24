import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  getDesktopPayableOrders,
  getDesktopCashierOverview,
  getDesktopHistory,
  type DesktopCashierContext,
} from './desktop-cashier-contract';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/cash-flow/cash-flow-queries', () => ({
  getCashFlowData: vi.fn(),
}));

import { getCashFlowData } from '@/lib/cash-flow/cash-flow-queries';
import type { CashFlowWorkspaceData } from '@/lib/cash-flow/cash-flow-types';
const mockedGetCashFlowData = vi.mocked(getCashFlowData);

const BRANCH_ID = 'branch-uuid-1';
const BRANCH_NAME = 'Main Spa Branch';
const BUSINESS_DATE = '2026-10-23';

function createMockContext(): DesktopCashierContext {
  return {
    supabase: {} as unknown as DesktopCashierContext['supabase'],
    operator: {
      authUserId: 'user-1',
      staff: { id: 'staff-1', branch_id: BRANCH_ID, system_role: 'manager' },
      staffRole: 'cashier',
      isDevBypass: false,
    },
    authUserId: 'user-1',
    branchId: BRANCH_ID,
    branchName: BRANCH_NAME,
    businessDate: BUSINESS_DATE,
  };
}

describe('Desktop Cashier Contract — Paid & Closed and Financial KPIs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('P0 — Paid & Closed Classification vs Pending Payment Queue', () => {
    it('accurately partitions orders across all lifecycle and payment states', async () => {
      mockedGetCashFlowData.mockResolvedValueOnce({
        branchId: BRANCH_ID,
        branchName: BRANCH_NAME,
        businessDate: BUSINESS_DATE,
        accounts: [],
        payableOrders: [
          // 1. Single service fully paid and completed -> Paid & Closed
          {
            id: 'order-single-paid-completed',
            sourceKind: 'booking_order',
            orderNumber: 'ORD-001',
            customerName: 'Customer A',
            serviceDescription: 'Swedish Massage',
            totalAmount: 1000,
            amountPaid: 1000,
            remainingBalance: 0,
            bookingDate: BUSINESS_DATE,
            bookingStatus: 'completed',
            paymentStatus: 'paid',
            paymentEligible: false,
          },
          // 2. Multi-service order where all child services completed and fully settled -> Paid & Closed
          {
            id: 'order-multi-paid-completed',
            sourceKind: 'booking_order',
            orderNumber: 'ORD-002',
            customerName: 'Customer B',
            serviceDescription: 'Full Spa Package',
            totalAmount: 2500,
            amountPaid: 2500,
            remainingBalance: 0,
            bookingDate: BUSINESS_DATE,
            bookingStatus: 'completed',
            paymentStatus: 'paid',
            paymentEligible: false,
          },
          // 3. Fully paid but service pending -> Neither
          {
            id: 'order-paid-service-pending',
            sourceKind: 'booking_order',
            orderNumber: 'ORD-003',
            customerName: 'Customer C',
            serviceDescription: 'Body Scrub',
            totalAmount: 1200,
            amountPaid: 1200,
            remainingBalance: 0,
            bookingDate: BUSINESS_DATE,
            bookingStatus: 'confirmed',
            paymentStatus: 'paid',
            paymentEligible: false,
          },
          // 4. Fully paid with service in progress -> Neither
          {
            id: 'order-paid-service-in-progress',
            sourceKind: 'booking_order',
            orderNumber: 'ORD-004',
            customerName: 'Customer D',
            serviceDescription: 'Aromatherapy',
            totalAmount: 1500,
            amountPaid: 1500,
            remainingBalance: 0,
            bookingDate: BUSINESS_DATE,
            bookingStatus: 'in_progress',
            paymentStatus: 'paid',
            paymentEligible: false,
          },
          // 5. Partially paid and completed -> Pending Payment Queue (balance still owed)
          {
            id: 'order-partial-completed',
            sourceKind: 'booking_order',
            orderNumber: 'ORD-005',
            customerName: 'Customer E',
            serviceDescription: 'Deep Tissue',
            totalAmount: 1800,
            amountPaid: 800,
            remainingBalance: 1000,
            bookingDate: BUSINESS_DATE,
            bookingStatus: 'completed',
            paymentStatus: 'partially_paid',
            paymentEligible: true,
          },
          // 6. Unpaid and completed -> Pending Payment Queue (full balance owed)
          {
            id: 'order-unpaid-completed',
            sourceKind: 'booking_order',
            orderNumber: 'ORD-006',
            customerName: 'Customer F',
            serviceDescription: 'Facial Care',
            totalAmount: 1400,
            amountPaid: 0,
            remainingBalance: 1400,
            bookingDate: BUSINESS_DATE,
            bookingStatus: 'completed',
            paymentStatus: 'unpaid',
            paymentEligible: true,
          },
          // 7. Legacy booking fully paid and completed -> Paid & Closed
          {
            id: 'legacy-paid-completed',
            sourceKind: 'legacy_booking',
            orderNumber: 'BK-007',
            customerName: 'Customer G',
            serviceDescription: 'Foot Reflexology',
            totalAmount: 600,
            amountPaid: 600,
            remainingBalance: 0,
            bookingDate: BUSINESS_DATE,
            bookingStatus: 'completed',
            paymentStatus: 'paid',
            paymentEligible: false,
          },
          // 8. Cancelled booking -> Neither
          {
            id: 'order-cancelled',
            sourceKind: 'booking_order',
            orderNumber: 'ORD-008',
            customerName: 'Customer H',
            serviceDescription: 'Manicure',
            totalAmount: 500,
            amountPaid: 0,
            remainingBalance: 0,
            bookingDate: BUSINESS_DATE,
            bookingStatus: 'cancelled',
            paymentStatus: 'unpaid',
            paymentEligible: false,
          },
        ],
      } as unknown as CashFlowWorkspaceData);

      const ctx = createMockContext();
      const result = await getDesktopPayableOrders(ctx);

      // Verify Paid & Closed contains ONLY orders 1, 2, and 7
      expect(result.paidAndClosed).toHaveLength(3);
      const paidAndClosedIds = result.paidAndClosed.map((o) => o.id);
      expect(paidAndClosedIds).toContain('order-single-paid-completed');
      expect(paidAndClosedIds).toContain('order-multi-paid-completed');
      expect(paidAndClosedIds).toContain('legacy-paid-completed');

      // Verify Pending Payment Queue contains ONLY orders 5 and 6
      expect(result.pendingQueue).toHaveLength(2);
      const pendingIds = result.pendingQueue.map((o) => o.id);
      expect(pendingIds).toContain('order-partial-completed');
      expect(pendingIds).toContain('order-unpaid-completed');

      // Verify fully-paid-pending, fully-paid-in-progress, and cancelled are in NEITHER
      expect(paidAndClosedIds).not.toContain('order-paid-service-pending');
      expect(paidAndClosedIds).not.toContain('order-paid-service-in-progress');
      expect(paidAndClosedIds).not.toContain('order-cancelled');

      expect(pendingIds).not.toContain('order-paid-service-pending');
      expect(pendingIds).not.toContain('order-paid-service-in-progress');
      expect(pendingIds).not.toContain('order-cancelled');
    });
  });

  describe('P0 — Financial Expense KPIs Isolation', () => {
    it('derives expenseAmount and expenseCount strictly from posted operational expenses without broad outflow substitution', async () => {
      mockedGetCashFlowData.mockResolvedValueOnce({
        branchId: BRANCH_ID,
        branchName: BRANCH_NAME,
        businessDate: BUSINESS_DATE,
        accounts: [],
        today: {
          kpis: { recordedPayments: 15000 },
          paymentMix: [
            { method: 'cash', amount: 9000, transactionCount: 6 },
            { method: 'gcash', amount: 6000, transactionCount: 4 },
          ],
          recentPayments: [],
          coverage: [],
        },
        dayClose: {
          recordedInflow: 15000,
          // Broad outflow includes operational expense (2500) + cash removal (3000) + refund (1000) = 6500
          recordedOutflow: 6500,
        },
        // Canonical operational expenses exposed directly from posted operational_expense transactions
        operationalExpenses: {
          totalAmount: 2500,
          count: 2,
        },
        payableOrders: [
          {
            id: 'order-due',
            remainingBalance: 500,
            bookingStatus: 'confirmed',
          },
        ],
        cashSessions: {
          activeSessions: [],
          availableDrawers: [],
        },
      } as unknown as CashFlowWorkspaceData);

      const ctx = createMockContext();
      const overview = await getDesktopCashierOverview(ctx);

      // Verify that expense KPIs match operational expenses, NOT the broad recordedOutflow (6500)
      expect(overview.kpis.expenseAmount).toBe(2500);
      expect(overview.kpis.expenseCount).toBe(2);

      // Verify other KPIs remain strictly accurate and independent
      expect(overview.kpis.totalCollected).toBe(15000);
      expect(overview.kpis.totalTransactions).toBe(10);
      expect(overview.kpis.cashAmount).toBe(9000);
      expect(overview.kpis.cashCount).toBe(6);
      expect(overview.kpis.digitalAmount).toBe(6000);
      expect(overview.kpis.digitalCount).toBe(4);
      expect(overview.kpis.pendingAmount).toBe(500);
      expect(overview.kpis.pendingBookingsCount).toBe(1);
    });
  });

  describe('P1 — History Tab Support', () => {
    it('returns history data preserving isHistoricalSummarySupported: false', async () => {
      mockedGetCashFlowData.mockResolvedValueOnce({
        branchId: BRANCH_ID,
        branchName: BRANCH_NAME,
        businessDate: BUSINESS_DATE,
        history: {
          closedDaysThisMonth: 0,
          totalInflowThisMonth: 15000,
          totalOutflowThisMonth: 0,
          reviewExceptions: 0,
          records: [
            {
              id: 'recon-1',
              date: '2026-10-22',
              branchName: BRANCH_NAME,
              status: 'reviewed',
              inflow: 8500,
              outflow: 0,
              net: 8500,
              reviewedBy: 'Staff',
            },
          ],
          auditTrail: [],
          isHistoricalSummarySupported: false,
        },
      } as unknown as CashFlowWorkspaceData);

      const ctx = createMockContext();
      const history = await getDesktopHistory(ctx);

      expect(history.records).toHaveLength(1);
      expect(history.records?.[0]?.id).toBe('recon-1');
      expect(history.isHistoricalSummarySupported).toBe(false);
    });
  });
});
