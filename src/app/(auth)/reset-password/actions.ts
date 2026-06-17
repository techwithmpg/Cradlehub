"use server";

import { cookies, headers } from "next/headers";
import { z } from "zod";
import {
  getEmailDomain,
  getStaffAccountAccessRequestContext,
  normalizeAuditEmail,
  recordStaffAccountAccessEvent,
} from "@/lib/auth/account-access-events";
import { PASSWORD_RECOVERY_SESSION_COOKIE } from "@/lib/auth/auth-redirects";
import {
  getPasswordValidationError,
  PASSWORD_REQUIREMENT_MESSAGE,
} from "@/lib/auth/password-policy";
import { logError } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

const resetPasswordSchema = z
  .object({
    password: z.string(),
    confirmPassword: z.string(),
  })
  .superRefine((value, ctx) => {
    const passwordError = getPasswordValidationError(value.password);
    if (passwordError) {
      ctx.addIssue({
        code: "custom",
        path: ["password"],
        message: PASSWORD_REQUIREMENT_MESSAGE,
      });
    }

    if (!value.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Confirm your password",
      });
    } else if (value.password !== value.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Passwords do not match",
      });
    }
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
  const cookieStore = await cookies();
  const requestContext = getStaffAccountAccessRequestContext(headerStore);

  if (cookieStore.get(PASSWORD_RECOVERY_SESSION_COOKIE)?.value !== "1") {
    return {
      error: "This password-reset link is invalid or has expired.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      error: "This password-reset link is invalid or has expired.",
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
      error: "We could not update your password. Please request a new reset link.",
    };
  }

  const { error: signOutError } = await supabase.auth.signOut();
  cookieStore.delete(PASSWORD_RECOVERY_SESSION_COOKIE);

  if (signOutError) {
    logError("auth.password_update_sign_out_failed", {
      error: signOutError,
      userId: user.id,
      targetEmailDomain: getEmailDomain(user.email),
    });
  }

  return {
    status: "success",
    message: "Your password has been updated. Redirecting you to sign in.",
  };
}
