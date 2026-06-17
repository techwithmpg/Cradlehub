import {
  buildWorkspaceAccessFromStaffProfile,
  canAccessWorkspacePath,
  hasWorkspaceAccess,
} from "@/lib/auth/workspace-access";

export type StaffAccountDiagnosticStaff = {
  id: string;
  full_name: string;
  auth_user_id: string | null;
  is_active: boolean;
  system_role: string;
  staff_type: string | null;
  branch_id: string | null;
  created_at?: string | null;
  branches?: { name: string | null } | { name: string | null }[] | null;
};

export type StaffAccountDiagnosticAuthUser = {
  id: string;
  email: string | null;
  emailConfirmedAt: string | null;
  confirmedAt: string | null;
  lastSignInAt: string | null;
  createdAt: string | null;
};

export type StaffAccountDiagnosticIssue = {
  code:
    | "inactive_staff"
    | "missing_auth_link"
    | "auth_lookup_failed"
    | "auth_user_missing"
    | "auth_id_mismatch"
    | "auth_email_missing"
    | "email_unconfirmed"
    | "no_workspace_access"
    | "no_crm_access";
  severity: "critical" | "warning";
  message: string;
};

export type StaffAccountDiagnostic = {
  staffId: string;
  staffName: string;
  staffActive: boolean;
  systemRole: string;
  staffType: string | null;
  authLinked: boolean;
  authUserFound: boolean;
  authEmail: string | null;
  emailConfirmed: boolean;
  lastSignInAt: string | null;
  authCreatedAt: string | null;
  workspaceLabels: string[];
  canOpenCrm: boolean;
  recoveryAvailable: boolean;
  primaryStatus: "ready" | "attention" | "blocked";
  issues: StaffAccountDiagnosticIssue[];
  recommendedActions: string[];
};

export function buildStaffAccountDiagnostic(input: {
  staff: StaffAccountDiagnosticStaff;
  authUser: StaffAccountDiagnosticAuthUser | null;
  authLookupError?: string | null;
}): StaffAccountDiagnostic {
  const { staff, authUser, authLookupError } = input;
  const workspaces = buildWorkspaceAccessFromStaffProfile(staff);
  const canOpenCrm =
    staff.is_active && canAccessWorkspacePath("/crm", staff.system_role, workspaces);
  const issues: StaffAccountDiagnosticIssue[] = [];

  if (!staff.is_active) {
    issues.push({
      code: "inactive_staff",
      severity: "critical",
      message: "Staff profile is inactive, so workspace access is blocked.",
    });
  }

  if (!staff.auth_user_id) {
    issues.push({
      code: "missing_auth_link",
      severity: "critical",
      message: "No Supabase Auth account is linked to this staff profile.",
    });
  } else if (authLookupError) {
    issues.push({
      code: "auth_lookup_failed",
      severity: "critical",
      message: "The linked auth account could not be checked.",
    });
  } else if (!authUser) {
    issues.push({
      code: "auth_user_missing",
      severity: "critical",
      message: "The linked auth account was not found in Supabase Auth.",
    });
  } else {
    if (authUser.id !== staff.auth_user_id) {
      issues.push({
        code: "auth_id_mismatch",
        severity: "warning",
        message: "The returned auth account does not match the staff auth link.",
      });
    }

    if (!authUser.email) {
      issues.push({
        code: "auth_email_missing",
        severity: "critical",
        message: "The linked auth account has no email address for recovery.",
      });
    }

    if (!authUser.emailConfirmedAt && !authUser.confirmedAt) {
      issues.push({
        code: "email_unconfirmed",
        severity: "warning",
        message: "The linked auth account email has not been confirmed yet.",
      });
    }
  }

  if (workspaces.length === 0) {
    issues.push({
      code: "no_workspace_access",
      severity: "critical",
      message: "This role does not currently resolve to any staff workspace.",
    });
  }

  if (!hasWorkspaceAccess(workspaces, "crm")) {
    issues.push({
      code: "no_crm_access",
      severity: "warning",
      message: "This staff role does not include CRM / Front Desk workspace access.",
    });
  }

  const hasCriticalIssue = issues.some((issue) => issue.severity === "critical");
  const hasWarningIssue = issues.some((issue) => issue.severity === "warning");
  const recoveryAvailable = Boolean(staff.auth_user_id && authUser?.email);

  return {
    staffId: staff.id,
    staffName: staff.full_name,
    staffActive: staff.is_active,
    systemRole: staff.system_role,
    staffType: staff.staff_type,
    authLinked: Boolean(staff.auth_user_id),
    authUserFound: Boolean(authUser),
    authEmail: authUser?.email ?? null,
    emailConfirmed: Boolean(authUser?.emailConfirmedAt ?? authUser?.confirmedAt),
    lastSignInAt: authUser?.lastSignInAt ?? null,
    authCreatedAt: authUser?.createdAt ?? null,
    workspaceLabels: workspaces.map((workspace) => workspace.label),
    canOpenCrm,
    recoveryAvailable,
    primaryStatus: hasCriticalIssue ? "blocked" : hasWarningIssue ? "attention" : "ready",
    issues,
    recommendedActions: getRecommendedActions(issues, recoveryAvailable),
  };
}

function getRecommendedActions(
  issues: StaffAccountDiagnosticIssue[],
  recoveryAvailable: boolean
): string[] {
  const issueCodes = new Set(issues.map((issue) => issue.code));
  const actions: string[] = [];

  if (issueCodes.has("missing_auth_link") || issueCodes.has("auth_user_missing")) {
    actions.push("Create or re-send the staff invite so this profile is linked to Supabase Auth.");
  }
  if (issueCodes.has("inactive_staff")) {
    actions.push("Reactivate the staff profile before asking the staff member to log in.");
  }
  if (issueCodes.has("no_crm_access")) {
    actions.push("Change the system role to a CRM / Front Desk role if this user should access CRM.");
  }
  if (issueCodes.has("email_unconfirmed") && recoveryAvailable) {
    actions.push("Send a password recovery email so the staff member can set a fresh password.");
  }
  if (issues.length === 0 && recoveryAvailable) {
    actions.push("Send a password recovery email if the staff member forgot their password.");
  }

  return actions;
}
