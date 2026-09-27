"use client";

import { AlertCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { StaffPrimaryAction } from "./primary-action";

type StaffErrorStateProps = {
  title?: string;
  message: string;
  isUnconfirmedOutcome?: boolean;
  onRetry?: () => void;
  retryLabel?: string;
  onSecondaryAction?: () => void;
  secondaryLabel?: string;
};

export function StaffErrorState({
  title = "Something went wrong",
  message,
  isUnconfirmedOutcome = false,
  onRetry,
  retryLabel = "Try again",
  onSecondaryAction,
  secondaryLabel,
}: StaffErrorStateProps) {
  const Icon = isUnconfirmedOutcome ? AlertTriangle : AlertCircle;

  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-2xl border border-[#F5C2C4] bg-[#FDEBEC]/60 p-6 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FDEBEC] text-[#9B1C20] mb-3">
        <Icon size={24} aria-hidden="true" />
      </div>

      <h2 className="text-base font-semibold text-[#9B1C20] mb-1">
        {title}
      </h2>

      <p className="max-w-xs text-xs text-[#475569] mb-5 leading-relaxed">
        {message}
      </p>

      {isUnconfirmedOutcome && (
        <div className="mb-4 rounded-lg bg-[#FFF4DB] border border-[#FEE199] p-3 text-left text-xs text-[#654600] w-full">
          <p className="font-semibold mb-0.5">Outcome not yet confirmed</p>
          <p className="text-[11px] leading-normal">
            Your request may have reached the server. Check your current schedule or work list before retrying to prevent duplicates.
          </p>
        </div>
      )}

      <div className="flex w-full flex-col gap-2">
        {onRetry ? (
          <StaffPrimaryAction
            variant="primary"
            onClick={onRetry}
            className="w-full"
          >
            <span className="flex items-center justify-center gap-2">
              <RefreshCw size={16} aria-hidden="true" />
              <span>{retryLabel}</span>
            </span>
          </StaffPrimaryAction>
        ) : null}

        {onSecondaryAction && secondaryLabel ? (
          <StaffPrimaryAction
            variant="secondary"
            onClick={onSecondaryAction}
            className="w-full"
          >
            {secondaryLabel}
          </StaffPrimaryAction>
        ) : null}
      </div>
    </div>
  );
}
