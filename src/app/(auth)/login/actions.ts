"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const ROLE_REDIRECT: Record<string, string> = {
  owner: "/owner",
  manager: "/manager",
  crm: "/crm",
  staff: "/staff-portal",
};

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

  // Get staff role to determine which workspace to redirect to
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Authentication failed. Please try again." };

  const { data: staffRecord } = await supabase
    .from("staff")
    .select("system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .single();

  if (!staffRecord) {
    await supabase.auth.signOut();
    return { error: "Your account has not been set up yet. Contact your administrator." };
  }

  const destination = ROLE_REDIRECT[staffRecord.system_role] ?? "/";
  redirect(destination);
}
