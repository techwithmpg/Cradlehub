"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAllBranches } from "@/lib/queries/branches";
import { emitWorkflowEvent } from "@/lib/notifications/workflow-signals";
import { mapPreferredRoleToStaffType } from "@/lib/staff/onboarding-roles";
import { canApproveStaffOnboarding } from "@/lib/staff/approval-permissions";
import {
  validateOnboardingBranch,
  buildOnboardingMetadata,
  evaluateDuplicateCheck,
  type DuplicateCheckInput,
  type DuplicateCheckResult,
} from "@/lib/staff/onboarding-validation";
import { logError, logBusinessEvent } from "@/lib/logger";
import { canonicalizeSystemRole } from "@/constants/staff";
import { canReviewStaffOnboarding, isOwner, isManager } from "@/lib/permissions";
import type { Json } from "@/types/supabase";

export type OnboardingFormState = {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

function normalizeOptionalString(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function submitStaffOnboardingAction(
  _prev: OnboardingFormState,
  formData: FormData
): Promise<OnboardingFormState> {
  // Guard: feature must be enabled
  if (process.env.STAFF_ONBOARDING_ENABLED !== "true") {
    return { error: "Staff onboarding is not currently available." };
  }

  // Guard: access code (server-side only — env var never sent to client)
  const accessCode = String(formData.get("accessCode") ?? "").trim();
  const expectedCode = process.env.STAFF_ONBOARDING_ACCESS_CODE ?? "";
  if (!expectedCode || accessCode !== expectedCode) {
    return { error: "Invalid access code. Please contact your administrator." };
  }

  // Collect fields
  const fullName = String(formData.get("fullName") ?? "").trim();
  const nickname = normalizeOptionalString(formData.get("nickname"));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const preferredBranchId = String(formData.get("preferredBranchId") ?? "").trim();
  const branchConfirmed = formData.get("branchConfirmed") === "on";
  const preferredRole = String(formData.get("preferredRole") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim() || null;
  const emergencyContactName = String(formData.get("emergencyContactName") ?? "").trim() || null;
  const emergencyContactPhone = String(formData.get("emergencyContactPhone") ?? "").trim() || null;
  const experienceNotes = String(formData.get("experienceNotes") ?? "").trim() || null;
  const serviceIds = formData.getAll("serviceIds").map((v) => String(v));
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const consent = formData.get("consent") === "on";

  // Validate required fields
  const fieldErrors: Record<string, string> = {};
  if (!fullName) fieldErrors.fullName = "Full name is required";
  if (!email || !isValidEmail(email)) fieldErrors.email = "Valid email is required";
  if (!phone) fieldErrors.phone = "Phone number is required";
  if (!preferredRole) fieldErrors.preferredRole = "Please select a preferred role";
  if (password.length < 8) fieldErrors.password = "Password must be at least 8 characters";
  if (password !== confirmPassword) fieldErrors.confirmPassword = "Passwords do not match";
  if (!consent) fieldErrors.consent = "You must agree to the terms to proceed";

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  // Branch must be active and explicit — no silent fallback to the first branch.
  let activeBranches: { id: string; name: string }[] = [];
  try {
    activeBranches = await getAllBranches();
  } catch (branchErr) {
    logError("staff.onboarding.branch_lookup_failed", { error: branchErr });
    return { error: "Unable to verify branches. Please try again later." };
  }

  const branchValidation = validateOnboardingBranch({
    preferredBranchId,
    branchConfirmed,
    activeBranches,
  });

  if (!branchValidation.ok) {
    return { fieldErrors: branchValidation.fieldErrors };
  }

  const branchId = branchValidation.branch.id;

  const admin = createAdminClient();

  // Duplicate checks before creating auth account / staff record.
  const duplicateCheck = await checkOnboardingDuplicates(admin, {
    email,
    phone,
    fullName,
  });
  if (duplicateCheck.emailDuplicate) {
    return {
      fieldErrors: {
        email: "This email already has an application/account. Please contact the front desk.",
      },
    };
  }
  if (duplicateCheck.phoneDuplicate) {
    return {
      fieldErrors: {
        phone: "This phone number already exists. Please contact the front desk.",
      },
    };
  }
  if (duplicateCheck.namePhoneDuplicate) {
    return {
      fieldErrors: {
        phone: "This phone number already exists. Please contact the front desk.",
      },
    };
  }

  // Create auth user (confirmed so they can log in; but staff.is_active=false blocks portal access)
  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, nickname },
  });

  if (authErr) {
    const message = authErr.message.toLowerCase();
    if (
      message.includes("already registered") ||
      message.includes("already been registered") ||
      message.includes("duplicate")
    ) {
      return {
        fieldErrors: {
          email: "This email already has an application/account. Please contact the front desk.",
        },
      };
    }
    return { error: `Could not create account: ${authErr.message}` };
  }

  const authUserId = authUser.user.id;

  // Create inactive staff row
  const supabase = createAdminClient(); // admin bypasses RLS for insert
  const staffInsert = await supabase
    .from("staff")
    .insert({
      auth_user_id: authUserId,
      full_name: fullName,
      nickname,
      phone,
      branch_id: branchId,
      system_role: "staff",
      staff_type: mapPreferredRoleToStaffType(preferredRole),
      tier: "junior",
      is_active: false,
    })
    .select("id")
    .single();

  if (staffInsert.error) {
    // Cleanup: delete the auth user we just created
    await admin.auth.admin.deleteUser(authUserId);
    return { error: `Failed to create staff record: ${staffInsert.error.message}` };
  }

  const staffId = staffInsert.data.id;

  // Upload profile picture (non-fatal — staff row still created if this fails)
  const profilePicture = formData.get("profilePicture");
  if (profilePicture instanceof File && profilePicture.size > 0) {
    const ext = profilePicture.name.split(".").pop() ?? "jpg";
    const filePath = `staff-avatars/${staffId}/profile.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("staff-pictures")
      .upload(filePath, profilePicture, { upsert: true, contentType: profilePicture.type });
    if (!uploadErr) {
      const { data: { publicUrl } } = supabase.storage.from("staff-pictures").getPublicUrl(filePath);
      // Columns may not exist in all deployments — store in request metadata as fallback
      const updateResult = await supabase.from("staff").update({ avatar_url: publicUrl, avatar_path: filePath }).eq("id", staffId);
      if (updateResult.error) {
        // avatar_url/avatar_path columns not yet migrated — store URL in request metadata instead
        await supabase.from("staff_onboarding_requests")
          .update({ metadata: { profile_picture_url: publicUrl } })
          .eq("staff_id", staffId);
      }
    }
  }

  // Create onboarding request row
  const requestInsert = await supabase.from("staff_onboarding_requests").insert({
    full_name: fullName,
    email,
    phone,
    address,
    emergency_contact_name: emergencyContactName,
    emergency_contact_phone: emergencyContactPhone,
    experience_notes: experienceNotes,
    preferred_role: preferredRole,
    requested_branch_id: branchId,
    auth_user_id: authUserId,
    staff_id: staffId,
    status: "submitted",
    metadata: buildOnboardingMetadata({
      serviceIds,
      experienceNotes,
      nickname,
      branch: branchValidation.branch,
    }) as unknown as Json,
  }).select("id").single();

  if (requestInsert.error) {
    // Non-fatal: staff row and auth user exist; request row is supplementary
    logError("staff.onboarding.request_row_failed", {
      staffId,
      branchId,
      error: requestInsert.error,
    });
  }

  // Emit one role-aware workflow signal for the new application.
  const requestId = requestInsert.data?.id;
  if (requestId) {
    await emitWorkflowEvent({
      eventType: "staff_onboarding.submitted",
      requestId,
      branchId,
      applicantStaffId: staffId,
      applicantName: fullName,
      requestedServiceIds: serviceIds,
    });
  }

  logBusinessEvent("staff.onboarding.submitted", {
    staffId,
    branchId,
    preferredRole,
    serviceCount: serviceIds.length,
    requestId: requestInsert.data?.id ?? null,
  });

  return { success: true };
}

export async function checkOnboardingDuplicates(
  admin: ReturnType<typeof createAdminClient>,
  input: DuplicateCheckInput
): Promise<DuplicateCheckResult> {
  try {
    const [authUsers, emailRequests, phoneStaff, phoneRequests] = await Promise.all([
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      admin
        .from("staff_onboarding_requests")
        .select("email")
        .eq("email", input.email)
        .eq("status", "submitted"),
      admin
        .from("staff")
        .select("id, full_name, phone")
        .eq("phone", input.phone)
        .eq("is_active", true),
      admin
        .from("staff_onboarding_requests")
        .select("id, full_name, phone")
        .eq("phone", input.phone)
        .eq("status", "submitted"),
    ]);

    if (authUsers.error) {
      logError("staff.onboarding.email_duplicate_check_failed", { email: input.email, error: authUsers.error });
    }
    if (emailRequests.error) {
      logError("staff.onboarding.request_email_duplicate_check_failed", { email: input.email, error: emailRequests.error });
    }
    if (phoneStaff.error) {
      logError("staff.onboarding.phone_staff_duplicate_check_failed", { phone: input.phone, error: phoneStaff.error });
    }
    if (phoneRequests.error) {
      logError("staff.onboarding.request_phone_duplicate_check_failed", { phone: input.phone, error: phoneRequests.error });
    }

    return evaluateDuplicateCheck(
      { email: input.email, phone: input.phone, fullName: input.fullName },
      {
        authEmails: (authUsers.data?.users ?? []).map((u) => u.email ?? ""),
        requestEmails: (emailRequests.data ?? []).map((r) => r.email ?? ""),
        activeStaffPhones: (phoneStaff.data ?? []).map((s) => ({
          full_name: s.full_name ?? null,
          phone: s.phone ?? null,
        })),
        requestPhones: (phoneRequests.data ?? []).map((r) => ({
          full_name: r.full_name ?? null,
          phone: r.phone ?? null,
        })),
      }
    );
  } catch (error) {
    logError("staff.onboarding.duplicate_check_failed", { input, error });
    return { emailDuplicate: false, phoneDuplicate: false, namePhoneDuplicate: false };
  }
}

export async function getBranchesForOnboarding() {
  const branches = await getAllBranches();
  return branches.map((b) => ({ id: b.id, name: b.name }));
}

// ── Approve onboarding request (owner, manager, or CSR for MVP) ───────────
export async function approveOnboardingAction(input: {
  requestId: string;
  staffId: string;
  branchId: string;
  systemRole: string;
  tier: string;
  serviceIds?: string[];
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in" };

  const { data: me } = await supabase
    .from("staff")
    .select("id, system_role, branch_id")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!me) return { success: false, error: "No active staff record found" };

  const actorRole = canonicalizeSystemRole(me.system_role);

  const { data: request } = await supabase
    .from("staff_onboarding_requests")
    .select("id, requested_branch_id, staff_id, status, preferred_role, full_name, metadata")
    .eq("id", input.requestId)
    .maybeSingle();

  if (!request) return { success: false, error: "Onboarding request not found" };
  if (request.status !== "submitted") {
    return { success: false, error: "This onboarding request has already been reviewed." };
  }
  if (request.staff_id && request.staff_id !== input.staffId) {
    return { success: false, error: "Staff record does not match this request." };
  }

  // Permission check using centralized helper
  const approvalCheck = canApproveStaffOnboarding({
    approverRole: me.system_role,
    approverBranchId: me.branch_id,
    targetBranchId: request.requested_branch_id,
    requestedSystemRole: input.systemRole,
  });

  if (!approvalCheck.allowed) {
    return { success: false, error: approvalCheck.reason ?? "You do not have permission to approve this request." };
  }

  if (!approvalCheck.assignableRoles.includes(input.systemRole)) {
    return { success: false, error: "That role cannot be assigned with your permission level." };
  }

  // Validate the approval branch is active.
  let activeBranches: { id: string; name: string }[] = [];
  try {
    activeBranches = await getAllBranches();
  } catch (err) {
    logError("staff.onboarding.approval_branch_lookup_failed", { error: err });
    return { success: false, error: "Unable to verify branches. Please try again later." };
  }
  if (!activeBranches.some((b) => b.id === input.branchId)) {
    return { success: false, error: "Selected branch is not active." };
  }

  // CRM/CSR must not approve applicants into another branch.
  // Owners and managers may change the branch, but the change is recorded.
  const branchChanged = input.branchId !== request.requested_branch_id;
  const approverCanChangeBranch = isOwner(actorRole) || isManager(actorRole);
  if (branchChanged && !approverCanChangeBranch) {
    return {
      success: false,
      error: "You can only approve staff into the requested branch. Ask an owner or manager to change the branch.",
    };
  }

  const admin = createAdminClient();
  const requestMetadata = request.metadata as { nickname?: string | null } | null;
  const nickname =
    typeof requestMetadata?.nickname === "string" && requestMetadata.nickname.trim().length > 0
      ? requestMetadata.nickname.trim()
      : null;

  // Update staff record
  const { error: staffErr } = await admin
    .from("staff")
    .update({
      is_active: true,
      branch_id: input.branchId,
      system_role: input.systemRole,
      staff_type: mapPreferredRoleToStaffType(request?.preferred_role ?? ""),
      tier: input.tier,
      ...(nickname ? { nickname } : {}),
    })
    .eq("id", input.staffId);

  if (staffErr) return { success: false, error: staffErr.message };

  // Sync service capabilities if provided
  const confirmedServiceIds = input.serviceIds;
  if (confirmedServiceIds && confirmedServiceIds.length > 0) {
    const { error: delErr } = await admin
      .from("staff_services")
      .delete()
      .eq("staff_id", input.staffId);
    if (delErr) {
      return { success: false, error: `Activated staff but failed to clear old services: ${delErr.message}` };
    }
    const rows = confirmedServiceIds.map((serviceId) => ({ staff_id: input.staffId, service_id: serviceId }));
    const { error: insErr } = await admin.from("staff_services").insert(rows);
    if (insErr) {
      return { success: false, error: `Activated staff but failed to set services: ${insErr.message}` };
    }
  }

  const now = new Date().toISOString();
  const existingMetadata =
    request.metadata && typeof request.metadata === "object" && !Array.isArray(request.metadata)
      ? (request.metadata as Record<string, unknown>)
      : {};
  const updatedMetadata: Record<string, unknown> = {
    ...existingMetadata,
  };
  if (branchChanged) {
    updatedMetadata.approved_branch_differs_from_requested = true;
    updatedMetadata.original_requested_branch_id = request.requested_branch_id;
    updatedMetadata.approved_branch_id = input.branchId;
    updatedMetadata.approved_branch_changed_at = now;
    updatedMetadata.approved_branch_changed_by_staff_id = me.id;
  }

  await admin.from("staff_onboarding_requests").update({
    status: "approved",
    reviewed_by_staff_id: me.id,
    reviewed_at: now,
    requested_branch_id: input.branchId,
    metadata: updatedMetadata as unknown as Json,
  }).eq("id", input.requestId);

  await emitWorkflowEvent({
    eventType: "staff_onboarding.approved",
    requestId: input.requestId,
    branchId: input.branchId,
    applicantStaffId: input.staffId,
    applicantName: request.full_name,
    actorStaffId: me.id,
  });

  logBusinessEvent("staff.onboarding.approved", {
    requestId: input.requestId,
    staffId: input.staffId,
    branchId: input.branchId,
    actorId: me.id,
    workspace: me.system_role,
    systemRole: input.systemRole,
    tier: input.tier,
    branchChanged,
  });

  return { success: true };
}

// ── Reject onboarding request (owner, manager, or CSR for MVP) ────────────
export async function rejectOnboardingAction(input: {
  requestId: string;
  staffId: string;
  rejectionReason?: string;
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in" };

  const { data: me } = await supabase
    .from("staff")
    .select("id, system_role, branch_id")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!me) return { success: false, error: "No active staff record found" };

  const actorRole = canonicalizeSystemRole(me.system_role);
  if (!canReviewStaffOnboarding(actorRole)) {
    return { success: false, error: "You do not have permission to reject applications." };
  }

  const admin = createAdminClient();

  const { data: request } = await supabase
    .from("staff_onboarding_requests")
    .select("id, requested_branch_id, status, staff_id, full_name, metadata")
    .eq("id", input.requestId)
    .maybeSingle();

  if (!request) return { success: false, error: "Onboarding request not found" };
  if (request.status !== "submitted") {
    return { success: false, error: "This onboarding request has already been reviewed." };
  }

  // Branch scope check for non-owners
  if (!isOwner(actorRole)) {
    if (request.requested_branch_id && request.requested_branch_id !== me.branch_id) {
      return { success: false, error: "You can only reject requests for your own branch" };
    }
  }

  const now = new Date().toISOString();
  const existingMetadata =
    request.metadata && typeof request.metadata === "object" && !Array.isArray(request.metadata)
      ? (request.metadata as Record<string, unknown>)
      : {};
  const updatedMetadata: Record<string, unknown> = {
    ...existingMetadata,
    rejected_at: now,
    rejected_by_staff_id: me.id,
  };

  await admin.from("staff_onboarding_requests").update({
    status: "rejected",
    reviewed_by_staff_id: me.id,
    reviewed_at: now,
    rejection_reason: input.rejectionReason ?? null,
    metadata: updatedMetadata as unknown as Json,
  }).eq("id", input.requestId);

  await emitWorkflowEvent({
    eventType: "staff_onboarding.rejected",
    requestId: input.requestId,
    branchId: request.requested_branch_id,
    applicantStaffId: request.staff_id ?? input.staffId,
    applicantName: request.full_name,
    actorStaffId: me.id,
    rejectionReason: input.rejectionReason ?? null,
  });

  logBusinessEvent("staff.onboarding.rejected", {
    requestId: input.requestId,
    staffId: input.staffId,
    branchId: request.requested_branch_id,
    actorId: me.id,
    workspace: me.system_role,
    rejectionReason: input.rejectionReason ?? null,
  });

  return { success: true };
}
