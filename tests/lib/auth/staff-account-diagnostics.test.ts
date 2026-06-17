import { describe, expect, it } from "vitest";
import {
  buildStaffAccountDiagnostic,
  type StaffAccountDiagnosticAuthUser,
  type StaffAccountDiagnosticStaff,
} from "@/lib/auth/staff-account-diagnostics";

const baseStaff: StaffAccountDiagnosticStaff = {
  id: "staff-1",
  full_name: "Front Desk Staff",
  auth_user_id: "auth-1",
  is_active: true,
  system_role: "crm",
  staff_type: "csr",
  branch_id: "branch-1",
  created_at: "2026-06-01T00:00:00.000Z",
  branches: { name: "Main Branch" },
};

const baseAuthUser: StaffAccountDiagnosticAuthUser = {
  id: "auth-1",
  email: "frontdesk@cradlespa.com",
  emailConfirmedAt: "2026-06-01T00:00:00.000Z",
  confirmedAt: "2026-06-01T00:00:00.000Z",
  lastSignInAt: "2026-06-15T00:00:00.000Z",
  createdAt: "2026-06-01T00:00:00.000Z",
};

describe("buildStaffAccountDiagnostic", () => {
  it("marks linked active CRM staff as ready", () => {
    const diagnostic = buildStaffAccountDiagnostic({
      staff: baseStaff,
      authUser: baseAuthUser,
    });

    expect(diagnostic.primaryStatus).toBe("ready");
    expect(diagnostic.canOpenCrm).toBe(true);
    expect(diagnostic.recoveryAvailable).toBe(true);
    expect(diagnostic.issues).toHaveLength(0);
  });

  it("blocks staff with no linked Supabase Auth user", () => {
    const diagnostic = buildStaffAccountDiagnostic({
      staff: { ...baseStaff, auth_user_id: null },
      authUser: null,
    });

    expect(diagnostic.primaryStatus).toBe("blocked");
    expect(diagnostic.recoveryAvailable).toBe(false);
    expect(diagnostic.issues.map((issue) => issue.code)).toContain("missing_auth_link");
  });

  it("blocks inactive staff even when auth exists", () => {
    const diagnostic = buildStaffAccountDiagnostic({
      staff: { ...baseStaff, is_active: false },
      authUser: baseAuthUser,
    });

    expect(diagnostic.primaryStatus).toBe("blocked");
    expect(diagnostic.canOpenCrm).toBe(false);
    expect(diagnostic.issues.map((issue) => issue.code)).toContain("inactive_staff");
  });

  it("warns when a staff role has no CRM workspace access", () => {
    const diagnostic = buildStaffAccountDiagnostic({
      staff: { ...baseStaff, system_role: "staff", staff_type: "therapist" },
      authUser: baseAuthUser,
    });

    expect(diagnostic.primaryStatus).toBe("attention");
    expect(diagnostic.canOpenCrm).toBe(false);
    expect(diagnostic.issues.map((issue) => issue.code)).toContain("no_crm_access");
  });
});
