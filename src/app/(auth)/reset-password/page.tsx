import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/shared/brand-logo";
import {
  PASSWORD_RECOVERY_SESSION_COOKIE,
  PASSWORD_RESET_PATH,
} from "@/lib/auth/auth-redirects";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./reset-password-form";

type ResetPasswordSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

function getSearchParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function redirectRecoveryParamsToCallback(params: {
  code: string | null;
  tokenHash: string | null;
  type: string | null;
}) {
  const callbackParams = new URLSearchParams();
  callbackParams.set("next", PASSWORD_RESET_PATH);

  if (params.code) {
    callbackParams.set("code", params.code);
  } else if (params.tokenHash && params.type === "recovery") {
    callbackParams.set("token_hash", params.tokenHash);
    callbackParams.set("type", params.type);
  }

  redirect(`/auth/callback?${callbackParams.toString()}`);
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: ResetPasswordSearchParams;
}) {
  const params = await searchParams;
  const code = getSearchParam(params.code);
  const tokenHash = getSearchParam(params.token_hash);
  const type = getSearchParam(params.type);

  if (code || (tokenHash && type === "recovery")) {
    redirectRecoveryParamsToCallback({ code, tokenHash, type });
  }

  const hasProviderError =
    Boolean(getSearchParam(params.error)) || Boolean(getSearchParam(params.error_description));
  const cookieStore = await cookies();
  const hasRecoverySession =
    cookieStore.get(PASSWORD_RECOVERY_SESSION_COOKIE)?.value === "1";
  let email: string | null = null;
  let hasValidRecoverySession = false;

  if (hasRecoverySession && !hasProviderError) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    email = user?.email ?? null;
    hasValidRecoverySession = Boolean(user);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F5F2EE] px-5 py-14 sm:px-8">
      <div className="w-full max-w-100">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandLogo size="md" variant="light" className="mb-3 w-40 sm:w-44" />
          <span className="mt-1 text-[12px] font-medium uppercase tracking-[0.12em] text-[#6B5D52]">
            Staff Portal
          </span>
        </div>

        <div className="rounded-2xl border border-[#F0ECE5] bg-white p-7 shadow-[0_12px_36px_rgba(30,25,22,0.09),0_3px_10px_rgba(30,25,22,0.05)]">
          <div className="mb-6">
            <h1 className="mb-1 font-display text-[22px] font-semibold text-[#1E1916]">
              Choose a new password
            </h1>
            <p className="m-0 text-[13.5px] leading-relaxed text-[#6B5D52]">
              Use a fresh password for your CradleHub staff account.
            </p>
          </div>

          <ResetPasswordForm
            email={email}
            initialHasRecoverySession={hasValidRecoverySession}
          />
        </div>
      </div>
    </main>
  );
}
