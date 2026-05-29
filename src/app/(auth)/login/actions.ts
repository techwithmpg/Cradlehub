"use server";

import { createClient } from "@/lib/supabase/server";
import { getDefaultDashboardPath } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logError } from "@/lib/logger";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type LoginState = {
  error?: string;
  fieldErrors?: { email?: string; password?: string };
};

export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const raw = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  // Validate
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      fieldErrors: {
        email: fieldErrors.email?.[0],
        password: fieldErrors.password?.[0],
      },
    };
  }

  const supabase = await createClient();

  // Sign in
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (authError) {
    return { error: "Invalid email or password. Please try again." };
  }

  // Get staff role + job function to determine workspace
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Authentication failed. Please try again." };

  const { data: staffRecord, error: staffError } = await supabase
    .from("staff")
    .select("id, auth_user_id, system_role, branch_id, is_active")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (staffError) {
    logError("auth.staff_lookup_failed", {
      userId: user.id,
      error: staffError,
    });

    await supabase.auth.signOut();

    return {
      error: "Staff access query failed. Please contact your administrator.",
    };
  }

  // Dev bypass: if no staff record but dev mode is on, send to CRM
  const { isDevAuthBypassEnabled } = await import("@/lib/dev-bypass");
  if (!staffRecord) {
    if (isDevAuthBypassEnabled()) {
      redirect("/crm");
    }

    // Check if this user has a pending onboarding request
    const { data: onboardingRequest } = await supabase
      .from("staff_onboarding_requests")
      .select("status")
      .eq("auth_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    await supabase.auth.signOut();

    if (onboardingRequest?.status === "submitted") {
      return { error: "Your application is pending review. You'll be able to log in once a manager approves your account." };
    }
    if (onboardingRequest?.status === "rejected") {
      return { error: "Your application was not approved. Please contact your administrator for more information." };
    }

    return { error: "Your account has not been set up yet. Contact your administrator." };
  }

  const destination = getDefaultDashboardPath(staffRecord.system_role);
  redirect(destination);
}

