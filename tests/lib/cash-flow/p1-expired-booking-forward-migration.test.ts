import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(resolve(
  process.cwd(),
  'supabase/migrations/20261003081900_p1_expired_booking_financial_safety.sql'
), 'utf8');

function definition(name: string): string {
  const match = sql.match(new RegExp(
    `CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?^\\$[A-Za-z0-9_]+\\$;`,
    'm'
  ));
  expect(match, `${name} must have a forward definition`).not.toBeNull();
  return match![0];
}

describe('P1 expired closed-service forward migration contract', () => {
  it('extends the existing capped, append-only waiver to expired bookings', () => {
    const reconcile = definition('reconcile_closed_booking_service_charge');
    expect(reconcile).toContain("v_booking.status NOT IN ('cancelled', 'no_show', 'expired')");
    expect(reconcile).toContain('GREATEST(v_total_payable - v_total_allocated, 0)');
    expect(reconcile).toContain('GREATEST(v_service_payable.amount + v_existing_adjustment, 0)');
    expect(reconcile).toContain("'closed_service_adjustment'");
    expect(reconcile).toContain("'Expired service charge waiver'");
    expect(sql).toContain("WHERE b.status = 'expired'");
    expect(sql).not.toMatch(/DELETE\s+FROM\s+public\.(financial_transactions|financial_account_movements|financial_order_allocations|order_payable_items)/i);
  });

  it('reconciles cancelled, no-show, and expired status transitions', () => {
    expect(definition('p1a_reconcile_booking_on_close'))
      .toContain("NEW.status IN ('cancelled', 'no_show', 'expired')");
    expect(sql).toMatch(/CREATE TRIGGER trg_p1a_reconcile_booking_on_close[\s\S]*?NEW\.status IN \('cancelled', 'no_show', 'expired'\)/);
  });

  it('rejects a new positive service payable for every closed status', () => {
    const guard = definition('p1a_reject_closed_service_payable');
    expect(guard).toContain("v_status IN ('cancelled', 'no_show', 'expired')");
    expect(guard).toContain("NEW.charge_type = 'service'");
    expect(guard).toContain('NEW.amount > 0');
  });

  it('excludes closed siblings during lazy creation and reconciles old payables before new money', () => {
    const writer = definition('post_order_payment_atomic');
    expect(writer.match(/b\.status NOT IN \('cancelled', 'no_show', 'expired'\)/g)).toHaveLength(2);
    expect(writer.match(/b\.status IN \('cancelled', 'no_show', 'expired'\)/g)).toHaveLength(2);
    expect(writer.indexOf('PERFORM public.reconcile_closed_booking_service_charge('))
      .toBeLessThan(writer.indexOf('-- 8. Order Payable and Balance Validation'));
    expect(writer).toContain('PAYMENT_EXCEEDS_REMAINING_BALANCE');
    expect(writer).toContain('IDEMPOTENCY_CONFLICT');
    expect(writer).toContain('BRANCH_UNAUTHORIZED');
    expect(writer).toContain('CASH_DRAWER_SESSION_REQUIRED');
    expect(writer).toContain('Explicit Item-Level Allocations');
  });

  it('blocks positive direct payment deltas for all closed statuses', () => {
    const direct = definition('post_booking_payment_atomic');
    expect(direct).toContain("v_booking.status IN ('cancelled', 'no_show', 'expired') AND v_delta > 0");
    expect(direct).toContain('CASH_DRAWER_SESSION_REQUIRED');
    expect(direct).toContain('ORDER_LEVEL_PAYMENT_REQUIRED');
  });
});
