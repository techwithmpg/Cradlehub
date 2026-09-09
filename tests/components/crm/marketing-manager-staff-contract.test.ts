import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SYSTEM_ROLE_LABELS, getAssignableSystemRoles } from "@/constants/staff";

function source(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");
}

describe("Marketing Manager staff-management contract", () => {
  it("keeps digital_marketer canonical while using Marketing Manager as its UI label", () => {
    expect(SYSTEM_ROLE_LABELS.digital_marketer).toBe("Marketing Manager");

    expect(getAssignableSystemRoles("owner")).toContain("digital_marketer");

    expect(getAssignableSystemRoles("manager")).toContain("digital_marketer");

    expect(getAssignableSystemRoles("assistant_manager")).toContain("digital_marketer");

    expect(getAssignableSystemRoles("store_manager")).toContain("digital_marketer");

    expect(getAssignableSystemRoles("crm")).not.toContain("digital_marketer");
  });

  it("pairs Marketing Manager with managerial in Owner staff management", () => {
    const sourceText = source("src/components/features/staff/staff-edit-form.tsx");

    expect(sourceText).toContain('{ value: "digital_marketer", label: "Marketing Manager" }');

    expect(sourceText).toContain('setSelectedStaffType("managerial")');

    expect(sourceText).toContain("Marketing / Management");

    expect(sourceText).toContain("CRM_ROLE_OPTIONS");
  });

  it("pairs Marketing Manager with managerial in the modern CRM staff editor", () => {
    const modal = source("src/components/features/crm/staff/crm-edit-staff-profile-modal.tsx");

    const workSetup = source(
      "src/components/features/crm/staff/tabs/edit-staff-work-setup-tab.tsx"
    );

    expect(modal).toContain('field === "systemRole" && value === "digital_marketer"');

    expect(modal).toContain('staffType: "managerial"');

    expect(workSetup).toContain('draft.systemRole === "digital_marketer"');

    expect(workSetup).toContain("Marketing / Management");
  });

  it("pairs Marketing Manager with managerial in the manager staff workspace", () => {
    const workspace = source("src/components/features/staff/staff-approval-workspace.tsx");

    expect(workspace).toContain('{ value: "digital_marketer", label: "Marketing Manager" }');

    expect(workspace).toContain('onChange("staffType", "managerial")');

    expect(workspace).toContain("Marketing / Management");
  });

  it("enforces Marketing Manager job-function pairing on server write paths", () => {
    const staffActions = source("src/app/(dashboard)/owner/staff/actions.ts");

    const onboardingActions = source("src/app/staff-onboarding/actions.ts");

    expect(staffActions).toContain('d.systemRole === "digital_marketer"');

    expect(staffActions).toContain('effectiveSystemRole === "digital_marketer"');

    expect(staffActions).toContain("staff_type: nextStaffType");

    expect(onboardingActions).toContain('input.systemRole === "digital_marketer"');
  });
});
