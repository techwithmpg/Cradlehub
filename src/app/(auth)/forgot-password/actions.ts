"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { buildPasswordResetRedirectUrl, PASSWORD_RESET_PATH } from "@/lib/auth/auth-redirects";
import {
  getEmailDomain,
  getStaffAccountAccessRequestContext,
  hasRecentAccountRecoveryEvent,
  normalizeAuditEmail,
  recordStaffAccountAccessEvent,
} from "@/lib/auth/account-access-events";
import { logError } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
});

const SUCCESS_MESSAGE =
  "If an account is connected to that email, a password-reset link has been sent.\n\nPlease check your inbox and spam folder.";
const RATE_LIMIT_MESSAGE =
  "A reset request was recently sent. Please wait before trying again.";
const REQUEST_FAILED_MESSAGE =
  "We could not send the reset link right now. Please try again.";

export type ForgotPasswordState = {
  status?: "success";
  message?: string;
  error?: string;
  fieldErrors?: {
    email?: string;
  };
};

export async function requestPasswordResetAction(
  _previousState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      fieldErrors: {
        email: fieldErrors.email?.[0],
      },
    };
  }

  const email = parsed.data.email;
  const targetEmail = normalizeAuditEmail(email);
  const headerStore = await headers();
  const requestContext = getStaffAccountAccessRequestContext(headerStore);

  if (targetEmail && (await hasRecentAccountRecoveryEvent(targetEmail))) {
    await recordStaffAccountAccessEvent({
      eventType: "self_password_reset_requested",
      outcome: "rate_limited",
      targetEmail,
      requestContext,
      metadata: { flow: "self-service" },
    });
    return { status: "success", message: RATE_LIMIT_MESSAGE };
  }

  let redirectTo: string;
  try {
    redirectTo = buildPasswordResetRedirectUrl();
  } catch (error) {
    await recordStaffAccountAccessEvent({
      eventType: "self_password_reset_requested",
      outcome: "error",
      targetEmail,
      requestContext,
      metadata: {
        flow: "self-service",
        redirectPath: PASSWORD_RESET_PATH,
        reason: "missing_public_app_url",
      },
    });
    logError("auth.password_reset_app_url_missing", {
      error,
      targetEmailDomain: getEmailDomain(targetEmail),
    });
    return { error: REQUEST_FAILED_MESSAGE };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  await recordStaffAccountAccessEvent({
    eventType: "self_password_reset_requested",
    outcome: error ? "error" : "success",
    targetEmail,
    requestContext,
    metadata: {
      flow: "self-service",
      redirectPath: PASSWORD_RESET_PATH,
    },
  });

  if (error) {
    logError("auth.password_reset_request_failed", {
      error,
      targetEmailDomain: getEmailDomain(targetEmail),
    });
    return { error: REQUEST_FAILED_MESSAGE };
  }

  return { status: "success", message: SUCCESS_MESSAGE };
}
