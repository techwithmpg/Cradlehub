"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, Lock } from "lucide-react";
import { PasswordInput } from "@/components/shared/password-input";
import { PASSWORD_REQUIREMENTS } from "@/lib/auth/password-policy";
import { createClient } from "@/lib/supabase/client";
import { updatePasswordAction, type ResetPasswordState } from "./actions";

const initialState: ResetPasswordState = {};

type RecoverySessionStatus = "checking" | "valid" | "invalid";

export function ResetPasswordForm({
  email,
  initialHasRecoverySession,
}: {
  email: string | null;
  initialHasRecoverySession: boolean;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(updatePasswordAction, initialState);
  const [sessionStatus, setSessionStatus] =
    useState<RecoverySessionStatus>("checking");
  const [verifiedEmail, setVerifiedEmail] = useState(email);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function verifyRecoverySession() {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (!isMounted) return;

      if (initialHasRecoverySession && user && !error) {
        setVerifiedEmail(user.email ?? email);
        setSessionStatus("valid");
        return;
      }

      setSessionStatus("invalid");
    }

    void verifyRecoverySession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted || !initialHasRecoverySession) return;

      if (event === "PASSWORD_RECOVERY" || session?.user) {
        setVerifiedEmail(session?.user.email ?? email);
        setSessionStatus("valid");
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [email, initialHasRecoverySession]);

  useEffect(() => {
    if (state.status !== "success") return;

    const timeoutId = window.setTimeout(() => {
      router.replace("/login?passwordUpdated=true");
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [router, state.status]);

  if (sessionStatus === "checking") {
    return (
      <div
        role="status"
        className="flex items-start gap-2.5 rounded-lg border border-[#F0ECE5] bg-[#FBFAF8] px-3.5 py-3 text-[12.5px] text-[#6B5D52]"
      >
        <Loader2 className="mt-px h-4 w-4 shrink-0 animate-spin text-[#8A6F48]" />
        <span>Checking your reset link…</span>
      </div>
    );
  }

  if (sessionStatus === "invalid") {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2.5 rounded-lg border border-[#EDCCCC] bg-[#F8EEEE] px-3.5 py-3 text-[12.5px] text-[#5A1A1A]">
          <AlertCircle className="mt-px h-4 w-4 shrink-0 text-[#8A5A5A]" />
          <span>
            This password-reset link is no longer valid.
            <br />
            <br />
            Request a new link to continue.
          </span>
        </div>
        <Link
          href="/forgot-password"
          className="cs-btn cs-btn-primary cs-btn-lg w-full justify-center"
        >
          Request New Reset Link
        </Link>
        <Link
          href="/login"
          className="inline-flex w-full justify-center text-[12.5px] font-medium text-[#6B5D52] transition hover:text-[#1E1916]"
        >
          Back to Login
        </Link>
      </div>
    );
  }

  if (state.status === "success") {
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-2.5 rounded-lg border border-[#CFE8D7] bg-[#EFF8F1] px-3.5 py-3 text-[12.5px] text-[#28633A]">
          <CheckCircle2 className="mt-px h-4 w-4 shrink-0" />
          <span>{state.message}</span>
        </div>
        <div className="flex items-center justify-center gap-2 text-[12.5px] text-[#6B5D52]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Returning to sign in…
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {verifiedEmail ? (
        <p className="m-0 rounded-lg border border-[#F0ECE5] bg-[#FBFAF8] px-3.5 py-3 text-[12.5px] text-[#6B5D52]">
          Updating password for{" "}
          <span className="font-semibold text-[#1E1916]">{verifiedEmail}</span>
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
        <ul className="mt-1 grid gap-1 text-[11px] text-[#8F8074]">
          {PASSWORD_REQUIREMENTS.map((requirement) => (
            <li key={requirement}>{requirement}</li>
          ))}
        </ul>
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
