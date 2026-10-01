import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20261001090000_p1a_closed_booking_financial_safety.sql",
)

const sql = readFileSync(migrationPath, "utf8")

describe("P1-A closed booking financial safety migration", () => {
  it("preserves the approved closed booking states", () => {
    expect(sql).toContain("'cancelled'")
    expect(sql).toContain("'no_show'")
  })

  it("uses an append-only manual adjustment instead of deleting the original service charge", () => {
    expect(sql).toContain("'manual_adjustment'")
    expect(sql).toContain("'closed_service_adjustment'")
    expect(sql).toContain("reconcile_closed_booking_service_charge")

    expect(sql).not.toMatch(
      /DELETE\s+FROM\s+public\.order_payable_items/i,
    )
  })

  it("preserves received money instead of deleting financial history", () => {
    expect(sql).not.toMatch(
      /DELETE\s+FROM\s+public\.financial_transactions/i,
    )

    expect(sql).not.toMatch(
      /DELETE\s+FROM\s+public\.financial_account_movements/i,
    )

    expect(sql).not.toMatch(
      /DELETE\s+FROM\s+public\.financial_order_allocations/i,
    )
  })

  it("caps the waiver against the remaining order collectible balance", () => {
    expect(sql).toContain(
      "GREATEST(v_total_payable - v_total_allocated, 0)",
    )

    expect(sql).toContain("LEAST(")
    expect(sql).toContain("v_order_remaining")
  })

  it("does not invent item-level attribution for historical order-level payments", () => {
    expect(sql).toContain(
      "Payments may historically be allocated at ORDER level",
    )

    expect(sql).toContain(
      "payable_item_id = NULL",
    )
  })

  it("prevents positive service payables from being created for already closed bookings", () => {
    expect(sql).toContain(
      "CLOSED_BOOKING_SERVICE_NOT_COLLECTIBLE",
    )

    const exclusions = sql.match(
      /b\.status NOT IN \('cancelled', 'no_show'\)/g,
    )

    expect(exclusions?.length ?? 0).toBeGreaterThanOrEqual(2)
  })

  it("carries forward the P1-B cash drawer protection", () => {
    expect(sql).toContain(
      "CASH_DRAWER_SESSION_REQUIRED",
    )

    expect(sql).toContain(
      "CREATE OR REPLACE FUNCTION public.post_order_payment_atomic",
    )
  })

  it("preserves payment authorization and branch enforcement", () => {
    expect(sql).toContain("PAYMENT_ROLE_UNAUTHORIZED")
    expect(sql).toContain("BRANCH_UNAUTHORIZED")
    expect(sql).toContain("ACCOUNT_TYPE_MISMATCH")
  })

  it("preserves idempotency and overpayment protection", () => {
    expect(sql).toContain("IDEMPOTENCY_CONFLICT")
    expect(sql).toContain(
      "PAYMENT_EXCEEDS_REMAINING_BALANCE",
    )
  })

  it("does not use the historical checkout total as collectible authority when a sibling is closed", () => {
    expect(sql).toMatch(
      /IF NOT EXISTS\s*\(\s*SELECT 1[\s\S]*?FROM public\.bookings b[\s\S]*?WHERE b\.order_id = p_order_id[\s\S]*?AND b\.status IN \('cancelled', 'no_show'\)/,
    )
  })
})

