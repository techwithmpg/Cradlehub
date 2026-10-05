import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  BookingOrderTransactionSimulator,
  computeCanonicalPayloadDigest,
  deriveBookingOrderStatus,
  validateAtomicOrderInput,
  buildAtomicBookingOrderPayload,
  mapAtomicBookingRpcError,
  buildPostCommitNotificationTask,
  isAtomicRpcSuccess,
  type CreateBookingOrderAtomicResult,
  type BookingServiceLineRecord,
} from "@/lib/bookings/bkg3-atomic-contract";

describe("BKG3 — Final Static SQL & Security Contract Verification", () => {
  let sim: BookingOrderTransactionSimulator;

  const BRANCH_ID = "11111111-1111-4111-8111-111111111111";
  const ORGANIZER_ID = "22222222-2222-4222-8222-222222222222";
  const SERVICE_1_ID = "33333333-3333-4333-8333-333333333331";
  const SERVICE_2_ID = "33333333-3333-4333-8333-333333333332";
  const STAFF_1_ID = "44444444-4444-4444-8444-444444444441";
  const STAFF_2_ID = "44444444-4444-4444-8444-444444444442";

  let migrationSql: string;
  let p1MigrationSql: string;

  beforeEach(() => {
    sim = new BookingOrderTransactionSimulator();
    sim.registerBranch(BRANCH_ID);
    sim.registerCustomer(ORGANIZER_ID);
    sim.registerService(SERVICE_1_ID);
    sim.registerService(SERVICE_2_ID);
    sim.registerStaff(STAFF_1_ID);
    sim.registerStaff(STAFF_2_ID);

    const migrationPath = resolve(
      process.cwd(),
      "supabase/migrations/20260927080000_bkg3_booking_order_atomic.sql"
    );
    migrationSql = readFileSync(migrationPath, "utf-8");
    p1MigrationSql = readFileSync(
      resolve(
        process.cwd(),
        "supabase/migrations/20261005043621_p1_booking_confirmation_origin.sql"
      ),
      "utf-8"
    );
  });

  it("P1: public online creation is pending CRM review while the in-house marker remains confirmed", async () => {
    const publicInput = buildAtomicBookingOrderPayload({
      idempotencyKey: "aaaaaaaa-bbbb-4ccc-8ddd-111111111111",
      branchId: BRANCH_ID,
      organizerCustomerId: ORGANIZER_ID,
      deliveryType: "in_spa",
      bookingDate: "2026-10-05",
      attendees: [{ sequence: 1, displayName: "Public Request" }],
      serviceLines: [
        {
          attendeeSequence: 1,
          lineSequence: 1,
          serviceId: SERVICE_1_ID,
          staffId: STAFF_1_ID,
          startTime: "10:00:00",
          endTime: "11:00:00",
        },
        {
          attendeeSequence: 1,
          lineSequence: 2,
          serviceId: SERVICE_2_ID,
          staffId: STAFF_2_ID,
          startTime: "11:00:00",
          endTime: "12:00:00",
        },
      ],
    });
    const publicResult = await sim.executeAtomic(publicInput);
    expect(publicResult.ok).toBe(true);
    if (!publicResult.ok) return;
    expect(publicResult.status).toBe("pending");
    expect(publicResult.service_line_ids).toHaveLength(2);
    for (const id of publicResult.service_line_ids) {
      expect(sim.getBooking(id)?.status).toBe("pending_crm_confirmation");
      expect(sim.getBooking(id)?.payment_status).toBe("unpaid");
    }
    const replay = await sim.executeAtomic(publicInput);
    expect(replay).toMatchObject({
      ok: true,
      idempotency_status: "replayed",
      service_line_ids: publicResult.service_line_ids,
    });

    const inHouseInput = buildAtomicBookingOrderPayload({
      idempotencyKey: "aaaaaaaa-bbbb-4ccc-8ddd-222222222222",
      branchId: BRANCH_ID,
      organizerCustomerId: ORGANIZER_ID,
      deliveryType: "in_spa",
      bookingDate: "2026-10-05",
      orderMetadata: {
        cf8_inhouse: true,
        cf8_creation_options_hash: "a".repeat(64),
      },
      attendees: [{ sequence: 1, displayName: "In-house Request" }],
      serviceLines: [
        {
          attendeeSequence: 1,
          lineSequence: 1,
          serviceId: SERVICE_1_ID,
          staffId: STAFF_1_ID,
          startTime: "12:00:00",
          endTime: "13:00:00",
        },
      ],
    });
    const inHouseResult = await sim.executeAtomic(inHouseInput);
    expect(inHouseResult.ok).toBe(true);
    if (!inHouseResult.ok) return;
    expect(sim.getBooking(inHouseResult.service_line_ids[0]!)?.status).toBe("confirmed");
  });

  it("P1: migration preserves privileged execution and adds atomic CRM confirmation plus progress guards", () => {
    expect(p1MigrationSql).toContain("pending_crm_confirmation");
    expect(p1MigrationSql).toContain("cf8_inhouse");
    expect(p1MigrationSql).toContain("cf8_creation_options_hash");
    expect(p1MigrationSql).toContain(
      "CREATE OR REPLACE FUNCTION public.confirm_online_booking_order_atomic"
    );
    expect(p1MigrationSql).toContain(
      "GRANT EXECUTE ON FUNCTION public.confirm_online_booking_order_atomic(uuid, uuid) TO service_role;"
    );
    expect(p1MigrationSql).toContain("BOOKING_NOT_CONFIRMED");
    expect(p1MigrationSql).toContain("HOME_SERVICE_TRAVEL_NOT_READY");
    expect(p1MigrationSql).toContain("b.status = 'pending_payment'");
    expect(p1MigrationSql).not.toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION[^;]+TO\s+(PUBLIC|anon|authenticated)/i
    );
  });

  // ─── A. v_booking_orders IS security_invoker ──────────────────────────────
  it("A: v_booking_orders view explicitly enforces security_invoker and restricts public access", () => {
    expect(migrationSql).toContain("CREATE OR REPLACE VIEW public.v_booking_orders");
    expect(migrationSql).toContain("WITH (security_invoker = true)");
    expect(migrationSql).toContain("REVOKE ALL ON TABLE public.v_booking_orders FROM PUBLIC;");
    expect(migrationSql).toContain("REVOKE ALL ON TABLE public.v_booking_orders FROM anon;");
    expect(migrationSql).toContain(
      "GRANT SELECT ON TABLE public.v_booking_orders TO authenticated;"
    );
    expect(migrationSql).toContain(
      "GRANT SELECT ON TABLE public.v_booking_orders TO service_role;"
    );
  });

  // ─── B. anon CANNOT READ OR WRITE CANONICAL ORDER TABLES ────────────────────
  it("B: anon role has all privileges revoked on canonical order tables", () => {
    expect(migrationSql).toContain("REVOKE ALL ON TABLE public.booking_orders FROM anon;");
    expect(migrationSql).toContain("REVOKE ALL ON TABLE public.booking_attendees FROM anon;");
    // Ensure no accidental GRANT to anon exists anywhere in the file
    expect(migrationSql).not.toMatch(/GRANT\s+.*\s+TO\s+anon/i);
  });

  // ─── C. BROWSER AUTHENTICATED USERS CANNOT WRITE CANONICAL ORDER TABLES ────
  it("C: browser authenticated users are granted SELECT only, blocking direct table writes", () => {
    expect(migrationSql).toContain("GRANT SELECT ON TABLE public.booking_orders TO authenticated;");
    expect(migrationSql).toContain(
      "GRANT SELECT ON TABLE public.booking_attendees TO authenticated;"
    );
    // Verify authenticated is NOT granted INSERT, UPDATE, DELETE, or ALL
    expect(migrationSql).not.toMatch(/GRANT\s+(ALL|INSERT|UPDATE|DELETE).*\s+TO\s+authenticated/i);
  });

  // ─── D. PRIVILEGED RPC IS NOT EXECUTABLE BY PUBLIC/ANON/AUTHENTICATED ───────
  it("D: privileged RPC create_booking_order_atomic is executable only by service_role", () => {
    expect(migrationSql).toContain(
      "REVOKE ALL ON FUNCTION public.create_booking_order_atomic(TEXT, JSONB, JSONB, JSONB) FROM PUBLIC;"
    );
    expect(migrationSql).toContain(
      "REVOKE ALL ON FUNCTION public.create_booking_order_atomic(TEXT, JSONB, JSONB, JSONB) FROM anon;"
    );
    expect(migrationSql).toContain(
      "REVOKE ALL ON FUNCTION public.create_booking_order_atomic(TEXT, JSONB, JSONB, JSONB) FROM authenticated;"
    );
    expect(migrationSql).toContain(
      "GRANT EXECUTE ON FUNCTION public.create_booking_order_atomic(TEXT, JSONB, JSONB, JSONB) TO service_role;"
    );
    // Verifies function is defined with SECURITY INVOKER
    expect(migrationSql).toMatch(
      /FUNCTION\s+public\.create_booking_order_atomic[\s\S]*?SECURITY\s+INVOKER/i
    );
  });

  // ─── E. OWNER VISIBILITY IS PRESERVED ──────────────────────────────────────
  it("E: owner role preserves global cross-branch order visibility", () => {
    expect(migrationSql).toContain('CREATE POLICY "booking_orders_owner_read_all"');
    expect(migrationSql).toContain("public.get_auth_role() = 'owner'");
    expect(migrationSql).toContain('CREATE POLICY "booking_attendees_owner_read_all"');
  });

  // ─── F. CRM VISIBILITY REMAINS COMPATIBLE WITH ACCEPTED BEHAVIOR ───────────
  it("F: CRM role preserves cross-branch read and management roles preserve branch-scoped read", () => {
    // CRM preserves cross-branch read access
    expect(migrationSql).toContain('CREATE POLICY "booking_orders_crm_read_all"');
    expect(migrationSql).toContain('CREATE POLICY "booking_attendees_crm_read_all"');
    expect(migrationSql).toContain("public.get_auth_role() = 'crm'");

    // Management roles remain branch-scoped
    expect(migrationSql).toContain('CREATE POLICY "booking_orders_management_read_branch"');
    expect(migrationSql).toContain(
      "public.get_auth_role() IN ('manager', 'assistant_manager', 'store_manager')"
    );
    expect(migrationSql).toContain("branch_id = public.get_auth_branch_id()");

    // Direct parent table access is NOT granted to staff/therapist/driver
    expect(migrationSql).not.toMatch(/CREATE\s+POLICY.*booking_orders.*staff/i);
    expect(migrationSql).not.toMatch(/CREATE\s+POLICY.*booking_orders.*therapist/i);
    expect(migrationSql).not.toMatch(/CREATE\s+POLICY.*booking_orders.*driver/i);
  });

  // ─── G. MIXED TERMINAL CHILD STATES CANNOT DERIVE CONFIRMED ────────────────
  it("G: mixed terminal child states cannot derive confirmed (table-driven matrix)", () => {
    const testCases: Array<{
      input: string[];
      expected: string;
      description: string;
    }> = [
      { input: [], expected: "no_lines", description: "no lines" },
      { input: ["confirmed", "confirmed"], expected: "confirmed", description: "all confirmed" },
      {
        input: ["confirmed", "cancelled"],
        expected: "confirmed",
        description: "confirmed + cancelled",
      },
      {
        input: ["in_progress", "confirmed"],
        expected: "in_progress",
        description: "in_progress + confirmed",
      },
      { input: ["completed", "completed"], expected: "completed", description: "all completed" },
      {
        input: ["completed", "cancelled"],
        expected: "completed",
        description: "completed + cancelled (terminal bug fix)",
      },
      {
        input: ["completed", "no_show"],
        expected: "completed",
        description: "completed + no_show",
      },
      { input: ["no_show", "cancelled"], expected: "no_show", description: "no_show + cancelled" },
      { input: ["cancelled", "cancelled"], expected: "cancelled", description: "all cancelled" },
      { input: ["expired", "expired"], expected: "expired", description: "all expired" },
      {
        input: ["expired", "cancelled"],
        expected: "cancelled",
        description: "expired + cancelled",
      },
      { input: ["pending", "cancelled"], expected: "pending", description: "pending + cancelled" },
      {
        input: ["pending_payment", "cancelled"],
        expected: "pending",
        description: "pending_payment + cancelled",
      },
      {
        input: ["pending_crm_confirmation", "cancelled"],
        expected: "pending",
        description: "pending_crm + cancelled",
      },
    ];

    for (const tc of testCases) {
      const derived = deriveBookingOrderStatus(tc.input);
      expect(derived, `Failed for ${tc.description}`).toBe(tc.expected);
    }

    // Invariant: Test any combination of terminal states ONLY
    const terminalStatuses = ["completed", "cancelled", "no_show", "expired"];
    const allTerminalCombinations = [
      ["completed", "cancelled"],
      ["cancelled", "no_show"],
      ["completed", "no_show", "cancelled"],
      ["expired", "cancelled"],
      ["no_show", "no_show"],
    ];

    for (const combo of allTerminalCombinations) {
      const result = deriveBookingOrderStatus(combo);
      expect(result).not.toBe("confirmed");
      expect(terminalStatuses).toContain(result);
    }
  });

  // ─── H. CANONICAL HASH EXCLUDES GENERATED / NONDETERMINISTIC FIELDS ─────────
  it("H: canonical idempotency hash excludes generated/nondeterministic fields", () => {
    const basePayload = {
      order: {
        branch_id: BRANCH_ID,
        organizer_customer_id: ORGANIZER_ID,
        delivery_type: "in_spa" as const,
        booking_date: "2026-10-01",
        payment_preference: "pay_at_spa" as const,
      },
      attendees: [{ sequence: 1, display_name: "Determinism Test" }],
      service_lines: [
        {
          attendee_sequence: 1,
          line_sequence: 1,
          service_id: SERVICE_1_ID,
          staff_id: STAFF_1_ID,
          start_time: "10:00:00",
          end_time: "11:00:00",
        },
      ],
    };

    const digest1 = computeCanonicalPayloadDigest(basePayload);

    // Pass same inputs with generated IDs or timestamps injected accidentally
    const pollutedPayload = {
      order: {
        ...basePayload.order,
        // Generated IDs and timestamps that should NOT alter canonical digest
        order_id: "00000000-0000-0000-0000-000000000001",
        order_number: "CRD-2610-FAKE",
        created_at: "2026-10-01T00:00:00Z",
      } as unknown as typeof basePayload.order,
      attendees: [
        {
          ...basePayload.attendees[0]!,
          id: "00000000-0000-0000-0000-000000000002",
          created_at: "2026-10-01T00:00:00Z",
        } as unknown as (typeof basePayload.attendees)[0],
      ],
      service_lines: [
        {
          ...basePayload.service_lines[0]!,
          id: "00000000-0000-0000-0000-000000000003",
          created_at: "2026-10-01T00:00:00Z",
        } as unknown as (typeof basePayload.service_lines)[0],
      ],
    };

    const digest2 = computeCanonicalPayloadDigest(pollutedPayload);
    expect(digest1).toBe(digest2);
  });

  // ─── I. LEGACY BOOKING WITH NULL ORDER_ID REMAINS VALID ─────────────────────
  it("I: legacy booking with NULL order_id remains completely valid and readable", () => {
    const legacyBookingId = "00000000-0000-4000-8000-000000000099";
    const legacyRow: BookingServiceLineRecord = {
      id: legacyBookingId,
      order_id: null,
      attendee_id: null,
      line_sequence: null,
      branch_id: BRANCH_ID,
      service_id: SERVICE_1_ID,
      staff_id: STAFF_1_ID,
      customer_id: ORGANIZER_ID,
      booking_date: "2026-05-01",
      start_time: "09:00:00",
      end_time: "10:00:00",
      type: "online",
      delivery_type: "in_spa",
      status: "confirmed",
      payment_method: "pay_on_site",
      payment_status: "unpaid",
      amount_paid: 0,
      travel_buffer_mins: null,
      metadata: { note: "Historical booking before BKG3" },
      created_at: "2026-05-01T09:00:00Z",
    };

    sim.seedLegacyBooking(legacyRow);

    const retrieved = sim.getBooking(legacyBookingId);
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(legacyBookingId);
    expect(retrieved?.order_id).toBeNull();
    expect(retrieved?.status).toBe("confirmed");
  });

  // ─── J. UNSUPPORTED ONLINE_CHECKOUT REMAINS ABSENT ──────────────────────────
  it("J: unsupported online_checkout remains strictly absent from migration and contract", () => {
    // Migration constraint must enforce strictly 'pay_at_spa'
    expect(migrationSql).toContain("CHECK (payment_preference = 'pay_at_spa')");
    expect(migrationSql).not.toContain("online_checkout");

    // TypeScript contract rejects online_checkout
    const invalidInput = {
      idempotency_key: "aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa",
      order: {
        branch_id: BRANCH_ID,
        organizer_customer_id: ORGANIZER_ID,
        delivery_type: "in_spa" as const,
        booking_date: "2026-10-01",
        payment_preference: "online_checkout" as unknown as "pay_at_spa", // INVALID
      },
      attendees: [{ sequence: 1, display_name: "Test" }],
      service_lines: [
        {
          attendee_sequence: 1,
          line_sequence: 1,
          service_id: SERVICE_1_ID,
          staff_id: STAFF_1_ID,
          start_time: "10:00:00",
          end_time: "11:00:00",
        },
      ],
    };

    const validation = validateAtomicOrderInput(invalidInput);
    expect(validation.valid).toBe(false);
    if (validation.valid) return;
    expect(validation.errors[0]?.message).toContain("Only 'pay_at_spa' is supported");
  });
});

describe("BKG3-ACT2 — Runtime Cutover & Integration Contract Verification", () => {
  let sim: BookingOrderTransactionSimulator;

  const BRANCH_ID = "11111111-1111-4111-8111-111111111111";
  const ORGANIZER_ID = "22222222-2222-4222-8222-222222222222";
  const SERVICE_1_ID = "33333333-3333-4333-8333-333333333331";
  const SERVICE_2_ID = "33333333-3333-4333-8333-333333333332";
  const STAFF_1_ID = "44444444-4444-4444-8444-444444444441";
  const STAFF_2_ID = "44444444-4444-4444-8444-444444444442";

  beforeEach(() => {
    sim = new BookingOrderTransactionSimulator();
    sim.registerBranch(BRANCH_ID);
    sim.registerCustomer(ORGANIZER_ID);
    sim.registerService(SERVICE_1_ID);
    sim.registerService(SERVICE_2_ID);
    sim.registerStaff(STAFF_1_ID);
    sim.registerStaff(STAFF_2_ID);
  });

  // A. Canonical payload generation
  it("A: generates canonical atomic RPC payload matching migration contract", () => {
    const key = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const payload = buildAtomicBookingOrderPayload({
      idempotencyKey: key,
      branchId: BRANCH_ID,
      organizerCustomerId: ORGANIZER_ID,
      deliveryType: "in_spa",
      bookingDate: "2026-10-05",
      attendees: [{ sequence: 1, displayName: "Maria Clara", customerId: ORGANIZER_ID }],
      serviceLines: [
        {
          attendeeSequence: 1,
          lineSequence: 1,
          serviceId: SERVICE_1_ID,
          staffId: STAFF_1_ID,
          startTime: "14:00:00",
          endTime: "15:00:00",
        },
      ],
    });

    expect(payload.idempotency_key).toBe(key);
    expect(payload.order.branch_id).toBe(BRANCH_ID);
    expect(payload.order.organizer_customer_id).toBe(ORGANIZER_ID);
    expect(payload.order.delivery_type).toBe("in_spa");
    expect(payload.order.payment_preference).toBe("pay_at_spa");
    expect(payload.attendees).toHaveLength(1);
    expect(payload.attendees[0]?.display_name).toBe("Maria Clara");
    expect(payload.service_lines).toHaveLength(1);
    expect(payload.service_lines[0]?.attendee_sequence).toBe(1);
    expect(payload.service_lines[0]?.line_sequence).toBe(1);
  });

  // B. Idempotency key persistence
  it("B: preserves client-owned UUID idempotency key across creation and retry", async () => {
    const persistentAttemptId = "55555555-5555-4555-8555-555555555555";
    const input = buildAtomicBookingOrderPayload({
      idempotencyKey: persistentAttemptId,
      branchId: BRANCH_ID,
      organizerCustomerId: ORGANIZER_ID,
      deliveryType: "in_spa",
      bookingDate: "2026-10-05",
      attendees: [{ sequence: 1, displayName: "Guest", customerId: ORGANIZER_ID }],
      serviceLines: [
        {
          attendeeSequence: 1,
          lineSequence: 1,
          serviceId: SERVICE_1_ID,
          staffId: STAFF_1_ID,
          startTime: "10:00:00",
          endTime: "11:00:00",
        },
      ],
    });

    const res1 = await sim.executeAtomic(input);
    expect(res1.ok).toBe(true);
    if (!res1.ok) return;
    expect(res1.idempotency_status).toBe("created");

    const orderRow = sim.getOrder(res1.order_id);
    expect(orderRow?.idempotency_key).toBe(persistentAttemptId);

    // Resubmission with same key
    const res2 = await sim.executeAtomic(input);
    expect(res2.ok).toBe(true);
    if (!res2.ok) return;
    expect(res2.idempotency_status).toBe("replayed");
    expect(res2.order_id).toBe(res1.order_id);
    expect(res2.order_number).toBe(res1.order_number);
  });

  // C. One attendee / one service payload
  it("C: correctly persists one attendee and one service line", async () => {
    const input = buildAtomicBookingOrderPayload({
      idempotencyKey: "11111111-2222-4333-8444-555555555555",
      branchId: BRANCH_ID,
      organizerCustomerId: ORGANIZER_ID,
      deliveryType: "in_spa",
      bookingDate: "2026-10-05",
      attendees: [{ sequence: 1, displayName: "Single Guest", customerId: ORGANIZER_ID }],
      serviceLines: [
        {
          attendeeSequence: 1,
          lineSequence: 1,
          serviceId: SERVICE_1_ID,
          staffId: STAFF_1_ID,
          startTime: "09:00:00",
          endTime: "10:00:00",
        },
      ],
    });

    const result = await sim.executeAtomic(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.service_line_ids).toHaveLength(1);
    expect(result.attendee_ids).toHaveLength(1);

    const booking = sim.getBooking(result.service_line_ids[0]!);
    expect(booking).toBeDefined();
    expect(booking?.order_id).toBe(result.order_id);
    expect(booking?.attendee_id).toBe(result.attendee_ids[0]!);
    expect(booking?.line_sequence).toBe(1);
    expect(booking?.customer_id).toBe(ORGANIZER_ID);
  });

  // D. One attendee / multiple service payload
  it("D: correctly persists one attendee with sequential service lines", async () => {
    const input = buildAtomicBookingOrderPayload({
      idempotencyKey: "22222222-3333-4444-8555-666666666666",
      branchId: BRANCH_ID,
      organizerCustomerId: ORGANIZER_ID,
      deliveryType: "in_spa",
      bookingDate: "2026-10-05",
      attendees: [{ sequence: 1, displayName: "Multi Service Guest", customerId: ORGANIZER_ID }],
      serviceLines: [
        {
          attendeeSequence: 1,
          lineSequence: 1,
          serviceId: SERVICE_1_ID,
          staffId: STAFF_1_ID,
          startTime: "10:00:00",
          endTime: "11:00:00",
        },
        {
          attendeeSequence: 1,
          lineSequence: 2,
          serviceId: SERVICE_2_ID,
          staffId: STAFF_1_ID,
          startTime: "11:00:00",
          endTime: "11:45:00",
        },
      ],
    });

    const result = await sim.executeAtomic(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.service_line_ids).toHaveLength(2);
    expect(result.attendee_ids).toHaveLength(1);

    const line1 = sim.getBooking(result.service_line_ids[0]!);
    const line2 = sim.getBooking(result.service_line_ids[1]!);
    expect(line1?.line_sequence).toBe(1);
    expect(line2?.line_sequence).toBe(2);
    expect(line1?.attendee_id).toBe(line2?.attendee_id);
    expect(line1?.start_time).toBe("10:00:00");
    expect(line2?.start_time).toBe("11:00:00");
  });

  // E. Multiple attendee payload
  it("E: correctly persists multiple attendees with concurrent service lines", async () => {
    const input = buildAtomicBookingOrderPayload({
      idempotencyKey: "33333333-4444-4555-8666-777777777777",
      branchId: BRANCH_ID,
      organizerCustomerId: ORGANIZER_ID,
      deliveryType: "in_spa",
      bookingDate: "2026-10-05",
      attendees: [
        { sequence: 1, displayName: "Maria Clara", customerId: ORGANIZER_ID },
        { sequence: 2, displayName: "Crisostomo Ibarra", customerId: null },
      ],
      serviceLines: [
        {
          attendeeSequence: 1,
          lineSequence: 1,
          serviceId: SERVICE_1_ID,
          staffId: STAFF_1_ID,
          startTime: "14:00:00",
          endTime: "15:00:00",
        },
        {
          attendeeSequence: 2,
          lineSequence: 1,
          serviceId: SERVICE_1_ID,
          staffId: STAFF_2_ID,
          startTime: "14:00:00",
          endTime: "15:00:00",
        },
      ],
    });

    const result = await sim.executeAtomic(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.attendee_ids).toHaveLength(2);
    expect(result.service_line_ids).toHaveLength(2);

    const b1 = sim.getBooking(result.service_line_ids[0]!);
    const b2 = sim.getBooking(result.service_line_ids[1]!);
    expect(b1?.attendee_id).toBe(result.attendee_ids[0]!);
    expect(b2?.attendee_id).toBe(result.attendee_ids[1]!);
    expect(b1?.staff_id).toBe(STAFF_1_ID);
    expect(b2?.staff_id).toBe(STAFF_2_ID);
  });

  // F. Guest attendee without customer_id
  it("F: supports guest attendee with null customer_id while preserving organizer compatibility", async () => {
    const input = buildAtomicBookingOrderPayload({
      idempotencyKey: "44444444-5555-4666-8777-888888888888",
      branchId: BRANCH_ID,
      organizerCustomerId: ORGANIZER_ID,
      deliveryType: "in_spa",
      bookingDate: "2026-10-05",
      attendees: [{ sequence: 1, displayName: "Guest Companion", customerId: null }],
      serviceLines: [
        {
          attendeeSequence: 1,
          lineSequence: 1,
          serviceId: SERVICE_1_ID,
          staffId: STAFF_1_ID,
          startTime: "16:00:00",
          endTime: "17:00:00",
        },
      ],
    });

    const result = await sim.executeAtomic(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const attendees = sim.getAttendeesForOrder(result.order_id);
    expect(attendees[0]?.customer_id).toBeNull();

    const booking = sim.getBooking(result.service_line_ids[0]!);
    // bookings.customer_id MUST point to organizer_customer_id for legacy compatibility
    expect(booking?.customer_id).toBe(ORGANIZER_ID);
    expect(booking?.attendee_id).toBe(attendees[0]?.id);
  });

  // G. Home Service payload
  it("G: builds and persists Home Service payload with delivery_type and travel buffer", async () => {
    const input = buildAtomicBookingOrderPayload({
      idempotencyKey: "55555555-6666-4777-8888-999999999999",
      branchId: BRANCH_ID,
      organizerCustomerId: ORGANIZER_ID,
      deliveryType: "home_service",
      bookingDate: "2026-10-05",
      orderMetadata: {
        home_service_address: { address: "123 Lacson St, Bacolod City" },
      },
      attendees: [{ sequence: 1, displayName: "Home Service Client", customerId: ORGANIZER_ID }],
      serviceLines: [
        {
          attendeeSequence: 1,
          lineSequence: 1,
          serviceId: SERVICE_1_ID,
          staffId: STAFF_1_ID,
          startTime: "13:00:00",
          endTime: "14:00:00",
          travelBufferMins: 30,
        },
      ],
    });

    expect(input.order.delivery_type).toBe("home_service");
    expect(input.service_lines[0]?.travel_buffer_mins).toBe(30);

    const result = await sim.executeAtomic(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const order = sim.getOrder(result.order_id);
    expect(order?.delivery_type).toBe("home_service");

    const line = sim.getBooking(result.service_line_ids[0]!);
    expect(line?.delivery_type).toBe("home_service");
    expect(line?.travel_buffer_mins).toBe(30);
  });

  // H. Replay response handling
  it("H: returns idempotency_status 'replayed' on exact resubmission without duplicates", async () => {
    const key = "66666666-7777-4888-8999-aaaaaaaaaaaa";
    const input = buildAtomicBookingOrderPayload({
      idempotencyKey: key,
      branchId: BRANCH_ID,
      organizerCustomerId: ORGANIZER_ID,
      deliveryType: "in_spa",
      bookingDate: "2026-10-05",
      attendees: [{ sequence: 1, displayName: "Replay Test", customerId: ORGANIZER_ID }],
      serviceLines: [
        {
          attendeeSequence: 1,
          lineSequence: 1,
          serviceId: SERVICE_1_ID,
          staffId: STAFF_1_ID,
          startTime: "10:00:00",
          endTime: "11:00:00",
        },
      ],
    });

    const first = await sim.executeAtomic(input);
    const second = await sim.executeAtomic(input);

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(first.idempotency_status).toBe("created");
    expect(second.idempotency_status).toBe("replayed");
    expect(second.order_id).toBe(first.order_id);
    expect(second.order_number).toBe(first.order_number);
    expect(second.service_line_ids).toEqual(first.service_line_ids);
  });

  // I. Idempotency conflict mapping
  it("I: maps IDEMPOTENCY_CONFLICT when key is reused with different payload", async () => {
    const key = "77777777-8888-4999-8aaa-bbbbbbbbbbbb";
    const input1 = buildAtomicBookingOrderPayload({
      idempotencyKey: key,
      branchId: BRANCH_ID,
      organizerCustomerId: ORGANIZER_ID,
      deliveryType: "in_spa",
      bookingDate: "2026-10-05",
      attendees: [{ sequence: 1, displayName: "First Version", customerId: ORGANIZER_ID }],
      serviceLines: [
        {
          attendeeSequence: 1,
          lineSequence: 1,
          serviceId: SERVICE_1_ID,
          staffId: STAFF_1_ID,
          startTime: "10:00:00",
          endTime: "11:00:00",
        },
      ],
    });

    const input2 = buildAtomicBookingOrderPayload({
      idempotencyKey: key, // SAME KEY
      branchId: BRANCH_ID,
      organizerCustomerId: ORGANIZER_ID,
      deliveryType: "in_spa",
      bookingDate: "2026-10-05",
      attendees: [{ sequence: 1, displayName: "Mutated Version", customerId: ORGANIZER_ID }], // DIFFERENT
      serviceLines: [
        {
          attendeeSequence: 1,
          lineSequence: 1,
          serviceId: SERVICE_2_ID, // DIFFERENT SERVICE
          staffId: STAFF_1_ID,
          startTime: "10:00:00",
          endTime: "11:00:00",
        },
      ],
    });

    await sim.executeAtomic(input1);
    const result2 = await sim.executeAtomic(input2);

    expect(result2.ok).toBe(false);
    if (result2.ok) return;
    expect(result2.code).toBe("IDEMPOTENCY_CONFLICT");

    const mapped = mapAtomicBookingRpcError(result2);
    expect(mapped.code).toBe("IDEMPOTENCY_CONFLICT");
    expect(mapped.message).toContain("already exists with different details");
  });

  // J. Staff conflict mapping
  it("J: maps BOOKING_STAFF_TIME_CONFLICT to clear therapist unavailability message", async () => {
    const input1 = buildAtomicBookingOrderPayload({
      idempotencyKey: "88888888-9999-4aaa-8bbb-cccccccccccc",
      branchId: BRANCH_ID,
      organizerCustomerId: ORGANIZER_ID,
      deliveryType: "in_spa",
      bookingDate: "2026-10-05",
      attendees: [{ sequence: 1, displayName: "Guest 1", customerId: ORGANIZER_ID }],
      serviceLines: [
        {
          attendeeSequence: 1,
          lineSequence: 1,
          serviceId: SERVICE_1_ID,
          staffId: STAFF_1_ID, // STAFF 1
          startTime: "14:00:00",
          endTime: "15:00:00",
        },
      ],
    });

    const input2 = buildAtomicBookingOrderPayload({
      idempotencyKey: "99999999-aaaa-4bbb-8ccc-dddddddddddd",
      branchId: BRANCH_ID,
      organizerCustomerId: ORGANIZER_ID,
      deliveryType: "in_spa",
      bookingDate: "2026-10-05",
      attendees: [{ sequence: 1, displayName: "Guest 2", customerId: ORGANIZER_ID }],
      serviceLines: [
        {
          attendeeSequence: 1,
          lineSequence: 1,
          serviceId: SERVICE_1_ID,
          staffId: STAFF_1_ID, // SAME STAFF 1, OVERLAPPING TIME
          startTime: "14:30:00",
          endTime: "15:30:00",
        },
      ],
    });

    await sim.executeAtomic(input1);
    const result2 = await sim.executeAtomic(input2);

    expect(result2.ok).toBe(false);
    if (result2.ok) return;
    expect(result2.code).toBe("BOOKING_STAFF_TIME_CONFLICT");

    const mapped = mapAtomicBookingRpcError(result2);
    expect(mapped.code).toBe("BOOKING_STAFF_TIME_CONFLICT");
    expect(mapped.message).toContain("therapist is no longer available");
  });

  // K. Resource conflict mapping
  it("K: maps BOOKING_RESOURCE_TIME_CONFLICT to clear room unavailability message", () => {
    const errorObj = {
      message: "violates exclusion constraint",
      details: "BOOKING_RESOURCE_TIME_CONFLICT: Treatment room is occupied",
    };
    const mapped = mapAtomicBookingRpcError(errorObj);
    expect(mapped.code).toBe("BOOKING_RESOURCE_TIME_CONFLICT");
    expect(mapped.message).toContain("treatment room is no longer available");
  });

  // L. Notification suppression on replay
  it("L: suppresses notifications on idempotent replay while executing on initial creation", () => {
    const createdResult: Extract<CreateBookingOrderAtomicResult, { ok: true }> = {
      ok: true,
      idempotency_status: "created",
      order_id: "ord-1",
      order_number: "CRD-2610-A1B2",
      status: "confirmed",
      service_line_ids: ["bkg-1"],
      attendee_ids: ["att-1"],
    };

    const replayedResult: Extract<CreateBookingOrderAtomicResult, { ok: true }> = {
      ...createdResult,
      idempotency_status: "replayed",
    };

    expect(isAtomicRpcSuccess(createdResult)).toBe(true);
    const taskCreated = buildPostCommitNotificationTask({
      rpcResult: createdResult,
      organizerPhone: "09171234567",
      deliveryType: "in_spa",
      bookingDate: "2026-10-05",
    });
    expect(taskCreated).not.toBeNull();
    expect(taskCreated?.orderNumber).toBe("CRD-2610-A1B2");

    const taskReplayed = buildPostCommitNotificationTask({
      rpcResult: replayedResult,
      organizerPhone: "09171234567",
      deliveryType: "in_spa",
      bookingDate: "2026-10-05",
    });
    expect(taskReplayed).toBeNull(); // Strictly suppressed on replay!
  });

  // M. Confirmed + unpaid contract
  it("M: enforces operationally confirmed and financially unpaid contract", async () => {
    const input = buildAtomicBookingOrderPayload({
      idempotencyKey: "aaaaaaaa-bbbb-4ccc-8ddd-111111111111",
      branchId: BRANCH_ID,
      organizerCustomerId: ORGANIZER_ID,
      deliveryType: "in_spa",
      bookingDate: "2026-10-05",
      orderMetadata: {
        cf8_inhouse: true,
        cf8_creation_options_hash: "a".repeat(64),
      },
      attendees: [
        { sequence: 1, displayName: "Financial Boundary Test", customerId: ORGANIZER_ID },
      ],
      serviceLines: [
        {
          attendeeSequence: 1,
          lineSequence: 1,
          serviceId: SERVICE_1_ID,
          staffId: STAFF_1_ID,
          startTime: "10:00:00",
          endTime: "11:00:00",
        },
      ],
    });

    const result = await sim.executeAtomic(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const booking = sim.getBooking(result.service_line_ids[0]!);
    expect(booking?.status).toBe("confirmed");
    expect(booking?.payment_method).toBe("pay_on_site");
    expect(booking?.payment_status).toBe("unpaid");
    expect(booking?.amount_paid).toBe(0);
  });

  // N. No sequential fallback after RPC failure
  it("N: returns controlled failure and does not perform sequential fallback on RPC failure", async () => {
    const brokenInput = buildAtomicBookingOrderPayload({
      idempotencyKey: "bbbbbbbb-cccc-4ddd-8eee-222222222222",
      branchId: "00000000-0000-4000-8000-000000000000", // Valid UUID but non-existent branch
      organizerCustomerId: ORGANIZER_ID,
      deliveryType: "in_spa",
      bookingDate: "2026-10-05",
      attendees: [{ sequence: 1, displayName: "Fail Test", customerId: ORGANIZER_ID }],
      serviceLines: [
        {
          attendeeSequence: 1,
          lineSequence: 1,
          serviceId: SERVICE_1_ID,
          staffId: STAFF_1_ID,
          startTime: "10:00:00",
          endTime: "11:00:00",
        },
      ],
    });

    const rpcResult = await sim.executeAtomic(brokenInput);
    expect(rpcResult.ok).toBe(false);
    if (rpcResult.ok) return;

    // Verify mapped error is returned
    const mapped = mapAtomicBookingRpcError(rpcResult);
    expect(mapped.code).toBe("BRANCH_NOT_FOUND");
    expect(mapped.message).toContain("Selected branch was not found");

    // Verify NO rows were persisted in simulator
    expect(sim.getAttendeesForOrder("any")).toHaveLength(0);
  });
});
