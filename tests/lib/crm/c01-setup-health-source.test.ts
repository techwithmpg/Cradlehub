import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getBranchAssignableServices: vi.fn(),
  getBranchProviderReadiness: vi.fn(),
  getBranchBookingRulesOrDefault: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/lib/services/service-catalog', () => ({
  getBranchAssignableServices: mocks.getBranchAssignableServices,
  getBranchProviderReadiness: mocks.getBranchProviderReadiness,
}));
vi.mock('@/lib/queries/branch-booking-rules', () => ({
  getBranchBookingRulesOrDefault: mocks.getBranchBookingRulesOrDefault,
}));
vi.mock('@/lib/engine/slot-time', () => ({ getBranchBusinessDate: () => '2026-10-03' }));

import { getCrmSetupHealth } from '@/lib/queries/crm-setup';

describe('C-01 setup staff source truth', () => {
  const branchId = '11111111-1111-4111-8111-111111111111';
  const inCalls: Array<{ table: string; column: string; values: string[] }> = [];
  let staffError = false;
  let scheduleError = false;
  let staffIds: string[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    inCalls.length = 0;
    staffError = false;
    scheduleError = false;
    staffIds = [];
    mocks.getBranchAssignableServices.mockResolvedValue([]);
    mocks.getBranchProviderReadiness.mockResolvedValue([]);
    mocks.getBranchBookingRulesOrDefault.mockResolvedValue({ id: 'rules-1', homeServiceEnabled: false });
    mocks.createClient.mockResolvedValue({
      from: (table: string) => {
        const filters: Record<string, unknown> = {};
        const q = {
          select: () => q,
          eq: (column: string, value: unknown) => { filters[column] = value; return q; },
          is: () => q,
          in: (column: string, values: string[]) => {
            inCalls.push({ table, column, values });
            return q;
          },
          then: (resolve: (value: unknown) => unknown) => {
            const result = table === 'staff' && filters.staff_type !== 'driver'
              ? { data: staffIds.map((id) => ({ id })), error: staffError ? { message: 'unavailable' } : null }
              : table === 'staff_schedules'
                ? { data: [], error: scheduleError ? { message: 'unavailable' } : null }
                : { data: [], count: table === 'branch_resources' ? 1 : 0, error: null };
            return Promise.resolve(result).then(resolve);
          },
        };
        return q;
      },
    });
  });

  it('accepts a successful zero-staff result without querying staff_id in an empty list', async () => {
    const health = await getCrmSetupHealth(branchId);

    expect(health.serviceStaffTotal).toBe(0);
    expect(health.serviceStaffWithSchedule).toBe(0);
    expect(inCalls.some((call) => call.column === 'staff_id')).toBe(false);
    expect(inCalls.find((call) => call.column === 'staff_type')?.table).toBe('staff');
  });

  it('reports a failed staff source instead of fabricating zero staff', async () => {
    staffError = true;

    await expect(getCrmSetupHealth(branchId)).rejects.toThrow('Could not load active service staff');
    expect(inCalls.some((call) => call.column === 'staff_id')).toBe(false);
  });

  it('reports a failed schedule source instead of fabricating missing schedules', async () => {
    staffIds = ['staff-1'];
    scheduleError = true;

    await expect(getCrmSetupHealth(branchId)).rejects.toThrow('Could not load service staff schedules');
    expect(inCalls.find((call) => call.column === 'staff_id')?.values).toEqual(['staff-1']);
  });
});
