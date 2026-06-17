"use server";

import { headers } from "next/headers";
import { z } from "zod";
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
import { logError } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
});

const SUCCESS_MESSAGE =
  "If that email belongs to a staff account, a reset link has been sent.";

export type ForgotPasswordState = {
  status?: "success";
  message?: string;
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
    return { status: "success", message: SUCCESS_MESSAGE };
  }

  const origin = resolveRequestOrigin(headerStore);
  const redirectTo = buildAuthCallbackRedirectUrl(origin, PASSWORD_RESET_PATH);
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
  }

  return { status: "success", message: SUCCESS_MESSAGE };
}
