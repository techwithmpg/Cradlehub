"use client";

import Link from "next/link";
import { useActionState, useCallback, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Lock, Mail } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { PasswordInput } from "@/components/shared/password-input";
import { GooglePersonalizedSignIn } from "./google-personalized-sign-in";
import { loginAction, type LoginState } from "./actions";
import { PASSWORD_UPDATED_LOGIN_MESSAGE } from "./messages";

const initialState: LoginState = {};

function CompactDivider() {
  return (
    <div className="flex items-center gap-3 py-0.5">
      <span aria-hidden="true" className="h-px flex-1 bg-[#EFE8E0]" />
      <span className="shrink-0 text-[11px] font-medium text-[#9C8878]">
        or continue with email
      </span>
      <span aria-hidden="true" className="h-px flex-1 bg-[#EFE8E0]" />
    </div>
  );
}

export function LoginForm({ passwordUpdated }: { passwordUpdated: boolean }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
  const visibleError = googleError ?? state.error;
  const clearGoogleError = useCallback(() => setGoogleError(null), []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F5F2EE] px-4 py-8 sm:px-6">
      <div className="w-full max-w-100">
        <div className="rounded-2xl border border-[#F0ECE5] bg-white p-5 shadow-[0_12px_36px_rgba(30,25,22,0.09),0_3px_10px_rgba(30,25,22,0.05)] sm:p-7">
          <div className="mb-5 flex flex-col items-center text-center">
            <BrandLogo size="md" variant="light" className="mb-3 w-36 sm:w-40" />
            <h1 className="font-display text-[22px] font-semibold leading-tight text-[#1E1916]">
              Welcome back
            </h1>
            <p className="mt-1 text-[12px] font-medium uppercase tracking-[0.12em] text-[#6B5D52]">
              Staff Portal
            </p>
          </div>

          <div className="flex flex-col gap-4">
            {passwordUpdated ? (
              <div className="flex items-start gap-2.5 rounded-lg border border-[#CFE8D7] bg-[#EFF8F1] px-3.5 py-3 text-[12.5px] text-[#28633A]">
                <CheckCircle2 className="mt-px h-4 w-4 shrink-0" />
                <span className="whitespace-pre-line">
                  {PASSWORD_UPDATED_LOGIN_MESSAGE}
                </span>
              </div>
            ) : null}

            {visibleError ? (
              <div
                key={visibleError}
                className="flex items-start gap-2.5 rounded-lg border border-[#EDCCCC] bg-[#F8EEEE] px-3.5 py-3 text-[12.5px] text-[#5A1A1A]"
                role={googleError ? "alert" : undefined}
              >
                <AlertCircle className="mt-px h-4 w-4 shrink-0 text-[#8A5A5A]" />
                <span className="whitespace-pre-line">{visibleError}</span>
              </div>
            ) : null}

            {googleClientId ? (
              <>
                <GooglePersonalizedSignIn
                  clientId={googleClientId}
                  onError={setGoogleError}
                />
                <CompactDivider />
              </>
            ) : null}

            <form
              action={formAction}
              className="flex flex-col gap-4"
              onFocusCapture={clearGoogleError}
              onSubmit={clearGoogleError}
            >
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="email"
                  className="text-[11.5px] font-semibold uppercase tracking-wide text-[#6B5D52]"
                >
                  Email address
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#BFB4AA]" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@cradlespa.com"
                    className={`auth-input h-11${state.fieldErrors?.email ? " is-error" : ""}`}
                  />
                </div>
                {state.fieldErrors?.email ? (
                  <p className="text-[11px] text-[#8A5A5A]">
                    {state.fieldErrors.email}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="password"
                  className="text-[11.5px] font-semibold uppercase tracking-wide text-[#6B5D52]"
                >
                  Password
                </label>
                <PasswordInput
                  id="password"
                  name="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  leadingIcon={<Lock className="h-4 w-4" aria-hidden="true" />}
                  toggleTabIndex={-1}
                  className={`auth-input h-11${state.fieldErrors?.password ? " is-error" : ""}`}
                />
                {state.fieldErrors?.password ? (
                  <p className="text-[11px] text-[#8A5A5A]">
                    {state.fieldErrors.password}
                  </p>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={pending}
                className="cs-btn cs-btn-primary cs-btn-lg mt-1 h-11 w-full justify-center"
              >
                {pending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  "Sign in"
                )}
              </button>

              <Link
                href="/forgot-password"
                className="inline-flex min-h-11 items-center self-center text-[12px] font-medium text-[#8A6F48] transition hover:text-[#5B4A40]"
              >
                Forgot password?
              </Link>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
