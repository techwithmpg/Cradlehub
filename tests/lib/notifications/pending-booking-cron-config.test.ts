import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type CronEntry = { path: string; schedule: string };

function configuredCrons(): CronEntry[] {
  const config = JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf8")) as {
    crons?: CronEntry[];
  };
  return config.crons ?? [];
}

describe("P1 pending CRM confirmation scheduled delivery configuration", () => {
  it("preserves the existing daily follow-up job", () => {
    expect(configuredCrons()).toContainEqual({
      path: "/api/agent/follow-up",
      schedule: "0 0 * * *",
    });
  });

  it("wires the guarded pending-booking endpoint at a five-minute cadence", () => {
    const matching = configuredCrons().filter(
      (entry) => entry.path === "/api/notifications/pending-booking-reminders"
    );
    expect(matching).toEqual([
      {
        path: "/api/notifications/pending-booking-reminders",
        schedule: "*/5 * * * *",
      },
    ]);
  });
});
