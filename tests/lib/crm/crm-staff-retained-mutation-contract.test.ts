import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sourceFiles = [
  "src/lib/staff/staff-onboarding-service.ts",
  "src/app/(dashboard)/owner/staff/actions.ts",
  "src/lib/actions/crm-staff-services.ts",
  "src/app/(dashboard)/crm/staff/actions.ts",
];

describe("PERF-7 retained CRM Staff mutation contract", () => {
  it("does not directly revalidate /crm/staff from mutation actions that reconcile through the generation store", () => {
    for (const file of sourceFiles) {
      const source = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(source, file).not.toContain('revalidatePath("/crm/staff")');
    }
  });

  it("preserves non-CRM Staff revalidation side effects", () => {
    const onboarding = readFileSync(
      resolve(process.cwd(), "src/lib/staff/staff-onboarding-service.ts"),
      "utf8"
    );
    expect(onboarding).toContain('revalidatePath("/owner/staff")');
    expect(onboarding).toContain('revalidatePath("/manager/staff")');
    expect(onboarding).toContain('revalidatePath("/staff-onboarding")');

    const services = readFileSync(
      resolve(process.cwd(), "src/lib/actions/crm-staff-services.ts"),
      "utf8"
    );
    expect(services).toContain('revalidatePath("/crm/services")');
    expect(services).toContain('revalidatePath("/crm/schedule")');
    expect(services).toContain('revalidatePath("/owner/staff")');
    expect(services).toContain('revalidatePath("/manager/staff")');

    const branchCorrections = readFileSync(
      resolve(process.cwd(), "src/app/(dashboard)/crm/staff/actions.ts"),
      "utf8"
    );
    expect(branchCorrections).toContain('"/owner/staff"');
    expect(branchCorrections).toContain('"/manager/staff"');
    expect(branchCorrections).toContain('"/crm/schedule"');
  });
});
