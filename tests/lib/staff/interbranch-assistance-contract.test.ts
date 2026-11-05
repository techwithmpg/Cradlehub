import { describe, expect, it } from "vitest";
import {
  assistanceWindowsOverlap,
  canAdvanceAssistanceStatus,
  canApproveAssistance,
  evaluateAssistanceCandidate,
  isAssistanceEffectiveForBooking,
  validAssistanceWindow,
  type AssistanceCandidate,
  type AssistanceRequest,
} from "@/lib/staff/interbranch-assistance-contract";

const request: AssistanceRequest = {
  id: "request-1",
  requestingBranchId: "main",
  lendingBranchId: "sm",
  role: "therapist",
  count: 1,
  window: {
    startAt: "2026-11-05T15:00:00+08:00",
    endAt: "2026-11-05T20:00:00+08:00",
  },
  visitType: "in_spa",
  status: "requested",
};

const candidate: AssistanceCandidate = {
  id: "staff-1",
  homeBranchId: "sm",
  isActive: true,
  role: "therapist",
  qualifiedForRequestedServices: true,
  scheduledWindow: {
    startAt: "2026-11-05T10:00:00+08:00",
    endAt: "2026-11-05T22:30:00+08:00",
  },
  blockingWindows: [],
  committedAssistanceWindows: [],
  lendingBranchCanRelease: true,
};

describe("interbranch assistance foundation", () => {
  it("requires absolute time windows and considers touching edges nonconflicting", () => {
    expect(validAssistanceWindow({ startAt: "2026-11-05T15:00:00", endAt: request.window.endAt })).toBe(false);
    expect(assistanceWindowsOverlap(request.window, {
      startAt: "2026-11-05T20:00:00+08:00", endAt: "2026-11-05T21:00:00+08:00",
    })).toBe(false);
    expect(assistanceWindowsOverlap(request.window, {
      startAt: "2026-11-05T19:50:00+08:00", endAt: "2026-11-05T20:10:00+08:00",
    })).toBe(true);
  });

  it("permits only lending-branch CSR to approve; manager and owner have no workflow bypass", () => {
    expect(canApproveAssistance({ role: "crm", branchId: "sm" }, request)).toBe(true);
    expect(canApproveAssistance({ role: "crm", branchId: "main" }, request)).toBe(false);
    expect(canApproveAssistance({ role: "manager", branchId: "sm" }, request)).toBe(false);
    expect(canApproveAssistance({ role: "owner", branchId: "sm" }, request)).toBe(false);
    expect(canApproveAssistance({ role: "crm", branchId: null }, request)).toBe(false);
  });

  it("does not skip the travelling and arrival stages", () => {
    expect(canAdvanceAssistanceStatus("requested", "active")).toBe(false);
    expect(canAdvanceAssistanceStatus("requested", "approved_pending_arrival")).toBe(true);
    expect(canAdvanceAssistanceStatus("approved_pending_arrival", "travelling")).toBe(true);
    expect(canAdvanceAssistanceStatus("travelling", "active")).toBe(true);
    expect(canAdvanceAssistanceStatus("active", "completed")).toBe(true);
    expect(canAdvanceAssistanceStatus("completed", "active")).toBe(false);
  });

  it("accepts a candidate only when all booking and branch checks pass", () => {
    expect(evaluateAssistanceCandidate(request, candidate, {
      destinationSupportsHomeService: true,
    })).toEqual([]);
  });

  it("rejects busy, double-committed, or unscheduled therapists even when home branch approves", () => {
    const conflicts = evaluateAssistanceCandidate(request, {
      ...candidate,
      scheduledWindow: { startAt: "2026-11-05T16:00:00+08:00", endAt: "2026-11-05T22:00:00+08:00" },
      blockingWindows: [{ startAt: "2026-11-05T18:00:00+08:00", endAt: "2026-11-05T19:00:00+08:00" }],
      committedAssistanceWindows: [request.window],
      lendingBranchCanRelease: false,
    }, { destinationSupportsHomeService: true });
    expect(conflicts).toContain("outside_scheduled_shift");
    expect(conflicts).toContain("booking_conflict");
    expect(conflicts).toContain("assistance_conflict");
    expect(conflicts).toContain("home_branch_coverage_risk");
  });

  it("never enables home service for the SM destination", () => {
    expect(evaluateAssistanceCandidate(
      { ...request, requestingBranchId: "sm", lendingBranchId: "main", visitType: "home_service" },
      { ...candidate, homeBranchId: "main" },
      { destinationSupportsHomeService: false },
    )).toContain("unavailable_destination");
  });

  it("approval by itself cannot expose visiting staff to booking", () => {
    const input = {
      status: "approved_pending_arrival" as const,
      arrivedAt: null,
      window: request.window,
      bookingWindow: {
        startAt: "2026-11-05T16:00:00+08:00",
        endAt: "2026-11-05T17:00:00+08:00",
      },
      requestedBranchId: "main",
      bookingBranchId: "main",
      destinationSupportsHomeService: true,
      visitType: "in_spa" as const,
      serverValidated: false,
    };
    expect(isAssistanceEffectiveForBooking(input)).toBe(false);
    expect(isAssistanceEffectiveForBooking({
      ...input, status: "active", arrivedAt: "2026-11-05T15:10:00+08:00",
    })).toBe(false);
    expect(isAssistanceEffectiveForBooking({
      ...input, status: "active", arrivedAt: "2026-11-05T15:10:00+08:00", serverValidated: true,
    })).toBe(true);
  });

  it("will not book before arrival, past assignment end, or into a different branch", () => {
    const input = {
      status: "active" as const,
      arrivedAt: "2026-11-05T15:30:00+08:00",
      window: request.window,
      bookingWindow: {
        startAt: "2026-11-05T15:00:00+08:00",
        endAt: "2026-11-05T16:00:00+08:00",
      },
      requestedBranchId: "main",
      bookingBranchId: "main",
      destinationSupportsHomeService: true,
      visitType: "in_spa" as const,
      serverValidated: true,
    };
    expect(isAssistanceEffectiveForBooking(input)).toBe(false);
    expect(isAssistanceEffectiveForBooking({
      ...input, bookingWindow: {
        startAt: "2026-11-05T19:00:00+08:00",
        endAt: "2026-11-05T20:30:00+08:00",
      },
    })).toBe(false);
    expect(isAssistanceEffectiveForBooking({
      ...input, bookingBranchId: "sm", bookingWindow: {
        startAt: "2026-11-05T16:00:00+08:00",
        endAt: "2026-11-05T17:00:00+08:00",
      },
    })).toBe(false);
  });
});
