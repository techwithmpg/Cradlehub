import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DailyScheduleFetchError,
  scheduleFetcher,
} from "@/components/features/schedule/hooks/use-live-daily-schedule";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("scheduleFetcher", () => {
  it("fetches live daily schedule data without browser cache", async () => {
    const payload = {
      branchId: "branch-1",
      branchName: "Main",
      staffRows: [],
      branchResources: [],
      stats: { total: 0, confirmed: 0, in_progress: 0, completed: 0, cancelled: 0, no_show: 0 },
      readiness: null,
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(payload), { status: 200 })
    );

    await expect(scheduleFetcher("/api/crm/schedule?date=2026-07-03")).resolves.toEqual(payload);
    expect(fetchSpy).toHaveBeenCalledWith("/api/crm/schedule?date=2026-07-03", {
      cache: "no-store",
      credentials: "same-origin",
    });
  });

  it("throws a typed friendly error for non-OK responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Schedule unavailable" }), { status: 503 })
    );

    await expect(scheduleFetcher("/api/crm/schedule?date=2026-07-03")).rejects.toMatchObject({
      name: "DailyScheduleFetchError",
      status: 503,
      message: "Schedule unavailable",
    } satisfies Partial<DailyScheduleFetchError>);
  });
});
