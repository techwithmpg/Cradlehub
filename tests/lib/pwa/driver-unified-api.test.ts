import { beforeEach, afterEach, it, expect, vi, describe } from "vitest";
import { NextRequest } from "next/server";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  rpc: vi.fn(),
  user: { id: "test-auth" } as { id: string } | null,
  staff: {
    id: "test-driver",
    branch_id: "test-branch",
    system_role: "driver",
    staff_type: "driver",
    is_active: true,
  } as Record<string, unknown> | null,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: m.user }, error: null }) },
    from: () => {
      const c = {
        select: () => c,
        eq: () => c,
        maybeSingle: async () => ({ data: m.staff, error: null }),
      };
      return c;
    },
    rpc: m.rpc,
  }),
}));
vi.mock("@/lib/driver/native-push", () => ({ nativeDriverPushReady: () => true }));
import { POST as registerDevice } from "@/app/api/staff/driver/native-device/route";
import { legacyDriverRouteAllowed } from "@/lib/driver/server";
import { GET, POST } from "@/app/api/staff/driver/journeys/route";
const id = "11111111-1111-4111-8111-111111111111",
  requestId = "22222222-2222-4222-8222-222222222222";
const snapshot = {
  bookingId: id,
  revision: 1,
  stage: "pickup_enroute",
  leg: "pickup",
  destination: { lat: 10, lng: 120, label: "Test branch" },
  observedAt: "2026-11-17T00:00:00Z",
};
const event = () => ({ bookingId: id, requestId, expectedRevision: 0, action: "start" });
const post = (body: unknown, origin = "https://driver.test") =>
  new NextRequest("https://driver.test/api/staff/driver/journeys", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.stubEnv("CRADLEHUB_DRIVER_JOURNEYS_ENABLED", "true");
  m.user = { id: "test-auth" };
  m.staff = {
    id: "test-driver",
    branch_id: "test-branch",
    system_role: "driver",
    staff_type: "driver",
    is_active: true,
  };
  m.rpc.mockReset();
});
afterEach(() => vi.unstubAllEnvs());
describe("authenticated native journey boundary", () => {
  it("does not query uninstalled contracts when inactive", async () => {
    vi.stubEnv("CRADLEHUB_DRIVER_JOURNEYS_ENABLED", "false");
    expect(
      (await GET(new NextRequest("https://driver.test/api/staff/driver/journeys"))).status
    ).toBe(503);
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it("rejects expired sessions", async () => {
    m.user = null;
    expect((await POST(post(event()))).status).toBe(401);
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it("rejects non-driver actors", async () => {
    m.staff = { ...m.staff, system_role: "owner", staff_type: "managerial" };
    expect((await POST(post(event()))).status).toBe(403);
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it("rejects a cross-origin mutation", async () => {
    expect((await POST(post(event(), "https://other.test"))).status).toBe(403);
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it("never accepts caller-supplied staff or branch identity", async () => {
    expect((await POST(post({ ...event(), staffId: "other" }))).status).toBe(400);
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it("requires a point for GPS arrival", async () => {
    expect((await POST(post({ ...event(), action: "gps_arrival" }))).status).toBe(400);
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it("passes an identity-bound request to the canonical transaction", async () => {
    m.rpc.mockResolvedValue({ data: snapshot, error: null });
    const r = await POST(post(event()));
    expect(r.status).toBe(200);
    expect(m.rpc).toHaveBeenCalledExactlyOnceWith("driver_unified_event", { p_event: event() });
  });
  it("does not return a successful empty list after RPC failure", async () => {
    m.rpc.mockResolvedValue({ data: null, error: { message: "offline" } });
    expect(
      (await GET(new NextRequest("https://driver.test/api/staff/driver/journeys"))).status
    ).toBe(503);
  });
  it("rejects corrupt snapshots", async () => {
    m.rpc.mockResolvedValue({ data: [{ ...snapshot, revision: -1 }], error: null });
    expect(
      (await GET(new NextRequest("https://driver.test/api/staff/driver/journeys"))).status
    ).toBe(503);
  });
  it("keeps stale/revoked updates distinct from a confirmed update", async () => {
    m.rpc.mockResolvedValue({ error: { message: "stale_revision" }, data: null });
    expect((await POST(post(event()))).status).toBe(409);
  });
});

it("keeps enrolled transports out of legacy navigation", async () => {
  m.rpc.mockResolvedValue({ data: false, error: null });
  expect(await legacyDriverRouteAllowed(id)).toBe(false);
  expect(m.rpc).toHaveBeenCalledWith("driver_unified_legacy_allowed", { p_booking_id: id });
});
it("does not grant legacy fallback when authority cannot be read", async () => {
  m.rpc.mockResolvedValue({ data: null, error: { message: "offline" } });
  await expect(legacyDriverRouteAllowed(id)).rejects.toThrow(
    "Journey status could not be verified"
  );
});
it("registers devices under server identity without accepting a staff ID", async () => {
  const request = new NextRequest("https://driver.test/api/staff/driver/native-device", {
    method: "POST",
    headers: { origin: "https://driver.test", "content-type": "application/json" },
    body: JSON.stringify({
      installationId: id,
      enabled: true,
      token: "TEST_".repeat(20),
      staffId: requestId,
    }),
  });
  expect((await registerDevice(request)).status).toBe(400);
  expect(m.rpc).not.toHaveBeenCalled();
});
it("revokes an installation without requiring a token", async () => {
  m.rpc.mockResolvedValue({ data: true, error: null });
  const request = new NextRequest("https://driver.test/api/staff/driver/native-device", {
    method: "POST",
    headers: { origin: "https://driver.test", "content-type": "application/json" },
    body: JSON.stringify({ installationId: id, enabled: false }),
  });
  const response = await registerDevice(request);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ channel: "revoked" });
});
