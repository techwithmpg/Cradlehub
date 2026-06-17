"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import {
  requestPasswordResetAction,
  type ForgotPasswordState,
} from "./actions";

const initialState: ForgotPasswordState = {};

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(
    requestPasswordResetAction,
    initialState
  );

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
              Reset password
            </h1>
            <p className="m-0 text-[13.5px] leading-relaxed text-[#6B5D52]">
              Enter your staff email address and we will send a secure reset link.
            </p>
          </div>

          {state.status === "success" && state.message ? (
            <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-[#CFE8D7] bg-[#EFF8F1] px-3.5 py-3 text-[12.5px] text-[#28633A]">
              <CheckCircle2 className="mt-px h-4 w-4 shrink-0" />
              <span className="whitespace-pre-line">{state.message}</span>
            </div>
          ) : null}

          {state.error ? (
            <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-[#EDCCCC] bg-[#F8EEEE] px-3.5 py-3 text-[12.5px] text-[#5A1A1A]">
              <AlertCircle className="mt-px h-4 w-4 shrink-0 text-[#8A5A5A]" />
              <span>{state.error}</span>
            </div>
          ) : null}

          <form action={formAction} className="flex flex-col gap-5">
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
                <p className="flex items-center gap-1 text-[11px] text-[#8A5A5A]">
                  <AlertCircle className="size-3" aria-hidden="true" />
                  {state.fieldErrors.email}
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
                  Sending link...
                </>
              ) : (
                "Send reset link"
              )}
            </button>
          </form>

          <Link
            href="/login"
            className="mt-5 inline-flex items-center gap-2 text-[12.5px] font-medium text-[#6B5D52] transition hover:text-[#1E1916]"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Back to sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
