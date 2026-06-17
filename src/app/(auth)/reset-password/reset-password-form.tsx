"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Lock } from "lucide-react";
import { PasswordInput } from "@/components/shared/password-input";
import { updatePasswordAction, type ResetPasswordState } from "./actions";

const initialState: ResetPasswordState = {};

export function ResetPasswordForm({ email }: { email: string | null }) {
  const [state, formAction, pending] = useActionState(updatePasswordAction, initialState);

  if (state.status === "success") {
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-2.5 rounded-lg border border-[#CFE8D7] bg-[#EFF8F1] px-3.5 py-3 text-[12.5px] text-[#28633A]">
          <CheckCircle2 className="mt-px h-4 w-4 shrink-0" />
          <span>{state.message}</span>
        </div>
        <Link href="/login" className="cs-btn cs-btn-primary cs-btn-lg w-full justify-center">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {email ? (
        <p className="m-0 rounded-lg border border-[#F0ECE5] bg-[#FBFAF8] px-3.5 py-3 text-[12.5px] text-[#6B5D52]">
          Updating password for <span className="font-semibold text-[#1E1916]">{email}</span>
        </p>
      ) : null}

      {state.error ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-[#EDCCCC] bg-[#F8EEEE] px-3.5 py-3 text-[12.5px] text-[#5A1A1A]">
          <AlertCircle className="mt-px h-4 w-4 shrink-0 text-[#8A5A5A]" />
          <span>{state.error}</span>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="password"
          className="text-[11.5px] font-semibold uppercase tracking-wide text-[#6B5D52]"
        >
          New password
        </label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          leadingIcon={<Lock className="h-4 w-4" aria-hidden="true" />}
          className={`auth-input${state.fieldErrors?.password ? " is-error" : ""}`}
        />
        {state.fieldErrors?.password ? (
          <p className="text-[11px] text-[#8A5A5A]">{state.fieldErrors.password}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="confirmPassword"
          className="text-[11.5px] font-semibold uppercase tracking-wide text-[#6B5D52]"
        >
          Confirm password
        </label>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          placeholder="Repeat new password"
          leadingIcon={<Lock className="h-4 w-4" aria-hidden="true" />}
          className={`auth-input${state.fieldErrors?.confirmPassword ? " is-error" : ""}`}
        />
        {state.fieldErrors?.confirmPassword ? (
          <p className="text-[11px] text-[#8A5A5A]">
            {state.fieldErrors.confirmPassword}
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
            Updating password...
          </>
        ) : (
          "Update password"
        )}
      </button>
    </form>
  );
}
