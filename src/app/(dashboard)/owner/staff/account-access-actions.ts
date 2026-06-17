"use server";

import { headers } from "next/headers";
import { z } from "zod";
import type { User } from "@supabase/supabase-js";
import {
  buildAuthCallbackRedirectUrl,
  PASSWORD_RESET_PATH,
  resolveRequestOrigin,
} from "@/lib/auth/auth-redirects";
import {
  getEmailDomain,
  getStaffAccountAccessRequestContext,
  hasRecentAccountRecoveryEvent,
  normalizeAuditEmail,
  recordStaffAccountAccessEvent,
} from "@/lib/auth/account-access-events";
import {
  buildStaffAccountDiagnostic,
  type StaffAccountDiagnostic,
  type StaffAccountDiagnosticAuthUser,
} from "@/lib/auth/staff-account-diagnostics";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { logError } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

type AdminClient = ReturnType<typeof createAdminClient>;
type StaffRow = Database["public"]["Tables"]["staff"]["Row"];
type StaffDiagnosticRow = StaffRow & {
  branches: { name: string | null } | { name: string | null }[] | null;
};

const staffIdSchema = z.object({
  staffId: z.string().uuid("Invalid staff ID"),
});

export type StaffAccountDiagnosticActionResult =
  | { success: true; diagnostic: StaffAccountDiagnostic }
  | { success: false; error: string };

export type StaffPasswordRecoveryActionResult =
  | { success: true; message: string }
  | { success: false; error: string };

async function requireOwnerAccountAccessContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false as const, error: "Not logged in" };

  if (isDevAuthBypassEnabled()) {
    return {
      success: true as const,
      supabase,
      admin: createAdminClient(),
      actorStaffId: null,
    };
  }

  const { data: me, error } = await supabase
    .from("staff")
    .select("id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    logError("auth.owner_account_access_context_failed", { error, userId: user.id });
    return { success: false as const, error: "Owner access could not be verified." };
  }

  if (!me) return { success: false as const, error: "No active staff record linked to this account." };
  if (me.system_role !== "owner") {
    return { success: false as const, error: "Owner access required." };
  }

  return {
    success: true as const,
    supabase,
    admin: createAdminClient(),
    actorStaffId: me.id,
  };
}

async function fetchStaffForDiagnostics(admin: AdminClient, staffId: string) {
  const { data, error } = await admin
    .from("staff")
    .select(
      "id, auth_user_id, branch_id, created_at, full_name, is_active, is_head, nickname, phone, staff_type, system_role, tier, updated_at, avatar_url, avatar_path, branches(name)"
    )
    .eq("id", staffId)
    .maybeSingle();

  if (error) return { success: false as const, error: error.message };
  if (!data) return { success: false as const, error: "Staff profile not found." };

  return { success: true as const, staff: data as StaffDiagnosticRow };
}

function mapAuthUser(user: User): StaffAccountDiagnosticAuthUser {
  return {
    id: user.id,
    email: user.email ?? null,
    emailConfirmedAt: user.email_confirmed_at ?? null,
    confirmedAt: user.confirmed_at ?? null,
    lastSignInAt: user.last_sign_in_at ?? null,
    createdAt: user.created_at ?? null,
  };
}

async function fetchDiagnosticAuthUser(
  admin: AdminClient,
  staff: StaffDiagnosticRow
): Promise<{
  authUser: StaffAccountDiagnosticAuthUser | null;
  authLookupError: string | null;
}> {
  if (!staff.auth_user_id) {
    return { authUser: null, authLookupError: null };
  }

  const { data, error } = await admin.auth.admin.getUserById(staff.auth_user_id);
  if (error) return { authUser: null, authLookupError: error.message };
  if (!data.user) return { authUser: null, authLookupError: null };

  return {
    authUser: mapAuthUser(data.user),
    authLookupError: null,
  };
}

export async function getStaffAccountDiagnosticAction(
  rawInput: unknown
): Promise<StaffAccountDiagnosticActionResult> {
  const parsed = staffIdSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireOwnerAccountAccessContext();
  if (!ctx.success) return { success: false, error: ctx.error };

  const staffResult = await fetchStaffForDiagnostics(ctx.admin, parsed.data.staffId);
  if (!staffResult.success) return { success: false, error: staffResult.error };

  const { authUser, authLookupError } = await fetchDiagnosticAuthUser(
    ctx.admin,
    staffResult.staff
  );
  const diagnostic = buildStaffAccountDiagnostic({
    staff: staffResult.staff,
    authUser,
    authLookupError,
  });

  const headerStore = await headers();
  await recordStaffAccountAccessEvent({
    eventType: "owner_account_diagnostic_viewed",
    outcome: "success",
    actorStaffId: ctx.actorStaffId,
    targetStaffId: staffResult.staff.id,
    targetAuthUserId: staffResult.staff.auth_user_id,
    targetEmail: diagnostic.authEmail,
    requestContext: getStaffAccountAccessRequestContext(headerStore),
    metadata: {
      primaryStatus: diagnostic.primaryStatus,
      canOpenCrm: diagnostic.canOpenCrm,
    },
  });

  return { success: true, diagnostic };
}

export async function sendStaffPasswordRecoveryAction(
  rawInput: unknown
): Promise<StaffPasswordRecoveryActionResult> {
  const parsed = staffIdSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireOwnerAccountAccessContext();
  if (!ctx.success) return { success: false, error: ctx.error };

  const staffResult = await fetchStaffForDiagnostics(ctx.admin, parsed.data.staffId);
  if (!staffResult.success) return { success: false, error: staffResult.error };

  if (!staffResult.staff.auth_user_id) {
    await recordStaffAccountAccessEvent({
      eventType: "owner_password_recovery_sent",
      outcome: "not_available",
      actorStaffId: ctx.actorStaffId,
      targetStaffId: staffResult.staff.id,
      metadata: { reason: "missing_auth_link" },
    });
    return {
      success: false,
      error: "This staff profile has no linked auth account. Create or re-send the staff invite first.",
    };
  }

  const { data, error: authError } = await ctx.admin.auth.admin.getUserById(
    staffResult.staff.auth_user_id
  );
  const email = normalizeAuditEmail(data.user?.email);

  if (authError || !data.user || !email) {
    await recordStaffAccountAccessEvent({
      eventType: "owner_password_recovery_sent",
      outcome: "not_available",
      actorStaffId: ctx.actorStaffId,
      targetStaffId: staffResult.staff.id,
      targetAuthUserId: staffResult.staff.auth_user_id,
      metadata: { reason: authError ? "auth_lookup_failed" : "missing_auth_email" },
    });
    return {
      success: false,
      error: "The linked auth account could not be used for password recovery.",
    };
  }

  const headerStore = await headers();
  const requestContext = getStaffAccountAccessRequestContext(headerStore);

  if (await hasRecentAccountRecoveryEvent(email)) {
    await recordStaffAccountAccessEvent({
      eventType: "owner_password_recovery_sent",
      outcome: "rate_limited",
      actorStaffId: ctx.actorStaffId,
      targetStaffId: staffResult.staff.id,
      targetAuthUserId: staffResult.staff.auth_user_id,
      targetEmail: email,
      requestContext,
      metadata: { flow: "owner-support" },
    });
    return {
      success: true,
      message: "A reset link was already sent recently. Ask the staff member to check their email.",
    };
  }

  const redirectTo = buildAuthCallbackRedirectUrl(
    resolveRequestOrigin(headerStore),
    PASSWORD_RESET_PATH
  );
  const { error } = await ctx.supabase.auth.resetPasswordForEmail(email, { redirectTo });

  await recordStaffAccountAccessEvent({
    eventType: "owner_password_recovery_sent",
    outcome: error ? "error" : "success",
    actorStaffId: ctx.actorStaffId,
    targetStaffId: staffResult.staff.id,
    targetAuthUserId: staffResult.staff.auth_user_id,
    targetEmail: email,
    requestContext,
    metadata: {
      flow: "owner-support",
      staffActive: staffResult.staff.is_active,
      systemRole: staffResult.staff.system_role,
    },
  });

  if (error) {
    logError("auth.owner_password_recovery_failed", {
      error,
      targetEmailDomain: getEmailDomain(email),
      targetStaffId: staffResult.staff.id,
    });
    return {
      success: false,
      error: "Password recovery email could not be sent. Try again later.",
    };
  }

  return {
    success: true,
    message: "Password reset link sent to the linked auth email.",
  };
}
