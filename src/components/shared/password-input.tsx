"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  leadingIcon?: React.ReactNode;
  toggleTabIndex?: number;
  wrapperClassName?: string;
};

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, leadingIcon, toggleTabIndex, wrapperClassName, ...props }, ref) => {
    const [isVisible, setIsVisible] = React.useState(false);

    return (
      <div className={cn("relative", wrapperClassName)}>
        {leadingIcon ? (
          <span className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#BFB4AA]">
            {leadingIcon}
          </span>
        ) : null}
        <input
          ref={ref}
          type={isVisible ? "text" : "password"}
          className={cn(leadingIcon ? "pl-10" : undefined, "pr-11", className)}
          {...props}
        />
        <button
          type="button"
          aria-label={isVisible ? "Hide password" : "Show password"}
          aria-pressed={isVisible}
          tabIndex={toggleTabIndex}
          onClick={() => setIsVisible((current) => !current)}
          className="absolute right-0 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-r-[var(--cs-r-lg)] text-[#8F8074] transition hover:bg-[#F5F2EE] hover:text-[#5B4A40] focus:outline-none focus:ring-2 focus:ring-[#C8A96B]/45"
        >
          {isVisible ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";
