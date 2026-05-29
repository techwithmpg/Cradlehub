"use client";

import * as React from "react";

const Switch = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<"button"> & {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    disabled?: boolean;
  }
>(({ checked = false, onCheckedChange, disabled, ...props }, ref) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      ref={ref}
      className={[
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cs-sand)] focus-visible:ring-offset-2",
        checked ? "bg-[var(--cs-sand)]" : "bg-[var(--cs-border-strong)]",
        disabled && "cursor-not-allowed opacity-50",
      ].join(" ")}
      {...props}
    >
      <span
        className={[
          "pointer-events-none block size-5 rounded-full bg-white shadow-lg ring-0 transition-transform",
          checked ? "translate-x-5" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  );
});

Switch.displayName = "Switch";

export { Switch };
