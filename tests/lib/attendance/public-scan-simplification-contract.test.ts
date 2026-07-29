import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const route = readFileSync("src/app/api/attendance/public-scan/route.ts", "utf8");
const actions = readFileSync("src/app/scan/actions.ts", "utf8");
const result = readFileSync("src/components/features/attendance/public-scan-result.tsx", "utf8");
const login = readFileSync("src/components/features/attendance/public-scan-login-form.tsx", "utf8");
const processor = readFileSync(
  "src/components/features/attendance/public-scan-processor.tsx",
  "utf8"
);

describe("public Attendance scan simplification contract", () => {
  it("does not expose the internal diagnostic resolution object", () => {
    const routePublicResult = route.slice(
      route.indexOf("function toPublicResult"),
      route.indexOf("async function readBody")
    );
    const actionPublicResult = actions.slice(
      actions.indexOf("function toPublicResult"),
      actions.indexOf("function validateBranchCorrectionDetails")
    );

    expect(routePublicResult).not.toContain("resolution:");
    expect(actionPublicResult).not.toContain("resolution:");
  });

  it("keeps technical detail behind an optional help disclosure", () => {
    expect(result).toContain("<details");
    expect(result).toContain("Help details");
    expect(result).not.toContain("Who handles it:");
    expect(result).not.toContain("Prevent this next time");
    expect(login).toContain("Connect this phone");
    expect(login).toContain("Need help?");
  });

  it("does not force a long artificial scan delay", () => {
    expect(processor).toContain("const MINIMUM_FLOW_DURATION_MS = 450;");
  });
});
