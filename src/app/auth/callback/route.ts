import { NextRequest, NextResponse } from "next/server";
import {
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
  const providerError = requestUrl.searchParams.get("error_description");
  const nextPath = sanitizeAuthRedirectPath(
    requestUrl.searchParams.get("next"),
    "/select-workspace"
  );

  if (providerError) {
    logError("auth.callback_provider_error", { error: providerError });
    return NextResponse.redirect(new URL("/login", requestUrl.origin));
  }

  if (!code && !(tokenHash && type === "recovery")) {
    return NextResponse.redirect(new URL("/login", requestUrl.origin));
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
    return NextResponse.redirect(new URL("/login", requestUrl.origin));
  }

  const response = NextResponse.redirect(new URL(nextPath, requestUrl.origin));

  if (nextPath === PASSWORD_RESET_PATH) {
    response.cookies.set(PASSWORD_RECOVERY_SESSION_COOKIE, "1", {
      httpOnly: true,
      maxAge: 10 * 60,
      path: PASSWORD_RESET_PATH,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  return response;
}
