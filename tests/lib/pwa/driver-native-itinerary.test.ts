import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ getJob: vi.fn() }));
vi.mock("@/app/(dashboard)/staff-portal/actions", () => ({
  getMyDriverJobByIdAction: mocks.getJob,
}));

import { GET } from "@/app/api/staff/driver/native-itinerary/route";

const bookingId = "11111111-1111-4111-8111-111111111111";
const url = (id = bookingId) =>
  new NextRequest(`https://www.cradlewellnessliving.com/api/staff/driver/native-itinerary?bookingId=${id}`);
const assigned = () => ({
  staff: { id: "driver-1", branch_id: "branch-1", system_role: "driver", staff_type: "driver" },
  job: {
    id: bookingId,
    driverId: "driver-1",
    bookingStatus: "confirmed",
    bookingProgressStatus: "travel_started",
    dispatchStatus: "in_route",
    lat: 10.68,
    lng: 122.96,
    needsLocationReview: false,
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getJob.mockResolvedValue(assigned());
});

describe("native itinerary stays behind current driver authority", () => {
  it("rejects invalid trip IDs without calling booking query", async () => {
    const response = await GET(url("not-a-booking"));
    expect(response.status).toBe(400);
    expect(mocks.getJob).not.toHaveBeenCalled();
  });
  it("rejects a booking that the driver cannot read", async () => {
    mocks.getJob.mockResolvedValue({ error: "Not found" });
    expect((await GET(url())).status).toBe(403);
  });
  it("rejects another driver's booking", async () => {
    mocks.getJob.mockResolvedValue({ ...assigned(), job: { ...assigned().job, driverId: "someone-else" } });
    expect((await GET(url())).status).toBe(409);
  });
  it("preloads a confirmed ready trip without starting travel", async () => {
    mocks.getJob.mockResolvedValue({
      ...assigned(), job: { ...assigned().job, bookingProgressStatus: "not_started", dispatchStatus: "ready" }
    });
    const response = await GET(url());
    expect(response.status).toBe(200);
    expect((await response.json()).requiresTravelStart).toBe(true);
  });
  it("rejects invalid status combinations", async () => {
    mocks.getJob.mockResolvedValue({
      ...assigned(), job: { ...assigned().job, bookingProgressStatus: "not_started" }
    });
    expect((await GET(url())).status).toBe(409);
  });
  it("does not leak coordinates for a canceled/arrived booking", async () => {
    for (const job of [
      { ...assigned().job, bookingStatus: "cancelled" },
      { ...assigned().job, bookingProgressStatus: "arrived" },
    ]) {
      mocks.getJob.mockResolvedValue({ ...assigned(), job });
      expect((await GET(url())).status).toBe(409);
    }
  });
  it("rejects unverified and invalid GPS destinations", async () => {
    for (const job of [
      { ...assigned().job, needsLocationReview: true },
      { ...assigned().job, lat: null },
      { ...assigned().job, lat: 950 },
    ]) {
      mocks.getJob.mockResolvedValue({ ...assigned(), job });
      expect((await GET(url())).status).toBe(422);
    }
  });
  it("returns a single server-verified destination without customer identity or payment data", async () => {
    const response = await GET(url());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const body = await response.json();
    expect(body).toEqual({
      ok: true, bookingId, requiresTravelStart: false,
      stops: [{ bookingId, lat: 10.68, lng: 122.96, title: "Home Service destination" }],
    });
    expect(JSON.stringify(body)).not.toContain("customerName");
    expect(mocks.getJob).toHaveBeenCalledExactlyOnceWith(bookingId);
  });
});
