import { describe, expect, it } from "vitest";
import {
  SERVICE_ADMIN_ROLES,
  canManageServices,
} from "@/lib/auth/crm-permissions";

describe("CRM Permissions — Service Administration Capability Matrix", () => {
  it("authorizes verified service admin roles matching database public.is_service_admin()", () => {
    const authorized = [
      "owner",
      "manager",
      "assistant_manager",
      "store_manager",
      "crm",
      "csr_head",
    ];

    expect(SERVICE_ADMIN_ROLES).toEqual(authorized);

    for (const role of authorized) {
      expect(canManageServices(role)).toBe(true);
    }
  });

  it("strictly excludes subordinate front-desk and non-administrative staff roles", () => {
    const unauthorized = [
      "csr",
      "csr_staff",
      "staff",
      "service_head",
      "service_staff",
      "digital_marketer",
      "driver",
      "utility",
      "unknown_role",
      "",
    ];

    for (const role of unauthorized) {
      expect(canManageServices(role)).toBe(false);
    }
  });
});

