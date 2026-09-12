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
describe("Staff document camera permissions", () => {
  it.each(["/staff", "/staff/", "/staff/scan", "/staff/scan/process/att_test", "/staff/driver"])(
    "permits same-origin camera for %s so client navigation to Scan is possible, with no microphone",
    async path => expect(await policy(path)).toBe("camera=(self), microphone=(), geolocation=(self)")
  );
  it.each(["/", "/scan/att_test", "/crm", "/owner", "/staff-portal", "/staffing", "/sw.js"])(
    "retains camera and microphone denial outside Staff: %s",
    async path => expect(await policy(path)).toBe("camera=(), microphone=(), geolocation=(self)")
  );
});
