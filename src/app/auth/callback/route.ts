import { NextRequest, NextResponse } from "next/server";
import {
  buildInvalidPasswordRecoveryPath,
  DEFAULT_AUTH_REDIRECT_PATH,
  getPasswordRecoveryCookieOptions,
  PASSWORD_RECOVERY_SESSION_MAX_AGE_SECONDS,
  PASSWORD_RECOVERY_SESSION_COOKIE,
  PASSWORD_RESET_PATH,
  sanitizeAuthRedirectPath,
} from "@/lib/auth/auth-redirects";
import { logError } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const providerError =
    requestUrl.searchParams.get("error_description") ?? requestUrl.searchParams.get("error");
  const requestedNextPath = requestUrl.searchParams.get("next");
  const isRecoveryCallback = type === "recovery";
  const hasRecoveryIntent =
    isRecoveryCallback || Boolean(tokenHash) || requestedNextPath === PASSWORD_RESET_PATH;
  const sanitizedNextPath = sanitizeAuthRedirectPath(
    requestedNextPath,
    isRecoveryCallback ? PASSWORD_RESET_PATH : DEFAULT_AUTH_REDIRECT_PATH
  );
  const nextPath =
    !isRecoveryCallback && sanitizedNextPath === PASSWORD_RESET_PATH
      ? DEFAULT_AUTH_REDIRECT_PATH
      : sanitizedNextPath;

  function clearRecoveryMarker(response: NextResponse) {
    response.cookies.set(PASSWORD_RECOVERY_SESSION_COOKIE, "", getPasswordRecoveryCookieOptions(0));
    return response;
  }

  function invalidRecoveryResponse() {
    return clearRecoveryMarker(
      NextResponse.redirect(new URL(buildInvalidPasswordRecoveryPath(), requestUrl.origin))
    );
  }

  if (providerError) {
    logError("auth.callback_provider_error", { error: providerError });
    return hasRecoveryIntent
      ? invalidRecoveryResponse()
      : clearRecoveryMarker(NextResponse.redirect(new URL("/login", requestUrl.origin)));
  }

  if (!code && !(tokenHash && isRecoveryCallback)) {
    return hasRecoveryIntent
      ? invalidRecoveryResponse()
      : clearRecoveryMarker(NextResponse.redirect(new URL("/login", requestUrl.origin)));
  }

  const supabase = await createClient();
  const { error } =
    code !== null
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({
          token_hash: tokenHash as string,
          type: "recovery",
        });

  if (error) {
    logError("auth.callback_code_exchange_failed", { error });
    return isRecoveryCallback
      ? invalidRecoveryResponse()
      : clearRecoveryMarker(NextResponse.redirect(new URL("/login", requestUrl.origin)));
  }

  if (isRecoveryCallback) {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      logError("auth.callback_recovery_session_missing", { error: userError });
      return invalidRecoveryResponse();
    }
  }

  const response = NextResponse.redirect(new URL(nextPath, requestUrl.origin));

  if (isRecoveryCallback && nextPath === PASSWORD_RESET_PATH) {
    response.cookies.set(
      PASSWORD_RECOVERY_SESSION_COOKIE,
      "1",
      getPasswordRecoveryCookieOptions(PASSWORD_RECOVERY_SESSION_MAX_AGE_SECONDS)
    );
  } else {
    clearRecoveryMarker(response);
  }

  return response;
}
