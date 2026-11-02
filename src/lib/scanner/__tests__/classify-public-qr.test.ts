import { beforeEach, describe, expect, it, vi } from "vitest";
import { classifyPublicQr } from "../classify-public-qr";

const fixture = vi.hoisted(() => ({
  rows: new Map<string, { point_type: string; is_active: boolean }>(),
  unavailable: false,
  queried: [] as string[],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      fixture.queried.push(table);
      return {
        select: (columns: string) => {
          fixture.queried.push(columns);
          return {
            eq: (column: string, value: string) => {
              fixture.queried.push(`${column}:${value}`);
              return {
                maybeSingle: async () => {
                  if (fixture.unavailable) throw new Error("classified TEST database unavailable");
                  return { data: fixture.rows.get(value) ?? null, error: null };
                },
              };
            },
          };
        },
      };
    },
  }),
}));

beforeEach(() => {
  fixture.rows.clear();
  fixture.queried = [];
  fixture.unavailable = false;
});

describe("authoritative QR classification", () => {
  it.each([
    ["att_current", "attendance"],
    ["legacy-code", "attendance"],
    ["room_current", "room"],
    ["res_current", "resource"],
    ["legacy-room-code", "room"],
    ["legacy-resource-code", "resource"],
    ["att_misleading", "resource"],
    ["room_misleading", "attendance"],
  ] as const)("reads %s as %s regardless of its text", async (code, type) => {
    fixture.rows.set(code, { point_type: type, is_active: true });
    expect(await classifyPublicQr(code)).toBe(type);
    expect(fixture.queried).toEqual(["qr_points", "point_type, is_active", `public_code:${code}`]);
  });

  it("fails closed for inactive, missing, invalid, and unavailable records", async () => {
    fixture.rows.set("inactive", { point_type: "attendance", is_active: false });
    fixture.rows.set("invalid", { point_type: "unsupported", is_active: true });
    expect(await classifyPublicQr("inactive")).toBeNull();
    expect(await classifyPublicQr("unknown")).toBeNull();
    expect(await classifyPublicQr("invalid")).toBeNull();
    fixture.unavailable = true;
    expect(await classifyPublicQr("inactive")).toBeNull();
    expect(await classifyPublicQr("")).toBeNull();
  });
});
