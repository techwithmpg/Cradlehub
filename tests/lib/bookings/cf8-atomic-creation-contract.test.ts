import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createInhouseBookingMultiSchema } from "@/lib/validations/booking";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260929140000_cf8_booking_payment_command.sql"),
  "utf8"
);
const engine = readFileSync(
  resolve(process.cwd(), "src/lib/bookings/inhouse-booking-engine.ts"),
  "utf8"
);
const wrapper = sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION public.create_inhouse_order_with_payment_atomic("));

describe("CF8 in-house order and payment transaction boundary", () => {
  it("makes BKG3, payables and CF4 one server-only database call", () => {
    const bkg3 = wrapper.indexOf("v_result := public.create_booking_order_atomic(");
    const payables = wrapper.indexOf("INSERT INTO public.order_payable_items");
    const cf4 = wrapper.indexOf("v_payment := public.post_order_payment_atomic(");
    expect(bkg3).toBeGreaterThan(0);
    expect(payables).toBeGreaterThan(bkg3);
    expect(cf4).toBeGreaterThan(payables);
    expect(wrapper.slice(0, wrapper.indexOf("$create$;"))).not.toMatch(/\bCOMMIT\b/);
    expect(wrapper).toContain("TO service_role;");
    expect(wrapper).toContain("FROM PUBLIC, anon, authenticated;");
    expect(engine).toContain('.rpc("create_inhouse_order_with_payment_atomic", rpcArgs)');
    expect(engine).not.toContain('.from("bookings")\n        .insert(');
  });

  it("checks account ambiguity before BKG3 and only replays a paid order with its receipt", () => {
    expect(wrapper.indexOf("ACCOUNT_SELECTION_REQUIRED")).toBeLessThan(
      wrapper.indexOf("v_result := public.create_booking_order_atomic(")
    );
    expect(wrapper).toContain("PAID_CREATION_RECEIPT_MISSING");
    expect(wrapper).toContain("cf8_creation_options_hash");
    expect(wrapper).toContain("v_tender_total <> v_total");
    expect(wrapper).toContain("'booking_order'");
  });

  it("keeps an order-level multi-booking payment off booking monetary snapshots", () => {
    const mirror = sql.slice(sql.indexOf("Only a single service booking"));
    expect(mirror).toContain("count(*) FROM public.bookings other");
    expect(mirror).toContain("opi.charge_type <> 'service'");
    expect(sql).toContain("ORDER_LEVEL_PAYMENT_REQUIRED");
    expect(sql).toContain("payable_item_id");
  });

  it("accepts a stable creation key and exact split tenders", () => {
    const parsed = createInhouseBookingMultiSchema.safeParse({
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
      branchId: "22222222-2222-4222-8222-222222222222",
      serviceIds: ["33333333-3333-4333-8333-333333333333"],
      date: "2026-09-29",
      startTime: "10:00",
      type: "walkin",
      fullName: "Test Customer",
      phone: "09171234567",
      paymentReceived: true,
      paymentMethod: "other",
      payments: [
        { amount: 100, paymentMethod: "cash" },
        { amount: 200, paymentMethod: "gcash" },
      ],
    });
    expect(parsed.success).toBe(true);
    const withoutKey = createInhouseBookingMultiSchema.safeParse({
      branchId: "22222222-2222-4222-8222-222222222222",
      serviceIds: ["33333333-3333-4333-8333-333333333333"],
      date: "2026-09-29", startTime: "10:00", type: "walkin",
      fullName: "Test Customer", phone: "09171234567",
      paymentReceived: true, paymentMethod: "cash",
    });
    expect(withoutKey.success).toBe(false);
  });
});
