import { describe, expect, it } from 'vitest';
import {
  deriveOrderPaymentEligibility,
  type OrderPaymentChild,
  type OrderPaymentItem,
} from '@/lib/cash-flow/order-payment-eligibility';

const confirmed: OrderPaymentChild = {
  id: 'booking-active', status: 'confirmed', metadata: { price_paid: 1000 },
};
const closed = (status: 'cancelled' | 'no_show' | 'expired'): OrderPaymentChild => ({
  id: 'booking-closed', status, metadata: { price_paid: 800 },
});
const activeItem: OrderPaymentItem = {
  id: 'item-active', booking_id: confirmed.id, amount: 1000,
  charge_type: 'service', source_type: 'booking', source_id: confirmed.id, sequence: 1,
};
const closedItem: OrderPaymentItem = {
  id: 'item-closed', booking_id: 'booking-closed', amount: 800,
  charge_type: 'service', source_type: 'booking', source_id: 'booking-closed', sequence: 2,
};

function eligibility(children: OrderPaymentChild[], options: {
  items?: OrderPaymentItem[];
  totalPayable?: number;
  netAllocated?: number;
} = {}) {
  return deriveOrderPaymentEligibility({
    children,
    items: options.items ?? [activeItem, closedItem],
    totalPayable: options.totalPayable ?? 1800,
    netAllocated: options.netAllocated ?? 0,
    quotedTotal: 1800,
    homeServiceFee: null,
  });
}

describe('order-level collectible payment state', () => {
  it.each(['cancelled', 'expired'] as const)(
    'excludes an unpaid %s service line regardless of child order', (status) => {
      const forward = eligibility([confirmed, closed(status)]);
      const reverse = eligibility([closed(status), confirmed]);
      expect(forward).toMatchObject({ eligible: true, total: 1000, remaining: 1000 });
      expect(reverse).toEqual(forward);
      expect(forward?.projectedWaivers).toEqual([{ bookingId: 'booking-closed', amount: 800 }]);
    }
  );

  it.each(['cancelled', 'no_show', 'expired'] as const)(
    'rejects an all-%s order', (status) => {
      expect(eligibility([closed(status)])?.eligible).toBe(false);
    }
  );

  it('keeps active unpaid and partially paid orders payable', () => {
    expect(eligibility([confirmed], { items: [activeItem], totalPayable: 1000 }))
      .toMatchObject({ eligible: true, total: 1000, remaining: 1000 });
    expect(eligibility([confirmed], { items: [activeItem], totalPayable: 1000, netAllocated: 200 }))
      .toMatchObject({ eligible: true, total: 1000, paid: 200, remaining: 800 });
  });

  it('preserves received money when a service closes after partial collection', () => {
    expect(eligibility([confirmed, closed('expired')], { netAllocated: 1300 }))
      .toMatchObject({ eligible: false, total: 1300, paid: 1300, remaining: 0 });
  });

  it('does not double-waive a line already reconciled by the financial trigger', () => {
    const adjustment: OrderPaymentItem = {
      id: 'waiver', booking_id: 'booking-closed', amount: -800,
      charge_type: 'manual_adjustment', source_type: 'closed_service_adjustment',
      source_id: closedItem.id, sequence: 3,
    };
    expect(eligibility([closed('cancelled'), confirmed], {
      items: [activeItem, closedItem, adjustment], totalPayable: 1000,
    })).toMatchObject({ eligible: true, total: 1000, remaining: 1000, projectedWaivers: [] });
  });

  it('uses active service snapshots before lazy payable creation in a mixed order', () => {
    const forward = eligibility([confirmed, closed('expired')], { items: [], totalPayable: 0 });
    const reverse = eligibility([closed('expired'), confirmed], { items: [], totalPayable: 0 });
    expect(forward).toMatchObject({ eligible: true, total: 1000, remaining: 1000 });
    expect(reverse).toEqual(forward);
  });
});
