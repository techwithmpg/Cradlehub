import { describe, expect, it, vi } from 'vitest';
import { createPopulatedCradleLiveFixture } from '@/lib/cradle-live/fixture';

vi.mock('server-only', () => ({}));

describe('Cradle Live populated visual scenario', () => {
  it('shows one service line per guest across distinct lifecycle stages', () => {
    const data = createPopulatedCradleLiveFixture('Sample Branch', new Date('2026-10-26T01:00:00.000Z'));
    expect(data.scenario).toBe('fixture');
    expect(data.refreshedAt).toBe('2026-10-26T02:00:00.000Z');
    expect(data.bookings?.map(booking => booking.id)).toHaveLength(new Set(data.bookings?.map(booking => booking.id)).size);
    expect(new Set(data.bookings?.map(booking => booking.stage))).toEqual(new Set([
      'upcoming', 'waiting', 'in_service', 'ready_to_pay', 'completed', 'needs_attention',
    ]));
    const group = data.bookings?.filter(booking => booking.paymentRef === 'sample-group-order');
    expect(group?.map(booking => booking.stage).sort()).toEqual(['in_service', 'waiting']);
    expect(group?.find(booking => booking.stage === 'waiting')?.time).toBe('11:30:00');
    expect(data.rooms?.find(room => room.id === 'sample-room-a')).toMatchObject({ capacity: 3, occupied: 1, available: 2 });
    expect(data.rosterSummary).toEqual({ scheduledToday: 4, present: 2, freeNow: 1, inService: 1, notCheckedIn: 1 });
  });
});
