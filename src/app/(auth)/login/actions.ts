"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserWorkspaceAccess } from "@/lib/auth/get-user-workspace-access";
import {
  getWorkspaceSwitchDestination,
  resolveStaffPwaOperationalGroup,
} from "@/lib/auth/workspace-access";
import { getStaffPwaLaunchDestination } from "@/lib/auth/staff-pwa-launch";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logError } from "@/lib/logger";
import { LOGIN_FAILURE_MESSAGE } from "./messages";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type LoginState = {
  error?: string;
  fieldErrors?: { email?: string; password?: string };
};

export type GoogleLoginCompletion = { ok: true; redirectTo: string } | { ok: false; error: string };

async function getLoginDestinationForUser(
  userId: string,
  staffPwa = false
): Promise<string | LoginState> {
  try {
    const workspaces = await getUserWorkspaceAccess(userId);
    if (staffPwa) {
      const supabase = await createClient();
      const { data: staff, error: staffError } = await supabase
        .from("staff")
        .select("system_role, staff_type")
        .eq("auth_user_id", userId)
        .eq("is_active", true)
        .maybeSingle();
      if (!staffError && staff) {
        const group = resolveStaffPwaOperationalGroup(staff.system_role, staff.staff_type);
        const launchDestination = getStaffPwaLaunchDestination(workspaces, group);
        if (launchDestination) return launchDestination;
      }
    }
    return getWorkspaceSwitchDestination(workspaces);
  } catch (error) {
    logError("auth.workspace_access_failed", {
      userId,
      error,
    });
    return {
      error: "Workspace access query failed. Please contact your administrator.",
    };
  }
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
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
    return { error: LOGIN_FAILURE_MESSAGE };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Authentication failed. Please try again." };

  const destination = await getLoginDestinationForUser(user.id, formData.get("staffPwa") === "1");
  if (typeof destination !== "string") return destination;

  redirect(destination);
}

export async function completeGoogleLoginAction(staffPwa = false): Promise<GoogleLoginCompletion> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: "Google sign-in could not be completed. Try again or use your email and password.",
    };
  }

  const destination = await getLoginDestinationForUser(user.id, staffPwa);
  if (typeof destination !== "string") {
    return { ok: false, error: destination.error ?? "Authentication failed. Please try again." };
  }

  return { ok: true, redirectTo: destination };
}
