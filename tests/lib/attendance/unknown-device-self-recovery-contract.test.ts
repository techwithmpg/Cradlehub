import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const engine = readFileSync("src/lib/attendance/scan-engine.ts", "utf8");

describe("unknown device self-recovery contract", () => {
  it("records the scan but does not create one CRM incident per retry", () => {
    const start = engine.indexOf("if (!device) {");
    const end = engine.indexOf("const deviceStaff = first(device.staff);", start);
    const block = engine.slice(start, end);

    expect(block).toContain('reasonCode: "unknown_device"');
    expect(block).not.toContain("recordException(admin");
    expect(block).not.toContain("unknown-device:${eventId}");
  });
});
