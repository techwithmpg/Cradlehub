import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mock = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mock.createClient }));
import { loadSheetContext } from "@/lib/integrations/google-sheets/sheet-context";

const needs = {
  dates: ["2026-09-18"],
  staffLabels: ["fixture"],
  serviceLabels: ["service"],
  customerLabels: ["customer"],
};
function readClient(
  options: { authenticated?: boolean; role?: string; fail?: boolean; paged?: boolean } = {}
) {
  const requests: { table: string; filters: unknown[][]; from: number; to: number }[] = [];
  const from = vi.fn((table: string) => {
    const filters: unknown[][] = [];
    const builder = {
      select: () => builder,
      order: () => builder,
      eq: (...args: unknown[]) => {
        filters.push(["eq", ...args]);
        return builder;
      },
      gte: (...args: unknown[]) => {
        filters.push(["gte", ...args]);
        return builder;
      },
      lte: (...args: unknown[]) => {
        filters.push(["lte", ...args]);
        return builder;
      },
      not: (...args: unknown[]) => {
        filters.push(["not", ...args]);
        return builder;
      },
      in: (...args: unknown[]) => {
        filters.push(["in", ...args]);
        return builder;
      },
      maybeSingle: async () => ({
        data: { id: "actor", branch_id: "authorized-branch", system_role: options.role ?? "crm" },
        error: null,
      }),
      range: async (a: number, b: number) => {
        requests.push({ table, filters, from: a, to: b });
        if (options.fail) return { data: null, error: { message: "private diagnostic" } };
        if (table === "branches")
          return { data: [{ id: "authorized-branch", is_active: true }], error: null };
        if (table === "staff" && options.paged && a === 0)
          return {
            data: Array.from({ length: 500 }, (_, i) => ({ id: `staff-${i}` })),
            error: null,
          };
        return { data: [], error: null };
      },
    };
    return builder;
  });
  return {
    requests,
    client: {
      from,
      auth: {
        getUser: async () => ({
          data: { user: options.authenticated === false ? null : { id: "auth" } },
          error: null,
        }),
      },
    },
  };
}
beforeEach(() => mock.createClient.mockReset());
describe("authenticated batched context adapter", () => {
  it("rejects unknown target before creating a client", async () => {
    await expect(loadSheetContext(needs, "UNKNOWN" as "TEST")).rejects.toThrow(
      "identified database target"
    );
    expect(mock.createClient).not.toHaveBeenCalled();
  });
  it.each([{ authenticated: false }, { role: "staff" }])(
    "rejects unauthorized context: %j",
    async (options) => {
      const { client, requests } = readClient(options);
      mock.createClient.mockResolvedValue(client);
      await expect(loadSheetContext(needs, "TEST")).rejects.toThrow(/access is required/);
      expect(requests).toHaveLength(0);
    }
  );
  it("scopes batched reads to the authenticated branch; query count does not grow per source row", async () => {
    const first = readClient();
    mock.createClient.mockResolvedValue(first.client);
    const result = await loadSheetContext(needs, "TEST");
    expect(result.branch?.id).toBe("authorized-branch");
    expect(first.requests).toHaveLength(6);
    expect(
      first.requests.every((r) =>
        r.filters.some((f) => f[0] === "eq" && f[2] === "authorized-branch")
      )
    ).toBe(true);
    const second = readClient();
    mock.createClient.mockResolvedValue(second.client);
    await loadSheetContext({ ...needs, staffLabels: Array(1000).fill("fixture") }, "TEST");
    expect(second.requests).toHaveLength(first.requests.length);
    // Mock has no insert/update/delete/RPC methods: a mutation cannot succeed unnoticed.
  });
  it("paginates context and chunks dependent staff collections", async () => {
    const { client, requests } = readClient({ paged: true });
    mock.createClient.mockResolvedValue(client);
    const result = await loadSheetContext(needs, "TEST");
    expect(result.staff).toHaveLength(500);
    expect(requests.filter((r) => r.table === "staff").map((r) => r.from)).toEqual([0, 500]);
    expect(requests.filter((r) => r.table === "staff_services")).toHaveLength(3);
  });
  it("fails closed on a read error without leaking diagnostics or returning partial context", async () => {
    const { client } = readClient({ fail: true });
    mock.createClient.mockResolvedValue(client);
    await expect(loadSheetContext(needs, "TEST")).rejects.toThrow(
      "Canonical read context is unavailable"
    );
  });
});
