import { afterEach, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/logger", () => ({ logError: vi.fn() }));
import { confirmDriverCollectionReady } from "@/lib/driver/collection-ready";
afterEach(() => vi.unstubAllEnvs());
it("leaves existing service completion untouched while journeys are inactive", async () => {
  vi.stubEnv("CRADLEHUB_DRIVER_JOURNEYS_ENABLED", "false");
  const rpc = vi.fn();
  expect(await confirmDriverCollectionReady({ rpc } as never, "test")).toBeUndefined();
  expect(rpc).not.toHaveBeenCalled();
});
it("requires affirmative server readiness acknowledgment", async () => {
  vi.stubEnv("CRADLEHUB_DRIVER_JOURNEYS_ENABLED", "true");
  const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
  expect(await confirmDriverCollectionReady({ rpc } as never, "test")).toBeUndefined();
  expect(rpc).toHaveBeenCalledExactlyOnceWith("driver_unified_collection_ready", {
    p_booking_id: "test",
  });
});
it.each(["error", "transport", "false"])(
  "reports %s without pretending collection readiness succeeded",
  async (mode) => {
    vi.stubEnv("CRADLEHUB_DRIVER_JOURNEYS_ENABLED", "true");
    const rpc =
      mode === "transport"
        ? vi.fn().mockRejectedValue(new Error("offline"))
        : vi
            .fn()
            .mockResolvedValue({
              data: false,
              error: mode === "error" ? { message: "offline" } : null,
            });
    expect(await confirmDriverCollectionReady({ rpc } as never, "test")).toContain(
      "Service completion was recorded"
    );
  }
);
