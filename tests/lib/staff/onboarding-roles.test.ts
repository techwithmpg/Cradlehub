import { describe, expect, it } from "vitest";

import {
  ONBOARDING_ROLE_OPTIONS,
  getOnboardingRoleLabel,
  getRequestedSystemRoleForOnboardingRole,
  mapPreferredRoleToStaffType,
} from "@/lib/staff/onboarding-roles";

describe("staff onboarding roles", () => {
  it("offers a Social Media / Marketing role for SM staff applicants", () => {
    expect(ONBOARDING_ROLE_OPTIONS).toContainEqual(
      expect.objectContaining({
        value: "digital_marketer",
        label: "Social Media / Marketing",
      })
    );
  });

  it("maps SM role aliases to the digital marketer approval role", () => {
    expect(getOnboardingRoleLabel("sm_staff")).toBe("Social Media / Marketing");
    expect(mapPreferredRoleToStaffType("sm_staff")).toBe("managerial");
    expect(getRequestedSystemRoleForOnboardingRole("sm_staff")).toBe("digital_marketer");
  });

  it("keeps operational onboarding roles mapped to their approval roles", () => {
    expect(getRequestedSystemRoleForOnboardingRole("therapist")).toBe("staff");
    expect(getRequestedSystemRoleForOnboardingRole("csr")).toBe("crm");
    expect(getRequestedSystemRoleForOnboardingRole("driver")).toBe("driver");
    expect(getRequestedSystemRoleForOnboardingRole("utility")).toBe("utility");
    expect(getRequestedSystemRoleForOnboardingRole("managerial")).toBe("manager");
  });
});
