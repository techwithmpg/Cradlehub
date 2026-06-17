"use server";

import { headers } from "next/headers";
import { z } from "zod";
import {
  getEmailDomain,
  getStaffAccountAccessRequestContext,
  normalizeAuditEmail,
  recordStaffAccountAccessEvent,
} from "@/lib/auth/account-access-events";
import { logError } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Confirm your password"),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export type ResetPasswordState = {
  status?: "success";
  message?: string;
  error?: string;
  fieldErrors?: {
    password?: string;
    confirmPassword?: string;
  };
};

export async function updatePasswordAction(
  _previousState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      fieldErrors: {
        password: fieldErrors.password?.[0],
        confirmPassword: fieldErrors.confirmPassword?.[0],
      },
    };
  }

  const headerStore = await headers();
  const requestContext = getStaffAccountAccessRequestContext(headerStore);
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      error: "Your reset link has expired. Request a new password reset link.",
    };
  }

  const { data: staff } = await supabase
    .from("staff")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  await recordStaffAccountAccessEvent({
    eventType: "password_updated",
    outcome: error ? "error" : "success",
    targetStaffId: staff?.id ?? null,
    targetAuthUserId: user.id,
    targetEmail: normalizeAuditEmail(user.email),
    requestContext,
    metadata: { flow: "self-service" },
  });

  if (error) {
    logError("auth.password_update_failed", {
      error,
      userId: user.id,
      targetEmailDomain: getEmailDomain(user.email),
    });
    return {
      error: "Password could not be updated. Request a new reset link and try again.",
    };
  }

  await supabase.auth.signOut();

  return {
    status: "success",
    message: "Password updated. Sign in again with your new password.",
  };
}
