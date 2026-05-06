"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type LoginState = {
  error?: string;
  fieldErrors?: { email?: string; password?: string };
};

function resolveRedirect(systemRole: string): string {
  if (systemRole === "owner") return "/owner";
  if (systemRole === "manager") return "/manager";
  if (systemRole === "crm") return "/crm";
  if (systemRole === "csr" || systemRole === "csr_head" || systemRole === "csr_staff") {
    return "/crm";
  }

  // system_role = staff — route to portal
  if (systemRole === "staff") {
    return "/staff-portal";
  }

  return "/";
}

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
    console.error("Staff lookup failed during login", {
      userId: user.id,
      email: user.email,
      message: staffError.message,
      code: staffError.code,
      details: staffError.details,
    });

    await supabase.auth.signOut();

    return {
      error: "Staff access query failed. Please contact your administrator.",
    };
  }

  // Dev bypass: if no staff record but dev mode is on, send to owner overview
  const { isDevAuthBypassEnabled } = await import("@/lib/dev-bypass");
  if (!staffRecord) {
    if (isDevAuthBypassEnabled()) {
      redirect("/owner");
    }
    await supabase.auth.signOut();
    return { error: "Your account has not been set up yet. Contact your administrator." };
  }

  const destination = resolveRedirect(staffRecord.system_role);
  redirect(destination);
}

