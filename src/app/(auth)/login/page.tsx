"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";
import { Leaf, Mail, Lock, Loader2, AlertCircle } from "lucide-react";

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">

      {/* ── Brand panel — desktop left side ───────────────────── */}
      <div className="hidden lg:flex lg:w-[44%] xl:w-[42%] flex-col justify-between p-12 xl:p-16 relative overflow-hidden bg-gradient-to-br from-[#10261D] via-[#163A2B] to-[#1A4030]">

        {/* Decorative radial glows */}
        <div className="pointer-events-none absolute -top-32 -left-32 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,#C8A96B_0%,transparent_70%)] opacity-[0.07]" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle,#C8A96B_0%,transparent_70%)] opacity-[0.06]" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C8A96B]/15 ring-1 ring-[#C8A96B]/25">
            <Leaf className="h-5 w-5 text-[#C8A96B]" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-display text-[15px] font-semibold tracking-wide text-white">
              Cradle
            </span>
            <span className="text-[10px] tracking-[0.12em] uppercase text-[#C8A96B]/65">
              Massage &amp; Wellness
            </span>
          </div>
        </div>

        {/* Headline + feature list */}
        <div className="relative z-10">
          <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-[#C8A96B] mb-4">
            Staff Portal
          </p>
          <h2 className="font-display text-3xl xl:text-4xl font-medium leading-snug text-white mb-5">
            Your workspace,
            <br />
            all in one place.
          </h2>
          <p className="text-[14px] leading-relaxed text-white/55 mb-10 max-w-xs">
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
                  <Leaf className="h-2.5 w-2.5 text-[#C8A96B]" />
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

      {/* ── Form panel — right / full on mobile ───────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-[#F5F2EE] px-5 py-14 sm:px-8">

        {/* Mobile-only logo */}
        <div className="flex flex-col items-center mb-8 lg:hidden">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#A67B5B] to-[#C4966E] shadow-[0_6px_20px_rgba(166,123,91,0.30)] mb-3">
            <Leaf className="h-6 w-6 text-white" />
          </div>
          <span className="font-display text-lg font-semibold text-[#1E1916]">
            Cradle Staff Portal
          </span>
        </div>

        <div className="w-full max-w-[400px]">

          {/* Desktop heading */}
          <div className="mb-7 hidden lg:block">
            <h1 className="font-display text-[22px] font-semibold text-[#1E1916] mb-1">
              Welcome back
            </h1>
            <p className="text-[13.5px] text-[#6B5D52]">
              Sign in to your staff workspace
            </p>
          </div>

          {/* Card */}
          <div className="rounded-2xl border border-[#F0ECE5] bg-white p-7 shadow-[0_12px_36px_rgba(30,25,22,0.09),0_3px_10px_rgba(30,25,22,0.05)]">
            <form action={formAction} className="flex flex-col gap-5">

              {/* Global error banner */}
              {state.error && (
                <div className="flex items-start gap-2.5 rounded-lg border border-[#EDCCCC] bg-[#F8EEEE] px-3.5 py-3 text-[12.5px] text-[#5A1A1A]">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-px text-[#8A5A5A]" />
                  <span>{state.error}</span>
                </div>
              )}

              {/* Email */}
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
                {state.fieldErrors?.email && (
                  <p className="text-[11px] text-[#8A5A5A]">{state.fieldErrors.email}</p>
                )}
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="password"
                  className="text-[11.5px] font-semibold uppercase tracking-wide text-[#6B5D52]"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#BFB4AA]" />
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className={`auth-input${state.fieldErrors?.password ? " is-error" : ""}`}
                  />
                </div>
                {state.fieldErrors?.password && (
                  <p className="text-[11px] text-[#8A5A5A]">{state.fieldErrors.password}</p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={pending}
                className="cs-btn cs-btn-primary cs-btn-lg w-full justify-center mt-1"
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
