import { describe, expect, it } from "vitest";
import {
  assistanceSubmitSchema, assistanceDecisionSchema,
  canSubmitAssistance, canReviewAssistance, canCancelAssistance,
} from "@/lib/staff/interbranch-assistance-request-policy";

const main = "c1000000-0000-0000-0000-000000000001";
const sm = "c1000000-0000-0000-0000-000000000002";
const valid = {
  requestingBranchId: main, lendingBranchId: sm,
  role: "therapist", count: 2, visitType: "in_spa",
  startAt: "2026-11-05T15:00:00+08:00",
  endAt: "2026-11-05T22:00:00+08:00", notes: "",
};

describe("Staff Assistance Stage B safety policy", () => {
  it("accepts a branch-scoped bounded request", () => {
    expect(assistanceSubmitSchema.safeParse(valid).success).toBe(true);
  });
  it("accepts existing PostgreSQL branch GUIDs but rejects malformed identifiers", () => {
    expect(assistanceSubmitSchema.safeParse({ ...valid, requestingBranchId: main, lendingBranchId: sm }).success).toBe(true);
    expect(assistanceSubmitSchema.safeParse({ ...valid, requestingBranchId: "not-a-guid" }).success).toBe(false);
    expect(assistanceSubmitSchema.safeParse({ ...valid, lendingBranchId: "c1000000-0000-0000-0000-00000000000x" }).success).toBe(false);
  });
  it("rejects a request to the same branch or an impossible timeframe", () => {
    expect(assistanceSubmitSchema.safeParse({ ...valid, lendingBranchId: main }).success).toBe(false);
    expect(assistanceSubmitSchema.safeParse({ ...valid, endAt: "2026-11-05T14:00:00+08:00" }).success).toBe(false);
    expect(assistanceSubmitSchema.safeParse({ ...valid, endAt: "2026-11-07T22:00:00+08:00" }).success).toBe(false);
    expect(assistanceSubmitSchema.safeParse({ ...valid, endAt: "2026-11-05T20:00:00" }).success).toBe(false);
  });
  it("accepts all three actual spa staff categories and rejects other roles", () => {
    for (const role of ["therapist", "nail_tech", "aesthetician"]) {
      expect(assistanceSubmitSchema.safeParse({ ...valid, role }).success).toBe(true);
    }
    expect(assistanceSubmitSchema.safeParse({ ...valid, role: "driver" }).success).toBe(false);
  });
  it("rejects empty or excessively large requests and free-form notes", () => {
    expect(assistanceSubmitSchema.safeParse({ ...valid, count: 0 }).success).toBe(false);
    expect(assistanceSubmitSchema.safeParse({ ...valid, count: 21 }).success).toBe(false);
    expect(assistanceSubmitSchema.safeParse({ ...valid, notes: "x".repeat(201) }).success).toBe(false);
  });
  it("lets each branch CSR request and approve only incoming requests, never manager or owner", () => {
    expect(canSubmitAssistance("crm")).toBe(true);
    expect(canSubmitAssistance("driver")).toBe(false);
    expect(canSubmitAssistance("manager")).toBe(false);
    expect(canSubmitAssistance("owner")).toBe(false);
    expect(canReviewAssistance({ role: "crm", branchId: sm }, { requestingBranchId: main, lendingBranchId: sm })).toBe(true);
    expect(canReviewAssistance({ role: "crm", branchId: main }, { requestingBranchId: main, lendingBranchId: sm })).toBe(false);
    expect(canReviewAssistance({ role: "crm", branchId: main }, { requestingBranchId: sm, lendingBranchId: main })).toBe(true);
    expect(canReviewAssistance({ role: "manager", branchId: sm }, { requestingBranchId: main, lendingBranchId: sm })).toBe(false);
    expect(canReviewAssistance({ role: "owner", branchId: sm }, { requestingBranchId: main, lendingBranchId: sm })).toBe(false);
    expect(canReviewAssistance({ role: "crm", branchId: null }, { requestingBranchId: main, lendingBranchId: sm })).toBe(false);
    expect(canReviewAssistance({ role: "crm", branchId: sm }, { requestingBranchId: sm, lendingBranchId: sm })).toBe(false);
  });
  it("allows requester cancellation only while pending, not after approval", () => {
    expect(canCancelAssistance({ role: "crm", branchId: main }, { requestingBranchId: main, status: "requested" })).toBe(true);
    expect(canCancelAssistance({ role: "crm", branchId: sm }, { requestingBranchId: main, status: "requested" })).toBe(false);
    expect(canCancelAssistance({ role: "crm", branchId: main }, { requestingBranchId: main, status: "approved_pending_arrival" })).toBe(false);
    expect(canCancelAssistance({ role: "owner", branchId: main }, { requestingBranchId: main, status: "requested" })).toBe(false);
  });
  it("validates CSR decision payloads", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(assistanceDecisionSchema.safeParse({ requestId: id, decision: "approve", staffIds: [id] }).success).toBe(true);
    expect(assistanceDecisionSchema.safeParse({ requestId: id, decision: "revise", staffIds: [] }).success).toBe(false);
  });
});
