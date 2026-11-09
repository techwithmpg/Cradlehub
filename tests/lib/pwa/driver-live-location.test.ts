import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({
  job: vi.fn(),
  insert: vi.fn(),
  last: vi.fn(),
}));
vi.mock("@/app/(dashboard)/staff-portal/actions", () => ({
  getMyDriverJobByIdAction: state.job,
}));
vi.mock("@/lib/actions/location-actions", () => ({
  recordStaffLocationSnapshotAction: state.insert,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => {
      const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn(), maybeSingle: state.last };
      query.select.mockReturnValue(query);
      query.eq.mockReturnValue(query);
      query.order.mockReturnValue(query);
      query.limit.mockReturnValue(query);
      return query;
    },
  }),
}));

import { recordAssignedDriverLiveLocationAction } from "@/app/(dashboard)/staff/driver/map/live-location-action";

const bookingId = "11111111-1111-4111-8111-111111111111";
function assigned(status = "travel_started") {
  return {
    staff: { id: "driver-1", branch_id: "branch-1" },
    job: {
      id: bookingId,
      driverId: "driver-1",
      bookingStatus: "confirmed",
      bookingProgressStatus: status,
    },
  };
}
const sample = { bookingId, lat: 10.68, lng: 122.96, accuracyMeters: 20 };

beforeEach(() => {
  vi.clearAllMocks();
  state.job.mockResolvedValue(assigned());
  state.last.mockResolvedValue({ data: null, error: null });
  state.insert.mockResolvedValue({ ok: true, message: "Location updated" });
});

describe("driver live GPS must remain assigned and in-route", () => {
  it("does not write GPS before Start travel", async () => {
    state.job.mockResolvedValue(assigned("not_started"));
    expect((await recordAssignedDriverLiveLocationAction(sample)).ok).toBe(false);
    expect(state.insert).not.toHaveBeenCalled();
  });
  it("does not write after arrival", async () => {
    state.job.mockResolvedValue(assigned("arrived"));
    expect((await recordAssignedDriverLiveLocationAction(sample)).ok).toBe(false);
    expect(state.insert).not.toHaveBeenCalled();
  });
  it("does not write for unassigned, forbidden or reassigned booking", async () => {
    state.job.mockResolvedValueOnce({ error: "Job not found" });
    expect((await recordAssignedDriverLiveLocationAction(sample)).ok).toBe(false);
    state.job.mockResolvedValueOnce({
      staff: { id: "driver-1", branch_id: "branch-1" },
      job: { ...assigned().job, driverId: "other-driver" },
    });
    expect((await recordAssignedDriverLiveLocationAction(sample)).ok).toBe(false);
    expect(state.insert).not.toHaveBeenCalled();
  });
  it("rejects inaccurate or invalid GPS without DB reads", async () => {
    expect((await recordAssignedDriverLiveLocationAction({ ...sample, accuracyMeters: 320 })).ok).toBe(false);
    expect((await recordAssignedDriverLiveLocationAction({ ...sample, lat: 160 })).ok).toBe(false);
    expect(state.job).not.toHaveBeenCalled();
    expect(state.insert).not.toHaveBeenCalled();
  });
  it("skips database writes during the 20-second server throttle", async () => {
    state.last.mockResolvedValue({ data: { recorded_at: new Date().toISOString() }, error: null });
    expect(await recordAssignedDriverLiveLocationAction(sample)).toEqual({ ok: true, recorded: false });
    expect(state.insert).not.toHaveBeenCalled();
  });
  it("writes own authenticated in-route snapshot via existing action", async () => {
    const result = await recordAssignedDriverLiveLocationAction(sample);
    expect(result).toEqual({ ok: true, recorded: true });
    expect(state.insert).toHaveBeenCalledExactlyOnceWith({
      ...sample, source: "gps",
    });
  });
  it("fails closed if the throttle read cannot verify its scope", async () => {
    state.last.mockResolvedValue({ data: null, error: { message: "RLS denied" } });
    expect((await recordAssignedDriverLiveLocationAction(sample)).ok).toBe(false);
    expect(state.insert).not.toHaveBeenCalled();
  });
});
