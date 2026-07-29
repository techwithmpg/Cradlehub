"use client";

import type { FormEvent } from "react";
import { AlertCircle, Copy, Loader2, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/shared/brand-logo";
import { PasswordInput } from "@/components/shared/password-input";
import type { FirstTimeScanFieldErrors } from "@/app/scan/actions";
import type { PublicScanResult } from "@/lib/attendance/types";
import styles from "./public-scan-processor.module.css";

type PublicScanLoginFormProps = {
  email: string;
  password: string;
  pending?: boolean;
  error?: string | null;
  fieldErrors?: FirstTimeScanFieldErrors | null;
  issueResult?: PublicScanResult | null;
  requestId: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
};

function receipt(result: PublicScanResult | null, requestId: string): string {
  return (result?.scanEventId ?? result?.operationId ?? requestId)
    .replaceAll("-", "")
    .slice(-8)
    .toUpperCase();
}

export function PublicScanLoginForm({
  email,
  password,
  pending = false,
  error,
  fieldErrors,
  issueResult,
  requestId,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}: PublicScanLoginFormProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pending) onSubmit();
  }

  const problemCode = issueResult?.reasonCode?.toUpperCase() ?? "PHONE_NOT_CONNECTED";
  const supportReceipt = receipt(issueResult ?? null, requestId);
  const supportText = [
    "Attendance phone connection",
    `Code: ${problemCode}`,
    `Receipt: ${supportReceipt}`,
    "Attendance changed: No",
  ].join("\n");

  async function copySupportDetails() {
    await navigator.clipboard.writeText(supportText);
    toast.success("Attendance support details copied.");
  }

  return (
    <section className={styles.loginPanel} aria-live="polite">
      <BrandLogo mode="mark" size="sm" className={styles.brandMark} />

      <div className={styles.loginHeading}>
        <p className={styles.eyebrow}>Attendance connection</p>
        <h1>Connect this phone</h1>
        <p>Sign in once to connect this browser and continue your original Attendance scan.</p>
      </div>

      <form className={styles.loginForm} onSubmit={handleSubmit}>
        {error ? (
          <div className={styles.loginErrorBox} role="alert">
            <AlertCircle size={17} aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className={styles.loginField}>
          <label htmlFor="attendance-scan-email">Your staff email</label>
          <div className={styles.loginInputWrap}>
            <Mail className={styles.loginInputIcon} size={17} aria-hidden="true" />
            <input
              id="attendance-scan-email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              disabled={pending}
              onChange={(event) => onEmailChange(event.target.value)}
              className={fieldErrors?.email ? styles.loginInputError : styles.loginInput}
              placeholder="Your staff email"
            />
          </div>
          {fieldErrors?.email ? <small>{fieldErrors.email}</small> : null}
        </div>

        <div className={styles.loginField}>
          <label htmlFor="attendance-scan-password">Password</label>
          <PasswordInput
            id="attendance-scan-password"
            name="password"
            autoComplete="current-password"
            value={password}
            disabled={pending}
            onChange={(event) => onPasswordChange(event.target.value)}
            leadingIcon={<Lock className="h-4 w-4" aria-hidden="true" />}
            className={fieldErrors?.password ? styles.loginInputError : styles.loginInput}
            placeholder="Password"
          />
          {fieldErrors?.password ? <small>{fieldErrors.password}</small> : null}
        </div>

        <button type="submit" className={styles.loginSubmitButton} disabled={pending}>
          {pending ? (
            <>
              <Loader2 size={17} className={styles.loginSpinner} aria-hidden="true" />
              Connecting this phone…
            </>
          ) : (
            "Connect phone and finish scan"
          )}
        </button>
      </form>

      <details className="w-full rounded-xl border border-stone-200 bg-white p-3 text-left text-sm text-stone-700">
        <summary className="cursor-pointer font-semibold text-stone-900">Need help?</summary>
        <div className="mt-3 grid gap-2">
          <span>Problem code: {problemCode}</span>
          <span>Scan receipt: {supportReceipt}</span>
          <span>Do not refresh or scan repeatedly.</span>
          <span>Keep browser cookies and site data enabled so this phone stays connected.</span>
          <button
            type="button"
            onClick={copySupportDetails}
            className="mt-1 inline-flex w-fit items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 font-semibold"
          >
            <Copy size={15} aria-hidden="true" /> Copy support details
          </button>
        </div>
      </details>
    </section>
  );
}
