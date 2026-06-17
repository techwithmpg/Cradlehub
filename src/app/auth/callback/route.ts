import { NextRequest, NextResponse } from "next/server";
import { sanitizeAuthRedirectPath } from "@/lib/auth/auth-redirects";
import { logError } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const providerError = requestUrl.searchParams.get("error_description");
  const nextPath = sanitizeAuthRedirectPath(
    requestUrl.searchParams.get("next"),
    "/select-workspace"
  );

  if (providerError) {
    logError("auth.callback_provider_error", { error: providerError });
    return NextResponse.redirect(new URL("/login", requestUrl.origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login", requestUrl.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    logError("auth.callback_code_exchange_failed", { error });
    return NextResponse.redirect(new URL("/login", requestUrl.origin));
  }

  return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
}
