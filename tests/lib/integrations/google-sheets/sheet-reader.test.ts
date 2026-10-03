import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createGoogleSheetsReader } from "@/lib/integrations/google-sheets/sheet-reader";

const HEADER = ["TIME", "ATTENDANT", "CLIENT", "HRS.", "SERVICE", "PER SERVICE RATE"];
const ROWS = [HEADER, ["OCT 2, 2026"], ["10:00", "ROSE", "CLIENT A", "1", "SWEDISH", "500"]];

describe("server-only Google Sheets reader", () => {
  it("returns a controlled unavailable state when authentication is not configured", async () => {
    const fetcher = vi.fn();
    const reader = createGoogleSheetsReader({ fetcher });
    await expect(reader.readCurrentAndPrevious("2026-10-03")).resolves.toEqual({
      status: "unavailable", reason: "AUTH_NOT_CONFIGURED",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("isolates network failures and never returns provider details", async () => {
    const reader = createGoogleSheetsReader({
      tokenProvider: { getAccessToken: async () => "test-token" },
      fetcher: vi.fn(async () => { throw new Error("private response details"); }) as typeof fetch,
    });
    await expect(reader.readCurrentAndPrevious("2026-10-03")).resolves.toEqual({
      status: "unavailable", reason: "SHEETS_UNAVAILABLE",
    });
  });

  it("exposes only read operations and issues only GET requests", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const payload = url.includes("/values/")
        ? { values: ROWS }
        : { sheets: [
          { properties: { title: "OCT.2-8, 2026" } },
          { properties: { title: "SEPT 25-OCT 1, 2026" } },
        ] };
      expect(init?.method).toBe("GET");
      return new Response(JSON.stringify(payload), { status: 200 });
    });
    const reader = createGoogleSheetsReader({
      tokenProvider: { getAccessToken: async () => "test-token" },
      fetcher: fetcher as typeof fetch,
    });
    expect(Object.keys(reader)).toEqual(["readCurrentAndPrevious"]);
    const result = await reader.readCurrentAndPrevious("2026-10-03");
    expect(result.status).toBe("available");
    expect(fetcher).toHaveBeenCalledTimes(3);
    if (result.status === "available") expect(result.current.visits).toHaveLength(1);
  });

  it("returns tab ambiguity before requesting row values", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ sheets: [] }), { status: 200 }));
    const reader = createGoogleSheetsReader({
      tokenProvider: { getAccessToken: async () => "test-token" },
      fetcher: fetcher as typeof fetch,
    });
    await expect(reader.readCurrentAndPrevious("2026-10-03")).resolves.toMatchObject({
      status: "unavailable", reason: "TAB_AMBIGUITY",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("does not report an empty or malformed tab as a valid empty projection", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => new Response(JSON.stringify(
      String(input).includes("/values/")
        ? { values: [["unrecognized row"]] }
        : { sheets: [
          { properties: { title: "OCT.2-8, 2026" } },
          { properties: { title: "SEPT 25-OCT 1, 2026" } },
        ] },
    ), { status: 200 }));
    const reader = createGoogleSheetsReader({
      tokenProvider: { getAccessToken: async () => "test-token" },
      fetcher: fetcher as typeof fetch,
    });
    await expect(reader.readCurrentAndPrevious("2026-10-03")).resolves.toEqual({
      status: "unavailable", reason: "INVALID_RESPONSE",
    });
  });
});
