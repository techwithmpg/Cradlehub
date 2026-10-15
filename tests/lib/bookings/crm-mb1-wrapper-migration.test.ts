import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve("supabase/migrations/20261015105000_crm_mb1_attendee_line_resources.sql"), "utf8");
const prior = readFileSync(resolve("supabase/migrations/20260930145947_require_open_drawer_for_cash_payments.sql"), "utf8");
function functionBody(source: string) {
  const start = source.indexOf("CREATE OR REPLACE FUNCTION public.create_inhouse_order_with_payment_atomic(");
  const end = source.indexOf("$create$;", start) + "$create$;".length;
  return source.slice(start, end).replace(/\r\n/g, "\n");
}

describe("CRM-MB1 forward wrapper", () => {
  it("uses attendee-aware line lookup so local line sequences may repeat", () => {
    expect(sql).toContain("JOIN public.booking_attendees ba ON ba.id = b.attendee_id");
    expect(sql).toContain("ba.sequence = COALESCE((v_line->>'attendee_sequence')::int, 1)");
    expect(sql).toContain("b.line_sequence = COALESCE((v_line->>'line_sequence')::int, 1)");
    expect(sql).not.toContain("b.order_id = v_order_id AND b.line_sequence = v_index");
    expect(sql).toContain("jsonb_agg(b.id ORDER BY ba.sequence, b.line_sequence)");
    expect(sql).toContain("jsonb_array_length(v_result->'service_line_ids') <> v_index");
  });

  it("prefers per-line room with the existing order-level room fallback", () => {
    expect(sql).toContain("resource_id = COALESCE(NULLIF(v_line->>'resource_id', '')::uuid, NULLIF(p_options->>'resource_id', '')::uuid)");
    expect(sql).toContain("public.create_booking_order_atomic(");
    expect(sql).toContain("public.post_order_payment_atomic(");
  });

  it("changes only the function and retains service-role-only execution", () => {
    expect(sql).not.toMatch(/\b(CREATE|ALTER|DROP)\s+TABLE\b/i);
    expect(sql).toContain("SECURITY INVOKER SET search_path = ''");
    expect(sql).toContain("FROM PUBLIC, anon, authenticated;");
    expect(sql).toContain("TO service_role;");
  });

  it("retains the prior payment and authority body aside from the two bounded corrections", () => {
    const expected = functionBody(prior)
      .replace("    SELECT b.id INTO STRICT v_booking_id FROM public.bookings b\n    WHERE b.order_id = v_order_id AND b.line_sequence = v_index;",
        "    SELECT b.id INTO STRICT v_booking_id\n    FROM public.bookings b\n    JOIN public.booking_attendees ba ON ba.id = b.attendee_id\n    WHERE b.order_id = v_order_id\n      AND ba.sequence = COALESCE((v_line->>'attendee_sequence')::int, 1)\n      AND b.line_sequence = COALESCE((v_line->>'line_sequence')::int, 1);")
      .replace("resource_id = NULLIF(p_options->>'resource_id', '')::uuid,",
        "resource_id = COALESCE(NULLIF(v_line->>'resource_id', '')::uuid, NULLIF(p_options->>'resource_id', '')::uuid),")
      .replace("  SELECT jsonb_agg(b.id ORDER BY b.line_sequence) INTO v_ordered_ids\n  FROM public.bookings b WHERE b.order_id = v_order_id;",
        "  SELECT jsonb_agg(b.id ORDER BY ba.sequence, b.line_sequence) INTO v_ordered_ids\n  FROM public.bookings b\n  JOIN public.booking_attendees ba ON ba.id = b.attendee_id\n  WHERE b.order_id = v_order_id;");
    expect(functionBody(sql)).toBe(expected);
  });
});
