"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import {
  getStaffAccountDiagnosticAction,
  sendStaffPasswordRecoveryAction,
} from "@/app/(dashboard)/owner/staff/account-access-actions";
import { Button } from "@/components/ui/button";
import type { StaffAccountDiagnostic } from "@/lib/auth/staff-account-diagnostics";

type StaffAccountAccessPanelProps = {
  staffId: string;
};

const statusCopy: Record<StaffAccountDiagnostic["primaryStatus"], string> = {
  ready: "Ready",
  attention: "Needs attention",
  blocked: "Blocked",
};

export function StaffAccountAccessPanel({ staffId }: StaffAccountAccessPanelProps) {
  const [diagnostic, setDiagnostic] = React.useState<StaffAccountDiagnostic | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [isChecking, startChecking] = React.useTransition();
  const [isSending, startSending] = React.useTransition();

  const checkAccess = React.useCallback(() => {
    setError(null);
    setMessage(null);
    startChecking(() => {
      void getStaffAccountDiagnosticAction({ staffId }).then((result) => {
        if (result.success) {
          setDiagnostic(result.diagnostic);
          return;
        }
        setError(result.error);
      });
    });
  }, [staffId]);

  const sendRecovery = React.useCallback(() => {
    setError(null);
    setMessage(null);
    startSending(() => {
      void sendStaffPasswordRecoveryAction({ staffId }).then((result) => {
        if (result.success) {
          setMessage(result.message);
          return;
        }
        setError(result.error);
      });
    });
  }, [staffId]);

  return (
    <section className="mt-5 rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="m-0 text-sm font-semibold text-[var(--cs-text)]">Account Access</h3>
          <p className="m-0 mt-0.5 text-xs text-[var(--cs-text-muted)]">
            Owner-only login diagnostics
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={checkAccess}
          disabled={isChecking}
          className="border-[var(--cs-border)] bg-[var(--cs-surface)]"
        >
          {isChecking ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="size-3.5" aria-hidden="true" />
          )}
          Check
        </Button>
      </div>

      {error ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-[var(--cs-error-border)] bg-[var(--cs-error-bg)] px-3 py-2 text-xs text-[var(--cs-error-text)]">
          <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      {message ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-[var(--cs-success-border)] bg-[var(--cs-success-bg)] px-3 py-2 text-xs text-[var(--cs-success-text)]">
          <CheckCircle2 className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          <span>{message}</span>
        </div>
      ) : null}

      {!diagnostic ? (
        <p className="m-0 mt-3 text-xs leading-relaxed text-[var(--cs-text-muted)]">
          Check the selected staff member before sending a recovery link.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] px-3 py-2">
            <span className="text-xs font-medium text-[var(--cs-text-muted)]">Status</span>
            <span
              className={[
                "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold",
                diagnostic.primaryStatus === "ready"
                  ? "bg-[var(--cs-success-bg)] text-[var(--cs-success-text)]"
                  : diagnostic.primaryStatus === "attention"
                    ? "bg-[var(--cs-warning-bg)] text-[var(--cs-warning-text)]"
                    : "bg-[var(--cs-error-bg)] text-[var(--cs-error-text)]",
              ].join(" ")}
            >
              {diagnostic.primaryStatus === "ready" ? (
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
              ) : (
                <ShieldAlert className="size-3.5" aria-hidden="true" />
              )}
              {statusCopy[diagnostic.primaryStatus]}
            </span>
          </div>

          <dl className="space-y-2 text-xs">
            <AccessRow label="Auth linked" value={diagnostic.authLinked ? "Yes" : "No"} />
            <AccessRow label="Auth email" value={diagnostic.authEmail ?? "Unavailable"} />
            <AccessRow
              label="Email confirmed"
              value={diagnostic.emailConfirmed ? "Yes" : "No"}
            />
            <AccessRow label="Last sign-in" value={formatDateTime(diagnostic.lastSignInAt)} />
            <AccessRow label="CRM access" value={diagnostic.canOpenCrm ? "Yes" : "No"} />
          </dl>

          {diagnostic.issues.length > 0 ? (
            <ul className="m-0 space-y-2 p-0">
              {diagnostic.issues.map((issue) => (
                <li
                  key={issue.code}
                  className="flex items-start gap-2 rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] px-3 py-2 text-xs text-[var(--cs-text-secondary)]"
                >
                  <AlertTriangle
                    className={[
                      "mt-px size-3.5 shrink-0",
                      issue.severity === "critical"
                        ? "text-[var(--cs-error-text)]"
                        : "text-[var(--cs-warning-text)]",
                    ].join(" ")}
                    aria-hidden="true"
                  />
                  <span>{issue.message}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {diagnostic.recommendedActions.length > 0 ? (
            <div className="rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] px-3 py-2">
              <p className="m-0 text-xs font-semibold text-[var(--cs-text)]">Next step</p>
              <p className="m-0 mt-1 text-xs leading-relaxed text-[var(--cs-text-muted)]">
                {diagnostic.recommendedActions[0]}
              </p>
            </div>
          ) : null}

          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={sendRecovery}
            disabled={isSending || !diagnostic.recoveryAvailable}
            className="w-full justify-start border-[var(--cs-border)] bg-[var(--cs-surface)] text-[var(--cs-text-secondary)]"
          >
            {isSending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <KeyRound className="size-4" aria-hidden="true" />
            )}
            Send Password Reset
          </Button>
        </div>
      )}
    </section>
  );
}

function AccessRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-[var(--cs-text-muted)]">{label}</dt>
      <dd className="m-0 max-w-[58%] break-words text-right font-semibold text-[var(--cs-text)]">
        {value}
      </dd>
    </div>
  );
}

function formatDateTime(value: string | null): string {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
