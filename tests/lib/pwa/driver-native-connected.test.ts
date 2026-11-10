import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  all: vi.fn(),
  job: vi.fn(),
  progress: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mocks.getUser } })),
}));
vi.mock("@/app/(dashboard)/staff-portal/actions", () => ({
  getMyDriverAllJobsAction: mocks.all,
  getMyDriverJobByIdAction: mocks.job,
  updateBookingProgressAction: mocks.progress,
}));
vi.mock("@/lib/staff-pwa/driver-dispatch-policy", () => ({
  isValidDriverDestination: (job: {
    needsLocationReview: boolean; lat: number | null; lng: number | null;
  }) => !job.needsLocationReview && job.lat !== null && job.lng !== null,
}));
import { GET } from "@/app/api/staff/driver/native-workspace/route";
import { POST } from "@/app/api/staff/driver/native-travel/route";

const origin = "https://www.cradlewellnessliving.com";
const bookingId = "11111111-1111-4111-8111-111111111111";
const staff = {
  id: "driver-a", branch_id: "main", system_role: "driver",
  staff_type: "driver", nickname: "Tester",
};
const baseJob = {
  id: bookingId, driverId: staff.id,
  customerName: "Private Test", serviceName: "Massage",
  bookingDate: "2026-11-10", startTime: "16:00:00",
  dispatchStatus: "awaiting_dispatch", bookingStatus: "confirmed",
  bookingProgressStatus: "not_started", formattedAddress: "Approved address",
  area: "Area", lat: 10.68, lng: 122.96, needsLocationReview: false,
  paymentStatus: "private-payment",
};
const get = () => new NextRequest(origin + "/api/staff/driver/native-workspace");
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(origin + "/api/staff/driver/native-travel", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json", Origin: origin,
      "X-CradleHub-Native": "driver-v1", ...headers,
    },
  });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NATIVE_DRIVER_CONNECTED_ENABLED = "true";
  mocks.getUser.mockResolvedValue({ data: { user: { id: "auth-a" } }, error: null });
  mocks.all.mockResolvedValue({
    today: [baseJob, { ...baseJob, id: "22222222-2222-4222-8222-222222222222",
      driverId: "driver-b", customerName: "Other driver" }],
    recent: [], staff, businessDate: "2026-11-10",
  });
  mocks.job.mockResolvedValue({ job: baseJob, staff });
  mocks.progress.mockResolvedValue({
    ok: true, bookingId, status: "travel_started",
    timestamp: "2026-11-10T08:00:00Z",
  });
});
afterEach(() => {
  delete process.env.NATIVE_DRIVER_CONNECTED_ENABLED;
});

describe("native driver connected staging gate", () => {
  it("fails closed without an explicitly enabled TEST backend", async () => {
    delete process.env.NATIVE_DRIVER_CONNECTED_ENABLED;
    expect((await GET(get())).status).toBe(503);
    expect((await POST(post({ bookingId, operation: "start" }))).status).toBe(503);
    expect(mocks.progress).not.toHaveBeenCalled();
    expect(mocks.all).not.toHaveBeenCalled();
  });

  it("requires authenticated user rather than trusting client staff ID", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await GET(get())).status).toBe(401);
    expect((await POST(post({ bookingId, operation: "start" }))).status).toBe(401);
    expect(mocks.progress).not.toHaveBeenCalled();
  });

  it("returns minimal, driver-assigned workspace without payment or coordinates", async () => {
    const r = await GET(get());
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toContain("no-store");
    const body = await r.json();
    expect(body.name).toBe("Tester");
    expect(body.businessDate).toBe("2026-11-10");
    expect(body.trips).toHaveLength(1);
    expect(body.trips[0]).toMatchObject({ id: bookingId, destinationReady: true });
    expect(JSON.stringify(body)).not.toContain("private-payment");
    expect(JSON.stringify(body)).not.toContain("Other driver");
    expect(JSON.stringify(body)).not.toContain("122.96");
  });

  it("denies non-driver workspace despite an authenticated account", async () => {
    mocks.all.mockResolvedValue({ today: [baseJob], recent: [],
      staff: { ...staff, system_role: "csr_staff", staff_type: "csr" } });
    expect((await GET(get())).status).toBe(403);
  });

  it("enforces native POST origin/custom header before any action", async () => {
    expect((await POST(post({ bookingId, operation: "start" }, {
      Origin: "https://attacker.example",
    }))).status).toBe(403);
    expect((await POST(post({ bookingId, operation: "start" }, {
      "X-CradleHub-Native": "wrong",
    }))).status).toBe(403);
    expect(mocks.job).not.toHaveBeenCalled();
    expect(mocks.progress).not.toHaveBeenCalled();
  });

  it("rejects unsupported mutations and invalid ID", async () => {
    expect((await POST(post({ bookingId, operation: "completed" }))).status).toBe(400);
    expect((await POST(post({ bookingId: "../other", operation: "start" }))).status).toBe(400);
    expect(mocks.progress).not.toHaveBeenCalled();
  });

  it("denies an unassigned booking and an unverified GPS destination", async () => {
    mocks.job.mockResolvedValueOnce({ job: { ...baseJob, driverId: "different" }, staff });
    expect((await POST(post({ bookingId, operation: "start" }))).status).toBe(409);
    mocks.job.mockResolvedValueOnce({ job: { ...baseJob, needsLocationReview: true }, staff });
    expect((await POST(post({ bookingId, operation: "start" }))).status).toBe(422);
    expect(mocks.progress).not.toHaveBeenCalled();
  });

  it("uses the existing atomic progress action to start verified travel", async () => {
    const response = await POST(post({ bookingId, operation: "start" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, bookingId, status: "travel_started" });
    expect(mocks.progress).toHaveBeenCalledExactlyOnceWith({
      bookingId, nextStatus: "travel_started",
    });
  });

  it("does not repeat start on already travelling booking", async () => {
    mocks.job.mockResolvedValue({
      job: { ...baseJob, bookingProgressStatus: "travel_started",
        dispatchStatus: "in_route" }, staff,
    });
    const r = await POST(post({ bookingId, operation: "start" }));
    expect(r.status).toBe(200);
    expect(mocks.progress).not.toHaveBeenCalled();
  });

  it("only permits manual arrival after travel_started", async () => {
    expect((await POST(post({ bookingId, operation: "arrive" }))).status).toBe(409);
    mocks.job.mockResolvedValue({
      job: { ...baseJob, bookingProgressStatus: "travel_started",
        dispatchStatus: "in_route" }, staff,
    });
    mocks.progress.mockResolvedValue({
      ok: true, bookingId, status: "arrived",
      timestamp: "2026-11-10T08:40:00Z",
    });
    const r = await POST(post({ bookingId, operation: "arrive" }));
    expect(r.status).toBe(200);
    expect(mocks.progress).toHaveBeenCalledExactlyOnceWith({
      bookingId, nextStatus: "arrived",
    });
  });

  it("fails closed when the authoritative progress action rejects", async () => {
    mocks.progress.mockResolvedValue({ ok: false,
      code: "PERMISSION_DENIED", message: "Not assigned." });
    expect((await POST(post({ bookingId, operation: "start" }))).status).toBe(403);
  });
  it("never exposes internal database errors in the native response", async () => {
    mocks.progress.mockResolvedValue({ ok: false,
      code: "DATABASE_ERROR", message: "internal-rpc-table-details" });
    const response = await POST(post({ bookingId, operation: "start" }));
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("internal-rpc-table-details");
  });

});
