import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetFrontDeskContext, mockGetBranchBusinessDate, mockGetCashFlowData } = vi.hoisted(() => ({
  mockGetFrontDeskContext: vi.fn(),
  mockGetBranchBusinessDate: vi.fn(),
  mockGetCashFlowData: vi.fn(),
}));

vi.mock('@/lib/queries/crm-context', () => ({ getFrontDeskContext: mockGetFrontDeskContext }));
vi.mock('@/lib/engine/slot-time', () => ({ getBranchBusinessDate: mockGetBranchBusinessDate }));
vi.mock('@/lib/cash-flow/cash-flow-queries', () => ({ getCashFlowData: mockGetCashFlowData }));
vi.mock('server-only', () => ({}));

import CrmCashFlowPage from '@/app/(dashboard)/crm/cash-flow/page';
import { CashFlowRequiredDataError } from '@/lib/cash-flow/cash-flow-errors';

describe('Cash Flow page initial tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFrontDeskContext.mockResolvedValue({ branchId: 'branch-1', branchName: 'Main Spa' });
    mockGetBranchBusinessDate.mockReturnValue('2026-09-28');
    mockGetCashFlowData.mockResolvedValue({ branchId: 'branch-1' });
  });

  it('loads workspace data once and selects Today when no tab is requested', async () => {
    const page = await CrmCashFlowPage({ searchParams: Promise.resolve({}) });

    expect(page.props.initialTab).toBe('today');
    expect(mockGetCashFlowData).toHaveBeenCalledOnce();
    expect(mockGetCashFlowData).toHaveBeenCalledWith('branch-1', 'Main Spa', '2026-09-28', expect.objectContaining({ tab: 'today' }));
    expect(page.props.initialData).toEqual({ branchId: 'branch-1' });
  });

  it.each(['today', 'ledger', 'day-close', 'history'])('accepts a valid %s deep link on initial load', async (tab) => {
    const page = await CrmCashFlowPage({ searchParams: Promise.resolve({ tab }) });

    expect(page.props.initialTab).toBe(tab);
    expect(mockGetCashFlowData).toHaveBeenCalledOnce();
  });

  it.each(['unknown', '', ['ledger', 'history']])('falls back to Today for invalid tab %s', async (tab) => {
    const page = await CrmCashFlowPage({ searchParams: Promise.resolve({ tab }) });

    expect(page.props.initialTab).toBe('today');
    expect(mockGetCashFlowData).toHaveBeenCalledOnce();
  });

  it('shows a clear unavailable state when required financial data cannot load', async () => {
    mockGetCashFlowData.mockRejectedValue(new CashFlowRequiredDataError('financial_accounts'));

    const page = await CrmCashFlowPage({ searchParams: Promise.resolve({}) });

    expect(page.type).toBe('section');
    expect(page.props.role).toBe('alert');
    expect(page.props.children[0].props.children).toBe('Cash Flow is unavailable');
    expect(mockGetCashFlowData).toHaveBeenCalledOnce();
  });

  it('lets unexpected failures reach the existing error boundary', async () => {
    mockGetCashFlowData.mockRejectedValue(new Error('Unexpected failure'));

    await expect(CrmCashFlowPage({ searchParams: Promise.resolve({}) }))
      .rejects.toThrow('Unexpected failure');
  });
});
