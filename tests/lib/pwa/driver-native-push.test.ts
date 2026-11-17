import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { generateKeyPairSync } from "node:crypto";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: m.rpc }) }));
import {
  processDriverNativePush,
  preferredNativeDriverIds,
  nativeDriverPushReady,
} from "@/lib/driver/native-push";
const key = generateKeyPairSync("rsa", { modulusLength: 2048 })
  .privateKey.export({ type: "pkcs8", format: "pem" })
  .toString();
const id = "11111111-1111-4111-8111-111111111111",
  device = "22222222-2222-4222-8222-222222222222";
beforeEach(() => {
  m.rpc.mockReset();
  vi.stubEnv("CRADLEHUB_DRIVER_JOURNEYS_ENABLED", "true");
  vi.stubEnv("CRADLEHUB_DRIVER_NATIVE_PUSH_ENABLED", "true");
  vi.stubEnv(
    "CRADLEHUB_DRIVER_FCM_SERVICE_ACCOUNT_JSON",
    JSON.stringify({
      project_id: "test-project",
      client_email: "sender@test-project.iam.gserviceaccount.com",
      private_key: key,
    })
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("fails inactive without credentials and never suppresses browser delivery", async () => {
  vi.stubEnv("CRADLEHUB_DRIVER_FCM_SERVICE_ACCOUNT_JSON", "");
  expect(nativeDriverPushReady()).toBe(false);
  expect(await processDriverNativePush()).toEqual({ inactive: true });
  expect(await preferredNativeDriverIds([id])).toEqual(new Set());
  expect(m.rpc).not.toHaveBeenCalled();
});
it("rejects invalid signing material before preferring native delivery", () => {
  vi.stubEnv(
    "CRADLEHUB_DRIVER_FCM_SERVICE_ACCOUNT_JSON",
    JSON.stringify({
      project_id: "test-project",
      client_email: "test@example.test",
      private_key: "x".repeat(100),
    })
  );
  expect(nativeDriverPushReady()).toBe(false);
});
it("keeps in-app notices while selecting the authenticated preferred staff channel", async () => {
  m.rpc.mockResolvedValue({ data: [id], error: null });
  expect(await preferredNativeDriverIds([id])).toEqual(new Set([id]));
  expect(m.rpc).toHaveBeenCalledWith("driver_native_preferred", { p_staff_ids: [id] });
});
it("records provider acceptance with opaque deep-link data only", async () => {
  m.rpc.mockImplementation(async (name) => ({
    error: null,
    data:
      name === "driver_native_claim"
        ? [
            {
              id,
              bookingId: id,
              staffId: id,
              lease: device,
              kind: "collection_ready",
              devices: [{ id: device, token: "TEST_TOKEN", tokenHash: "TEST_HASH" }],
            },
          ]
        : true,
  }));
  const fetcher = vi.fn(
    async (url) =>
      new Response(
        JSON.stringify(
          String(url).includes("oauth2")
            ? { access_token: "TEST_ACCESS_TOKEN", expires_in: 3600 }
            : { name: "TEST_MESSAGE" }
        ),
        { status: 200 }
      )
  );
  vi.stubGlobal("fetch", fetcher);
  expect((await processDriverNativePush()).providerAccepted).toBe(1);
  const sent = fetcher.mock.calls.find(([url]) => String(url).includes("fcm.googleapis"));
  expect(sent).toBeTruthy();
  expect(JSON.stringify(sent)).not.toContain("customerName");
  expect(m.rpc).toHaveBeenCalledWith(
    "driver_native_finish",
    expect.objectContaining({ p_accepted: [device], p_complete: true })
  );
});
it("never labels zero endpoints as delivered", async () => {
  m.rpc.mockImplementation(async (name) => ({
    error: null,
    data:
      name === "driver_native_claim"
        ? [
            {
              id,
              bookingId: id,
              staffId: id,
              lease: device,
              kind: "assignment_changed",
              devices: [],
            },
          ]
        : true,
  }));
  expect((await processDriverNativePush()).providerAccepted).toBe(0);
  expect(m.rpc).toHaveBeenCalledWith(
    "driver_native_finish",
    expect.objectContaining({ p_complete: false, p_error: "no_registered_native_device" })
  );
});

it("defers browser delivery instead of competing when native ownership is unavailable", async () => {
  m.rpc.mockResolvedValue({ data: null, error: { message: "offline" } });
  await expect(preferredNativeDriverIds([id])).rejects.toThrow(
    "driver_push_preference_unavailable"
  );
});
