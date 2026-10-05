import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ local: vi.fn(), production: vi.fn() }));
vi.mock("@/lib/integrations/google-sheets/sheet-adc-token-provider", () => ({
  createLocalAdcSheetTokenProvider: mocks.local,
}));
vi.mock("@/lib/integrations/google-sheets/sheet-vercel-wif-token-provider", () => ({
  createVercelWifSheetTokenProvider: mocks.production,
}));

import { selectSheetTokenProvider } from "@/lib/integrations/google-sheets/sheet-token-provider-selector";

describe("Sheet credential environment selector", () => {
  it("selects guarded local ADC only for local development", () => {
    const provider = { getAccessToken: vi.fn() };
    mocks.local.mockReturnValue(provider);
    expect(selectSheetTokenProvider({ NODE_ENV: "development" })).toBe(provider);
    expect(mocks.production).not.toHaveBeenCalled();
  });

  it("selects production WIF only in a Vercel production function", () => {
    const provider = { getAccessToken: vi.fn() };
    mocks.production.mockReturnValue(provider);
    expect(
      selectSheetTokenProvider({ NODE_ENV: "production", VERCEL: "1", VERCEL_ENV: "production" })
    ).toBe(provider);
  });

  it.each([
    { NODE_ENV: "production", VERCEL: "1", VERCEL_ENV: "preview" },
    { NODE_ENV: "production", VERCEL: "1" },
    { NODE_ENV: "production", VERCEL_ENV: "production" },
    { NODE_ENV: "development", VERCEL: "1", VERCEL_ENV: "development" },
    { NODE_ENV: "production" },
    {},
  ])("fails closed for preview or ambiguous environment %#", (env) => {
    mocks.local.mockClear();
    mocks.production.mockClear();
    expect(selectSheetTokenProvider(env as NodeJS.ProcessEnv)).toBeNull();
    expect(mocks.local).not.toHaveBeenCalled();
    expect(mocks.production).not.toHaveBeenCalled();
  });
});
