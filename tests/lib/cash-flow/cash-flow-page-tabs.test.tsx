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
});
