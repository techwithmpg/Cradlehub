import { it, expect, vi } from "vitest";
import { readDispatchJourneys } from "@/lib/driver/dispatch";
it("keeps completed-service collection separate from an empty booking queue", async () => {
  const rows = [
    {
      journey: {
        bookingId: "11111111-1111-4111-8111-111111111111",
        revision: 5,
        stage: "collection_pending",
        leg: "collection",
        destination: { lat: 10, lng: 120, label: "Test collection" },
        observedAt: "2026-11-17T00:00:00Z",
      },
      driverName: "Test Driver",
      location: { lat: 10, lng: 120, recordedAt: "2026-11-17T00:00:00Z" },
    },
  ];
  const rpc = vi.fn().mockResolvedValue({ data: rows, error: null });
  expect(await readDispatchJourneys({ rpc } as never, "test-branch")).toEqual(rows);
  expect(rpc).toHaveBeenCalledWith("driver_unified_dispatch", { p_branch_id: "test-branch" });
});
it.each([
  { data: null, error: { message: "offline" } },
  { data: [{}], error: null },
])("never converts unavailable transport authority into an empty queue", async (reply) => {
  await expect(
    readDispatchJourneys({ rpc: vi.fn().mockResolvedValue(reply) } as never, "test")
  ).rejects.toThrow("could not be verified");
});
