"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useActionState,
  useCallback,
  useState,
} from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { PasswordInput } from "@/components/shared/password-input";
import { GooglePersonalizedSignIn } from "./google-personalized-sign-in";
import {
  loginAction,
  type LoginState,
} from "./actions";
import { PASSWORD_UPDATED_LOGIN_MESSAGE } from "./messages";
import styles from "./login-branding.module.css";

const initialState: LoginState = {};

function CompactDivider() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="h-px flex-1 bg-[#ECE7E0]" />

      <span className="shrink-0 text-[10.5px] font-medium text-[#97887B]">
        or continue with email
      </span>

      <span className="h-px flex-1 bg-[#ECE7E0]" />
    </div>
  );
}

export function LoginForm({
  passwordUpdated,
}: {
  passwordUpdated: boolean;
}) {
  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    loginAction,
    initialState
  );

  const [
    googleError,
    setGoogleError,
  ] = useState<string | null>(null);

  const googleClientId =
    process.env
      .NEXT_PUBLIC_GOOGLE_CLIENT_ID
      ?.trim();

  const visibleError =
    googleError ?? state.error;

  const clearGoogleError =
    useCallback(
      () => setGoogleError(null),
      []
    );

  return (
    <main className={styles.screen}>
      <div className={styles.shell}>

        {/* =========================
            MOBILE BRAND HEADER
        ========================== */}

        <div
          className={`${styles.mobileBrand} mb-3 flex items-center justify-center gap-3`}
        >
          <div
            className={`${styles.logoTile} size-[52px] rounded-[16px]`}
          >
            <Image
              src="/images/brand/cradle-logo-mark.png"
              alt="Cradle"
              width={44}
              height={44}
              priority
              className="size-[40px] object-contain"
            />
          </div>

          <div>
            <div className="text-[23px] font-bold leading-none tracking-[-0.035em] text-[#153A2D]">
              Cradle Hub
            </div>

            <div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#9A805E]">
              Team Workspace
            </div>
          </div>
        </div>

        {/* =========================
            DESKTOP BRAND HERO
        ========================== */}

        <section
          className={styles.desktopHero}
        >
          <div
            className={`${styles.desktopLogo} ${styles.logoTile} grid size-[112px] rounded-[32px]`}
          >
            <Image
              src="/images/brand/cradle-logo-mark.png"
              alt="Cradle"
              width={88}
              height={88}
              priority
              className="size-[84px] object-contain"
            />
          </div>

          <p className="mt-8 text-[10px] font-bold uppercase tracking-[0.22em] text-[#9A805E]">
            Cradle Wellness Living
          </p>

          <h1 className="mt-2 font-display text-[54px] font-semibold leading-none tracking-[-0.04em] text-[#153A2D]">
            Cradle Hub
          </h1>

          <p className="mt-4 max-w-[390px] text-[14px] leading-6 text-[#66776E]">
            Secure access to your operational workspace,
            schedules, attendance and daily responsibilities.
          </p>

          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#D9E2DA] bg-white/60 px-3.5 py-2 text-[11px] font-semibold text-[#476052]">
            <ShieldCheck size={14} />
            Secure team access
          </div>
        </section>

        {/* =========================
            LOGIN CARD
        ========================== */}

        <section
          className={`${styles.card} w-full rounded-[24px] border border-white/80 bg-white/95 p-4 shadow-[0_18px_60px_rgba(34,48,42,0.12),0_4px_15px_rgba(34,48,42,0.05)] backdrop-blur-xl sm:p-6`}
        >
          <div className="mb-3">
            <h1 className="font-display text-[24px] font-semibold leading-tight tracking-[-0.025em] text-[#211C18]">
              Welcome back
            </h1>

            <p className="mt-0.5 text-[11.5px] text-[#756A61]">
              Sign in to continue to Cradle Hub.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {passwordUpdated ? (
              <div className="flex items-start gap-2 rounded-xl border border-[#CFE8D7] bg-[#EFF8F1] px-3 py-2.5 text-[11px] text-[#28633A]">
                <CheckCircle2 className="mt-px size-3.5 shrink-0" />

                <span>
                  {PASSWORD_UPDATED_LOGIN_MESSAGE}
                </span>
              </div>
            ) : null}

            {visibleError ? (
              <div
                className="flex items-start gap-2 rounded-xl border border-[#EDCCCC] bg-[#F8EEEE] px-3 py-2.5 text-[11px] text-[#5A1A1A]"
                role={
                  googleError
                    ? "alert"
                    : undefined
                }
              >
                <AlertCircle className="mt-px size-3.5 shrink-0" />

                <span>
                  {visibleError}
                </span>
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
              className="flex flex-col gap-3"
              onFocusCapture={
                clearGoogleError
              }
              onSubmit={
                clearGoogleError
              }
            >
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="email"
                  className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#625A54]"
                >
                  Email address
                </label>

                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#B6AAA0]" />

                  <input
                    id="email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@cradlespa.com"
                    className={`auth-input h-11 rounded-xl${state.fieldErrors?.email ? " is-error" : ""}`}
                  />
                </div>

                {state.fieldErrors?.email ? (
                  <p className="text-[10px] text-[#8A5A5A]">
                    {state.fieldErrors.email}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="password"
                  className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#625A54]"
                >
                  Password
                </label>

                <PasswordInput
                  id="password"
                  name="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  leadingIcon={
                    <Lock
                      className="size-4"
                      aria-hidden="true"
                    />
                  }
                  toggleTabIndex={-1}
                  className={`auth-input h-11 rounded-xl${state.fieldErrors?.password ? " is-error" : ""}`}
                />

                {state.fieldErrors?.password ? (
                  <p className="text-[10px] text-[#8A5A5A]">
                    {state.fieldErrors.password}
                  </p>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={pending}
                className="cs-btn cs-btn-primary mt-0.5 h-11 w-full justify-center rounded-xl text-[13px] font-semibold shadow-[0_6px_18px_rgba(22,58,43,0.15)]"
              >
                {pending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  "Sign in"
                )}
              </button>

              <Link
                href="/forgot-password"
                className="flex min-h-9 items-center justify-center text-[11.5px] font-medium text-[#846B49] transition hover:text-[#5B4A40]"
              >
                Forgot password?
              </Link>
            </form>
          </div>

          <div className="mt-1 border-t border-[#F0EBE5] pt-2.5 text-center text-[9px] text-[#A09185]">
            Cradle Wellness Living
          </div>
        </section>
      </div>
    </main>
  );
}