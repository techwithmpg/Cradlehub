"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Lock, Mail } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { PasswordInput } from "@/components/shared/password-input";
import { loginAction, type LoginState } from "./actions";
import { PASSWORD_UPDATED_LOGIN_MESSAGE } from "./messages";

const initialState: LoginState = {};

export function LoginForm({ passwordUpdated }: { passwordUpdated: boolean }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#10261D] via-[#163A2B] to-[#1A4030] p-12 lg:flex lg:w-[44%] xl:w-[42%] xl:p-16">
        <div className="pointer-events-none absolute -left-32 -top-32 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,#C8A96B_0%,transparent_70%)] opacity-[0.07]" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle,#C8A96B_0%,transparent_70%)] opacity-[0.06]" />

        <div className="relative z-10">
          <BrandLogo size="lg" variant="dark" className="w-48 md:w-60 lg:w-72" />
        </div>

        <div className="relative z-10">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#C8A96B]">
            Staff Portal
          </p>
          <h2 className="mb-5 font-display text-3xl font-medium leading-snug text-white xl:text-4xl">
            Your workspace,
            <br />
            all in one place.
          </h2>
          <p className="mb-10 max-w-xs text-[14px] leading-relaxed text-white/55">
            Manage bookings, schedules, and client records — built for the Cradle team.
          </p>

          <ul className="flex flex-col gap-3">
            {[
              "Role-based workspaces",
              "Booking & schedule management",
              "Staff & client records",
            ].map((item) => (
              <li key={item} className="flex items-center gap-3 text-[13px] text-white/65">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#C8A96B]/18">
                  <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5" aria-hidden="true">
                    <path d="M2 6l3 3 5-5" stroke="#C8A96B" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-[11px] text-white/28">
          &copy; {new Date().getFullYear()} Cradle Massage &amp; Wellness Spa
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center bg-[#F5F2EE] px-5 py-14 sm:px-8">
        <div className="mb-8 flex flex-col items-center lg:hidden">
          <BrandLogo size="md" variant="light" className="mb-3 w-40 sm:w-44" />
          <span className="mt-1 text-[12px] font-medium uppercase tracking-[0.12em] text-[#6B5D52]">
            Staff Portal
          </span>
        </div>

        <div className="w-full max-w-100">
          <div className="mb-7 hidden lg:block">
            <h1 className="mb-1 font-display text-[22px] font-semibold text-[#1E1916]">
              Welcome back
            </h1>
            <p className="text-[13.5px] text-[#6B5D52]">
              Sign in to your staff workspace
            </p>
          </div>

          <div className="rounded-2xl border border-[#F0ECE5] bg-white p-7 shadow-[0_12px_36px_rgba(30,25,22,0.09),0_3px_10px_rgba(30,25,22,0.05)]">
            <form action={formAction} className="flex flex-col gap-5">
              {passwordUpdated ? (
                <div className="flex items-start gap-2.5 rounded-lg border border-[#CFE8D7] bg-[#EFF8F1] px-3.5 py-3 text-[12.5px] text-[#28633A]">
                  <CheckCircle2 className="mt-px h-4 w-4 shrink-0" />
                  <span className="whitespace-pre-line">
                    {PASSWORD_UPDATED_LOGIN_MESSAGE}
                  </span>
                </div>
              ) : null}

              {state.error ? (
                <div className="flex items-start gap-2.5 rounded-lg border border-[#EDCCCC] bg-[#F8EEEE] px-3.5 py-3 text-[12.5px] text-[#5A1A1A]">
                  <AlertCircle className="mt-px h-4 w-4 shrink-0 text-[#8A5A5A]" />
                  <span className="whitespace-pre-line">{state.error}</span>
                </div>
              ) : null}

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
                    autoFocus
                    placeholder="you@cradlespa.com"
                    className={`auth-input${state.fieldErrors?.email ? " is-error" : ""}`}
                  />
                </div>
                {state.fieldErrors?.email ? (
                  <p className="text-[11px] text-[#8A5A5A]">
                    {state.fieldErrors.email}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-3">
                  <label
                    htmlFor="password"
                    className="text-[11.5px] font-semibold uppercase tracking-wide text-[#6B5D52]"
                  >
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-[12px] font-medium text-[#8A6F48] transition hover:text-[#5B4A40]"
                  >
                    Forgot password?
                  </Link>
                </div>
                <PasswordInput
                  id="password"
                  name="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  leadingIcon={<Lock className="h-4 w-4" aria-hidden="true" />}
                  className={`auth-input${state.fieldErrors?.password ? " is-error" : ""}`}
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
                className="cs-btn cs-btn-primary cs-btn-lg mt-1 w-full justify-center"
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
            </form>
          </div>

          <p className="mt-5 text-center text-[11.5px] text-[#BFB4AA]">
            Cradle Massage &amp; Wellness Spa — Staff Portal
          </p>
        </div>
      </div>
    </div>
  );
}
