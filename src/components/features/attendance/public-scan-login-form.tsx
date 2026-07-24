"use client";

import type { FormEvent } from "react";
import { AlertCircle, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { PasswordInput } from "@/components/shared/password-input";
import type { FirstTimeScanFieldErrors } from "@/app/scan/actions";
import styles from "./public-scan-processor.module.css";

type PublicScanLoginFormProps = {
  email: string;
  password: string;
  pending?: boolean;
  error?: string | null;
  fieldErrors?: FirstTimeScanFieldErrors | null;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
};

export function PublicScanLoginForm({
  email,
  password,
  pending = false,
  error,
  fieldErrors,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}: PublicScanLoginFormProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pending) onSubmit();
  }

  return (
    <section className={styles.loginPanel} aria-live="polite">
      <BrandLogo mode="mark" size="sm" className={styles.brandMark} />

      <div className={styles.loginHeading}>
        <p className={styles.eyebrow}>Staff attendance</p>
        <h1>Connect this phone</h1>
        <p>
          This device is not signed in for Attendance. Sign in with your own staff account. The
          system will securely connect this phone and continue the scan automatically.
        </p>
      </div>

      <form className={styles.loginForm} onSubmit={handleSubmit}>
        {error ? (
          <div className={styles.loginErrorBox} role="alert">
            <AlertCircle size={17} aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className={styles.loginField}>
          <label htmlFor="attendance-scan-email">Email address</label>
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
              placeholder="you@cradlespa.com"
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

        <div className={styles.loginTrustNote}>
          <ShieldCheck size={17} aria-hidden="true" />
          <span>
            You normally need to do this only once. Scan once and do not refresh repeatedly.
          </span>
        </div>

        <button type="submit" className={styles.loginSubmitButton} disabled={pending}>
          {pending ? (
            <>
              <Loader2 size={17} className={styles.loginSpinner} aria-hidden="true" />
              Signing in and connecting…
            </>
          ) : (
            "Sign in, connect phone and finish scan"
          )}
        </button>
      </form>
    </section>
  );
}
