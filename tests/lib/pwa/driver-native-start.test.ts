import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ getJob: vi.fn(), progress: vi.fn() }));
vi.mock("@/app/(dashboard)/staff-portal/actions", () => ({
  getMyDriverJobByIdAction: mocks.getJob,
  updateBookingProgressAction: mocks.progress,
}));
import { POST } from "@/app/api/staff/driver/native-start/route";
const id = "11111111-1111-4111-8111-111111111111";
const assigned = () => ({
  staff: { id: "driver-1", branch_id: "branch-1", system_role: "driver", staff_type: "driver" },
  job: {
    id, driverId: "driver-1", bookingStatus: "confirmed",
    bookingProgressStatus: "not_started", dispatchStatus: "ready",
    lat: 10.68, lng: 122.96, needsLocationReview: false,
  },
});
const request = (body: unknown = { bookingId: id }, origin = "https://www.cradlewellnessliving.com") =>
  new NextRequest("https://www.cradlewellnessliving.com/api/staff/driver/native-start", {
    method: "POST", headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getJob.mockResolvedValue(assigned());
  mocks.progress.mockResolvedValue({ ok: true });
});
describe("native Start preserves driver and booking authority", () => {
  it("rejects foreign origins and invalid IDs", async () => {
    expect((await POST(request({ bookingId: id }, "https://other.example"))).status).toBe(403);
    expect((await POST(request({ bookingId: "bad" }))).status).toBe(400);
    expect(mocks.getJob).not.toHaveBeenCalled();
  });
  it("rejects missing assignment and invalid coordinates", async () => {
    mocks.getJob.mockResolvedValueOnce({ ...assigned(), job: { ...assigned().job, driverId: "other" } });
    expect((await POST(request())).status).toBe(409);
    mocks.getJob.mockResolvedValueOnce({ ...assigned(), job: { ...assigned().job, needsLocationReview: true } });
    expect((await POST(request())).status).toBe(409);
    expect(mocks.progress).not.toHaveBeenCalled();
  });
  it("advances travel once through the existing server action", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(mocks.progress).toHaveBeenCalledExactlyOnceWith({
      bookingId: id, nextStatus: "travel_started",
    });
  });
  it("is idempotent for an already started assigned trip", async () => {
    mocks.getJob.mockResolvedValue({
      ...assigned(), job: { ...assigned().job, bookingProgressStatus: "travel_started", dispatchStatus: "in_route" },
    });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.progress).not.toHaveBeenCalled();
  });
  it("fails closed after a rejected transition", async () => {
    mocks.progress.mockResolvedValue({ ok: false, message: "Reassigned" });
    expect((await POST(request())).status).toBe(409);
  });
});
