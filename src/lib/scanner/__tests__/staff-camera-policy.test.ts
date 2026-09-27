import { describe, expect, it } from "vitest";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import config from "../../../../next.config";

async function policy(path: string) {
  let result: string | undefined;
  for (const rule of await config.headers!()) {
    if (!getPathMatch(rule.source)(path)) continue;
    for (const header of rule.headers) {
      if (header.key === "Permissions-Policy") result = header.value;
    }
  }
  return result;
}
describe("Staff scanner camera permissions policy", () => {
  it.each([
    "/staff/scan",
    "/staff/scan/",
    "/staff/scan/process/att_test",
    "/staff/scan/activate/act_test",
  ])(
    "permits same-origin camera only for scanner route: %s",
    async (path) =>
      expect(await policy(path)).toBe("camera=(self), microphone=(), geolocation=(self)")
  );

  it.each([
    "/",
    "/staff",
    "/staff/",
    "/staff/schedule",
    "/staff/progress",
    "/staff/more",
    "/staff/driver",
    "/staff/utility",
    "/crm",
    "/owner",
    "/staff-portal",
    "/staffing",
    "/scan/att_test",
    "/sw.js",
  ])(
    "retains camera denial for non-scanner route: %s",
    async (path) =>
      expect(await policy(path)).toBe("camera=(), microphone=(), geolocation=(self)")
  );
});
