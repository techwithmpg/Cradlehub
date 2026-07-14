import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const actions = readFileSync(join(process.cwd(), "src/app/scan/actions.ts"), "utf8");
const processor = readFileSync(join(process.cwd(), "src/components/features/attendance/public-scan-processor.tsx"), "utf8");

describe("first attendance scan continuation contract", () => {
  it("uses the original operation id for registration and attendance child operations", () => {
    expect(actions).toContain('appendRequestStep(rootOperationId, "register")');
    expect(actions).toContain('appendRequestStep(rootOperationId, "attendance")');
    expect(processor).toContain("requestId,\n      });");
  });

  it("returns the final attendance result without a cookie-backed reload", () => {
    expect(actions).toContain("result: toPublicResult(attendanceResult)");
    expect(processor).toContain("setResult(actionResult.result)");
    expect(processor).not.toContain("reloadForCookieBackedScan");
  });
});
