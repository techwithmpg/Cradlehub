"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAllBranches } from "@/lib/queries/branches";
import { createNotification, resolveNotificationsForEntity } from "@/lib/notifications/create";
import { getNotificationTargetPath } from "@/lib/notifications/notification-targets";

export type OnboardingFormState = {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

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
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const preferredBranchId = String(formData.get("preferredBranchId") ?? "").trim() || null;
  const preferredRole = String(formData.get("preferredRole") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim() || null;
  const emergencyContactName = String(formData.get("emergencyContactName") ?? "").trim() || null;
  const emergencyContactPhone = String(formData.get("emergencyContactPhone") ?? "").trim() || null;
  const experienceNotes = String(formData.get("experienceNotes") ?? "").trim() || null;
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const consent = formData.get("consent") === "on";

  // Validate required fields
  const fieldErrors: Record<string, string> = {};
  if (!fullName) fieldErrors.fullName = "Full name is required";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fieldErrors.email = "Valid email is required";
  if (!phone) fieldErrors.phone = "Phone number is required";
  if (!preferredRole) fieldErrors.preferredRole = "Please select a preferred role";
  if (password.length < 8) fieldErrors.password = "Password must be at least 8 characters";
  if (password !== confirmPassword) fieldErrors.confirmPassword = "Passwords do not match";
  if (!consent) fieldErrors.consent = "You must agree to the terms to proceed";

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  // Determine branch_id to use (NOT NULL on staff table)
  let branchId: string | null = preferredBranchId;
  if (!branchId) {
    const branches = await getAllBranches();
    branchId = branches[0]?.id ?? null;
  }
  if (!branchId) {
    return { error: "No branches are currently available. Please contact your administrator." };
  }

  const admin = createAdminClient();

  // Create auth user (confirmed so they can log in; but staff.is_active=false blocks portal access)
  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (authErr) {
    if (authErr.message.toLowerCase().includes("already registered") || authErr.message.toLowerCase().includes("already been registered")) {
      return { error: "An account with this email already exists. If you already applied, please wait for approval." };
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
      phone,
      branch_id: branchId,
      system_role: "staff",
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
    requested_branch_id: preferredBranchId,
    auth_user_id: authUserId,
    staff_id: staffId,
    status: "submitted",
  }).select("id").single();

  if (requestInsert.error) {
    // Non-fatal: staff row and auth user exist; request row is supplementary
    console.error("Failed to create onboarding request row", requestInsert.error.message);
  }

  // Notify owner and branch manager of new application
  const requestId = requestInsert.data?.id;
  if (requestId) {
    const notifBody = `${fullName} submitted an onboarding application.`;
    await Promise.all([
      createNotification({
        targetWorkspace: "owner",
        type: "staff_onboarding_submitted",
        title: "New staff onboarding request",
        body: notifBody,
        entityType: "staff_onboarding_request",
        entityId: requestId,
        actionHref: getNotificationTargetPath({ workspace: "owner", entityType: "staff_onboarding_request", entityId: requestId }),
        priority: "high",
        requiresAction: true,
      }),
      createNotification({
        branchId: branchId,
        targetWorkspace: "manager",
        type: "staff_onboarding_submitted",
        title: "New branch onboarding request",
        body: `${fullName} submitted an application for your branch.`,
        entityType: "staff_onboarding_request",
        entityId: requestId,
        actionHref: getNotificationTargetPath({ workspace: "manager", entityType: "staff_onboarding_request", entityId: requestId }),
        priority: "high",
        requiresAction: true,
      }),
    ]);
  }

  return { success: true };
}

export async function getBranchesForOnboarding() {
  const branches = await getAllBranches();
  return branches.map((b) => ({ id: b.id, name: b.name }));
}

// ── Approve onboarding request (owner or manager) ─────────────────────────
export async function approveOnboardingAction(input: {
  requestId: string;
  staffId: string;
  branchId: string;
  systemRole: string;
  tier: string;
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
  if (!["owner", "manager"].includes(me.system_role)) {
    return { success: false, error: "Owner or manager access required" };
  }
  const ownerRoles = ["manager", "crm", "csr", "csr_head", "csr_staff", "staff"];
  const managerRoles = ["crm", "csr", "csr_staff", "staff"];
  const allowedRoles = me.system_role === "owner" ? ownerRoles : managerRoles;
  if (!allowedRoles.includes(input.systemRole)) {
    return { success: false, error: "That role cannot be assigned through onboarding." };
  }

  const { data: request } = await supabase
    .from("staff_onboarding_requests")
    .select("id, requested_branch_id, staff_id, status")
    .eq("id", input.requestId)
    .maybeSingle();

  if (!request) return { success: false, error: "Onboarding request not found" };
  if (request.status !== "submitted") {
    return { success: false, error: "This onboarding request has already been reviewed." };
  }
  if (request.staff_id && request.staff_id !== input.staffId) {
    return { success: false, error: "Staff record does not match this request." };
  }
  if (me.system_role === "manager") {
    if (input.branchId !== me.branch_id || request.requested_branch_id !== me.branch_id) {
      return { success: false, error: "You can only approve requests for your own branch" };
    }
  }

  const admin = createAdminClient();

  const { error: staffErr } = await admin
    .from("staff")
    .update({
      is_active: true,
      branch_id: input.branchId,
      system_role: input.systemRole,
      tier: input.tier,
    })
    .eq("id", input.staffId);

  if (staffErr) return { success: false, error: staffErr.message };

  await admin.from("staff_onboarding_requests").update({
    status: "approved",
    reviewed_by_staff_id: me.id,
    reviewed_at: new Date().toISOString(),
  }).eq("id", input.requestId);

  // Resolve pending onboarding notifications for this request
  await resolveNotificationsForEntity("staff_onboarding_request", input.requestId);

  return { success: true };
}

// ── Reject onboarding request (owner or manager) ──────────────────────────
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
  if (!["owner", "manager"].includes(me.system_role)) {
    return { success: false, error: "Owner or manager access required" };
  }

  const admin = createAdminClient();

  const { data: request } = await supabase
    .from("staff_onboarding_requests")
    .select("id, requested_branch_id, status")
    .eq("id", input.requestId)
    .maybeSingle();

  if (!request) return { success: false, error: "Onboarding request not found" };
  if (me.system_role === "manager" && request.requested_branch_id !== me.branch_id) {
    return { success: false, error: "You can only reject requests for your own branch" };
  }

  await admin.from("staff_onboarding_requests").update({
    status: "rejected",
    reviewed_by_staff_id: me.id,
    reviewed_at: new Date().toISOString(),
    rejection_reason: input.rejectionReason ?? null,
  }).eq("id", input.requestId);

  // Resolve pending onboarding notifications for this request
  await resolveNotificationsForEntity("staff_onboarding_request", input.requestId);

  return { success: true };
}
