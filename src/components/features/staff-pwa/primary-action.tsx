"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import type { ActionButtonVariant } from "./types";
import { cn } from "@/lib/utils";

type StaffPrimaryActionProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ActionButtonVariant;
  loading?: boolean;
  loadingText?: string;
  disabledReason?: string;
  fullWidth?: boolean;
};

export function StaffPrimaryAction({
  children,
  variant = "primary",
  loading = false,
  loadingText,
  disabled = false,
  disabledReason,
  fullWidth = true,
  className,
  ...rest
}: StaffPrimaryActionProps) {
  let variantClasses =
    "bg-[#163A2B] text-white hover:bg-[#10261D] active:bg-[#0D1E16] shadow-xs";

  switch (variant) {
    case "primary":
      variantClasses =
        "bg-[#163A2B] text-white hover:bg-[#10261D] active:bg-[#0D1E16] shadow-xs";
      break;
    case "secondary":
      variantClasses =
        "bg-[#F7F3EB] text-[#1E293B] border border-[#EAE4DC] hover:bg-[#EDE8DE] active:bg-[#E2DCCE]";
      break;
    case "outline":
      variantClasses =
        "bg-transparent text-[#163A2B] border-2 border-[#163A2B] hover:bg-[#163A2B]/5 active:bg-[#163A2B]/10";
      break;
    case "destructive":
      variantClasses =
        "bg-[#9B1C20] text-white hover:bg-[#7D1619] active:bg-[#631114] shadow-xs";
      break;
    case "ghost":
      variantClasses =
        "bg-transparent text-[#1E293B] hover:bg-black/5 active:bg-black/10";
      break;
  }

  const isActuallyDisabled = disabled || loading;

  return (
    <div className={cn("flex flex-col gap-1", fullWidth && "w-full")}>
      <button
        type="button"
        disabled={isActuallyDisabled}
        aria-disabled={isActuallyDisabled ? "true" : undefined}
        className={cn(
          "relative flex min-h-[48px] items-center justify-center rounded-xl px-5 py-3 text-base font-semibold transition duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#163A2B] focus-visible:ring-offset-2 select-none",
          fullWidth && "w-full",
          isActuallyDisabled
            ? "cursor-not-allowed opacity-50 shadow-none pointer-events-none"
            : variantClasses,
          className
        )}
        {...rest}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            <span>{loadingText ?? children}</span>
          </span>
        ) : (
          children
        )}
      </button>

      {disabled && disabledReason ? (
        <span className="text-center text-xs text-[#64748B] px-1" role="note">
          {disabledReason}
        </span>
      ) : null}
    </div>
  );
}
