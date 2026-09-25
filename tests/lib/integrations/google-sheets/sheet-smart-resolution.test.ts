import { describe, expect, it } from "vitest";
import {
  buildSheetContextIndexes,
  unavailableSheetContext,
  type SheetContext,
  type SheetStaff,
} from "@/lib/integrations/google-sheets/sheet-resolution-context";
import {
  resolveSheetCustomer,
  resolveSheetService,
  resolveSheetStaff,
} from "@/lib/integrations/google-sheets/sheet-resolvers";
import {
  buildSheetIngestionDryRun,
  summarizeSheetDryRun,
} from "@/lib/integrations/google-sheets/sheet-dry-run";
import { header, serviceRow } from "./smart-sheet-fixtures";

export function fixtureContext(): SheetContext {
  return {
    ...unavailableSheetContext(""),
    status: "available",
    target: "TEST",
    unavailableReason: null,
    branch: { id: "branch", is_active: true },
    staff: [
      {
        id: "staff",
        full_name: "Nicole Fixture",
        nickname: "Nikki",
        branch_id: "branch",
        is_active: true,
        staff_type: "therapist",
        system_role: "staff",
        archived_at: null,
        merged_into_staff_id: null,
        metadata: {},
      } as SheetStaff,
    ],
    services: [
      {
        id: "service",
        name: "Swedish Massage",
        is_active: true,
        duration_minutes: 60,
        buffer_before: 0,
        buffer_after: 0,
      },
    ],
    branchServices: [
      {
        service_id: "service",
        branch_id: "branch",
        is_active: true,
        available_in_spa: true,
        available_home_service: false,
        visibility: "public",
        booking_visibility: "public",
        custom_duration_minutes: null,
      },
    ],
    capabilities: [{ staff_id: "staff", service_id: "service" }],
    customers: [
      {
        id: "customer",
        full_name: "Test Customer",
        phone: "09123456789",
        email: "fixture@example.test",
      },
    ],
    contacts: [
      { name: "Test Customer", phone: "+639123456789", email: null, source: "approved_fixture" },
    ],
    schedules: [
      {
        staff_id: "staff",
        day_of_week: 5,
        shift_type: "single",
        start_time: "09:00",
        end_time: "18:00",
        is_active: true,
      },
    ],
    rules: {
      home_service_enabled: false,
      in_spa_start_time: "09:00",
      in_spa_end_time: "17:00",
      home_service_start_time: "09:00",
      home_service_end_time: "17:00",
      max_advance_booking_days: 30,
    },
    deliveryPolicy: {
      value: "in_spa",
      approvedBy: "fixture-owner",
      approvedAt: "2026-09-18T00:00:00Z",
    },
  };
}
function staffResolution(context: SheetContext, name = "Nikki") {
  const indexes = buildSheetContextIndexes(context);
  return resolveSheetStaff(name, resolveSheetService("Swedish Massage", indexes), false, indexes);
}
const customer = (c: SheetContext) =>
  resolveSheetCustomer("Test Customer", buildSheetContextIndexes(c));
async function dry(context: SheetContext, row = serviceRow()) {
  const run = await buildSheetIngestionDryRun({
    spreadsheetId: "fixture",
    sheetName: "fixture",
    rawValues: [header, ["September 18, 2026"], row],
    merges: [],
    context,
    now: new Date("2026-09-18T00:00:00Z"),
  });
  return { run, row: run.rows.find((r) => r.plan.intent === "service")! };
}

describe("deterministic identity resolution", () => {
  it("resolves exact and normalized services without fuzzy matching", () => {
    const index = buildSheetContextIndexes(fixtureContext());
    expect(resolveSheetService("Swedish Massage", index).method).toBe("exact_name");
    expect(resolveSheetService(" swedish   MASSAGE ", index).method).toBe("normalized_name");
    expect(resolveSheetService("Swedish Massag", index).status).toBe("missing");
  });
  it("uses only approved scoped service aliases", () => {
    const c = fixtureContext();
    c.aliases = [
      {
        rawAlias: "SM",
        targetId: "service",
        targetType: "service",
        branchId: "branch",
        approvedBy: "owner",
        approvedAt: "2026-09-18",
        status: "active",
      },
    ];
    expect(resolveSheetService("SM", buildSheetContextIndexes(c)).method).toBe("approved_alias");
    c.aliases[0]!.status = "revoked";
    expect(resolveSheetService("SM", buildSheetContextIndexes(c)).status).toBe("missing");
    c.aliases[0]!.status = "active";
    c.aliases[0]!.branchId = "other";
    expect(resolveSheetService("SM", buildSheetContextIndexes(c)).status).toBe("missing");
  });
  it("resolves full name, normalized name, nickname and approved staff alias", () => {
    const c = fixtureContext();
    expect(staffResolution(c, "Nicole Fixture").method).toBe("exact_name");
    expect(staffResolution(c, "NICOLE fixture").method).toBe("normalized_name");
    expect(staffResolution(c).method).toBe("nickname");
    c.aliases = [
      {
        rawAlias: "NF",
        targetId: "staff",
        targetType: "staff",
        branchId: "branch",
        approvedBy: "owner",
        approvedAt: "2026-09-18",
        status: "active",
      },
    ];
    expect(staffResolution(c, "NF").method).toBe("approved_alias");
  });
  it("disambiguates duplicate nicknames with explicit service capability", () => {
    const c = fixtureContext();
    c.staff.push({ ...c.staff[0]!, id: "other", full_name: "Other Fixture" });
    expect(staffResolution(c)).toMatchObject({
      status: "resolved",
      method: "service_capability_disambiguation",
      value: { id: "staff" },
    });
    c.capabilities.push({ staff_id: "other", service_id: "service" });
    expect(staffResolution(c)).toMatchObject({ status: "ambiguous", value: null });
  });
  it.each(["wrong_branch", "not_operational", "service_incompatible"])(
    "preserves unique identity while reporting %s",
    (reason) => {
      const c = fixtureContext();
      if (reason === "wrong_branch") c.staff[0]!.branch_id = "other";
      if (reason === "not_operational") c.staff[0]!.is_active = false;
      if (reason === "service_incompatible") c.capabilities = [];
      expect(staffResolution(c)).toMatchObject({
        value: { id: "staff" },
        rejected: [{ id: "staff", reason }],
      });
    }
  );
  it("never resolves duplicate customer names by first match", () => {
    const c = fixtureContext();
    c.contacts = [];
    c.customers.push({ ...c.customers[0]!, id: "other" });
    expect(customer(c)).toMatchObject({ classification: "ambiguous", value: null });
  });
  it("requires contact identity even for one name-only match", () => {
    const c = fixtureContext();
    c.contacts = [];
    expect(customer(c)).toMatchObject({ classification: "insufficient_identity", value: null });
  });
  it("resolves unique phone identity and rejects duplicate Contacts or conflicting phone/email", () => {
    const c = fixtureContext();
    expect(customer(c)).toMatchObject({
      classification: "uniquely_resolved",
      method: "contact_identity",
    });
    c.contacts.push({ ...c.contacts[0]! });
    expect(customer(c).classification).toBe("ambiguous");
    c.contacts.pop();
    c.contacts[0]!.email = "other@example.test";
    c.customers.push({
      id: "other",
      full_name: "Other",
      phone: "09999999999",
      email: "other@example.test",
    });
    expect(customer(c)).toMatchObject({ classification: "ambiguous", value: null });
  });
  it("keeps a new contact as a candidate without creating a customer", () => {
    const c = fixtureContext();
    c.customers = [];
    expect(customer(c)).toMatchObject({ classification: "new_candidate", value: null });
    expect(c.customers).toEqual([]);
  });
});

describe("pure deep validation and decisions", () => {
  it("makes a fully resolved fixture ready and preserves approved delivery", async () => {
    const { run, row } = await dry(fixtureContext());
    expect(row.checks.filter((c) => c.passed !== true)).toEqual([]);
    expect(row.plan.decision).toBe("ready");
    expect(row.bookingIntent?.deliveryType).toBe("in_spa");
    expect(row.plan.delivery.confirmedDelivery).toBe("in_spa");
    expect(row.plan.projections.find((p) => p.module === "schedule")?.kind).toBe(
      "derived_visibility"
    );
    expect(Object.values(run.writes).every((n) => n === 0)).toBe(true);
  });
  it.each([
    "STAFF_SCHEDULE_CONFLICT",
    "SERVICE_CAPABILITY_MISMATCH",
    "DURATION_INCOMPATIBLE",
    "DELIVERY_UNCONFIRMED",
    "BOOKING_DATE_REQUIRES_REVIEW",
    "SERVICE_INELIGIBLE",
    "BRANCH_INVALID",
  ])("requires attention for %s", async (code) => {
    const c = fixtureContext();
    let row = serviceRow();
    if (code === "STAFF_SCHEDULE_CONFLICT") c.schedules = [];
    if (code === "SERVICE_CAPABILITY_MISMATCH") c.capabilities = [];
    if (code === "DURATION_INCOMPATIBLE") row = serviceRow({ 4: "2" });
    if (code === "DELIVERY_UNCONFIRMED") c.deliveryPolicy = null;
    if (code === "BOOKING_DATE_REQUIRES_REVIEW") c.rules!.max_advance_booking_days = -1;
    if (code === "SERVICE_INELIGIBLE") c.branchServices[0]!.is_active = false;
    if (code === "BRANCH_INVALID") c.branch!.is_active = false;
    const result = await dry(c, row);
    expect(result.row.plan.decision).toBe("needs_attention");
    expect(
      result.row.attention.some(
        (a) => a.code === code && a.afterCorrection === "revalidate_before_apply"
      )
    ).toBe(true);
    expect(result.row.resolution.staff.value?.id).toBe("staff");
  });
  it("respects day-off overrides without substituting a free staff member", async () => {
    const c = fixtureContext();
    c.staff.push({ ...c.staff[0]!, id: "free", nickname: "Free" });
    c.overrides.push({
      staff_id: "staff",
      override_date: "2026-09-18",
      is_day_off: true,
      start_time: null,
      end_time: null,
    });
    const { row } = await dry(c);
    expect(row.resolution.staff.value?.id).toBe("staff");
    expect(row.attention.some((a) => a.code === "STAFF_SCHEDULE_CONFLICT")).toBe(true);
  });
  it.each([
    ["confirmed", null, true],
    ["cancelled", null, false],
    ["pending", "2026-09-17T00:00:00Z", true],
    ["pending_payment", "2026-09-17T00:00:00Z", false],
    ["pending_crm_confirmation", "2026-09-19T00:00:00Z", true],
  ] as const)(
    "uses canonical overlap semantics for %s / %s",
    async (status, hold_expires_at, conflict) => {
      const c = fixtureContext();
      c.bookings = [
        {
          id: "booking",
          staff_id: "staff",
          booking_date: "2026-09-18",
          start_time: "10:30",
          end_time: "11:30",
          status,
          hold_expires_at,
        },
      ];
      const { row } = await dry(c);
      expect(row.attention.some((a) => a.code === "CANONICAL_BOOKING_OVERLAP")).toBe(conflict);
      expect(row.resolution.staff.value?.id).toBe("staff");
    }
  );
  it("does not infer Home Service from location and fuel", async () => {
    const { row } = await dry(fixtureContext(), serviceRow({ 0: "Fixture destination", 7: 100 }));
    expect(row.plan.decision).toBe("needs_attention");
    expect(row.bookingIntent?.deliveryType).toBeNull();
    expect(row.plan.projections.find((p) => p.module === "home_service")?.kind).toBe(
      "pending_confirmation"
    );
  });
  it("detects two different staff labels resolving to the same overlapping provider", async () => {
    const c = fixtureContext();
    const run = await buildSheetIngestionDryRun({
      spreadsheetId: "fixture",
      sheetName: "fixture",
      rawValues: [
        header,
        ["September 18, 2026"],
        serviceRow(),
        serviceRow({ 1: "10:30 AM", 2: "Nicole Fixture" }),
      ],
      merges: [],
      context: c,
      now: new Date("2026-09-18T00:00:00Z"),
    });
    const services = run.rows.filter((r) => r.plan.intent === "service");
    expect(
      services.every(
        (r) => r.plan.decision === "needs_attention" && r.resolution.staff.value?.id === "staff"
      )
    ).toBe(true);
    expect(
      run.conflicts.some(
        (c) => c.type === "provider_overlap" && c.evidence.identityNotYetResolved === false
      )
    ).toBe(true);
  });
  it("logs only safe aggregates and represents unavailable canonical conflicts as null", async () => {
    const { run } = await dry(unavailableSheetContext("test"));
    const summary = summarizeSheetDryRun(run);
    expect(summary.conflicts.canonicalBookingOverlaps).toBeNull();
    expect(summary.decisions.ready).toBe(0);
    expect(JSON.stringify(summary)).not.toMatch(/Nikki|Test Customer|09123456789|example\.test/);
  });
});
