import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (name: string) => readFileSync(resolve(process.cwd(), 'supabase/migrations', name), 'utf8').replace(/\r\n/g, '\n');
const accepted = read('20260929140000_cf8_booking_payment_command.sql');
const forward = read('20260930145947_require_open_drawer_for_cash_payments.sql');

function functionBody(sql: string, name: string, delimiter: string): string {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  const end = sql.indexOf(`${delimiter};`, start);
  if (start < 0 || end < 0) throw new Error(`Missing full ${name} definition`);
  return sql.slice(start, end + delimiter.length + 1);
}

describe('physical cash session payment guard', () => {
  it('keeps the complete accepted payment functions and changes only the three cash guards', () => {
    const order = functionBody(forward, 'post_order_payment_atomic', '$func$');
    const booking = functionBody(forward, 'post_booking_payment_atomic', '$booking$');
    const create = functionBody(forward, 'create_inhouse_order_with_payment_atomic', '$create$');

    const stripDeclaration = (body: string) => body.replace(/^  v_cash_session_id UUID;\n/m, '');
    const originalOrder = functionBody(accepted, 'post_order_payment_atomic', '$func$');
    const originalBooking = functionBody(accepted, 'post_booking_payment_atomic', '$booking$');
    const originalCreate = functionBody(accepted, 'create_inhouse_order_with_payment_atomic', '$create$');

    const trimTrailingSpace = (body: string) => body.replace(/[ \t]+$/gm, '');
    expect(trimTrailingSpace(stripDeclaration(order).replace(/  -- A replay above does not collect new cash\.[\s\S]*?  -- 8\. Order Payable and Balance Validation\n/, '  -- 8. Order Payable and Balance Validation\n'))).toBe(trimTrailingSpace(originalOrder));
    expect(stripDeclaration(booking).replace(/      IF v_rail = 'cash' THEN[\s\S]*?      END IF;\n      v_total := v_total \+ v_amount;/, '      v_total := v_total + v_amount;')).toBe(originalBooking);
    expect(stripDeclaration(create).replace(/      -- Validate before BKG3 writes bookings or the order\.[\s\S]*?      END IF;\n    END LOOP;/, '    END LOOP;')).toBe(originalCreate);
  });

  it('checks the selected drawer, branch, and open state before each new cash write', () => {
    const order = functionBody(forward, 'post_order_payment_atomic', '$func$');
    const booking = functionBody(forward, 'post_booking_payment_atomic', '$booking$');
    const create = functionBody(forward, 'create_inhouse_order_with_payment_atomic', '$create$');

    for (const [body, branch] of [[order, 'v_order.branch_id'], [booking, 'v_booking.branch_id'], [create, 'v_branch']] as const) {
      expect(body).toContain('cs.cash_drawer_account_id =');
      expect(body).toContain(`cs.branch_id = ${branch}`);
      expect(body).toContain("cs.status = 'open'");
      expect(body).toContain('FOR SHARE;');
      expect(body).toContain('CASH_DRAWER_SESSION_REQUIRED');
    }
    expect(order.indexOf('CASH_DRAWER_SESSION_REQUIRED')).toBeLessThan(order.indexOf('INSERT INTO public.financial_transactions'));
    expect(booking.indexOf('CASH_DRAWER_SESSION_REQUIRED')).toBeLessThan(booking.indexOf('INSERT INTO public.financial_transactions'));
    expect(create.indexOf('CASH_DRAWER_SESSION_REQUIRED')).toBeLessThan(create.indexOf('v_result := public.create_booking_order_atomic('));
    expect(create).toContain('v_payment := public.post_order_payment_atomic(');
  });
});
