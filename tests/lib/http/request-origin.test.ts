import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("getRequestOrigin", () => {
  let getRequestOrigin: typeof import("@/lib/http/request-origin").getRequestOrigin;

  beforeAll(async () => {
    ({ getRequestOrigin } = await import("@/lib/http/request-origin"));
  });

  function headers(values: Record<string, string>): Pick<Headers, "get"> {
    return {
      get(name: string) {
        return values[name.toLowerCase()] ?? null;
      },
    };
  }

  it("uses forwarded host and protocol when present", () => {
    expect(
      getRequestOrigin(
        headers({
          "x-forwarded-host": "www.cradlewellnessliving.com",
          "x-forwarded-proto": "https",
          host: "internal.vercel.app",
        })
      )
    ).toBe("https://www.cradlewellnessliving.com");
  });

  it("falls back to host with https for public hosts", () => {
    expect(getRequestOrigin(headers({ host: "cradlewellnessliving.com" }))).toBe(
      "https://cradlewellnessliving.com"
    );
  });

  it("uses http for local development hosts", () => {
    expect(getRequestOrigin(headers({ host: "localhost:3000" }))).toBe("http://localhost:3000");
    expect(getRequestOrigin(headers({ host: "127.0.0.1:3000" }))).toBe("http://127.0.0.1:3000");
  });

  it("returns null when no host is available", () => {
    expect(getRequestOrigin(headers({}))).toBeNull();
  });
});
