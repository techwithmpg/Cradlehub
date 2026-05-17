import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function FieldRow({
  label,
  htmlFor,
  helperText,
  children,
}: {
  label: string;
  htmlFor?: string;
  helperText?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      {htmlFor ? (
        <Label
          htmlFor={htmlFor}
          className="text-sm font-semibold text-[var(--cs-text)]"
        >
          {label}
        </Label>
      ) : (
        <div className="text-sm font-semibold text-[var(--cs-text)]">
          {label}
        </div>
      )}
      {children}
      {helperText ? (
        <p className="text-xs leading-5 text-[var(--cs-text-muted)]">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}

export function TextInputField({
  label,
  name,
  defaultValue,
  type = "text",
  min,
  max,
  helperText,
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: "text" | "time" | "number";
  min?: number;
  max?: number;
  helperText?: string;
}) {
  const id = `manager-settings-${name}`;

  return (
    <FieldRow label={label} htmlFor={id} helperText={helperText}>
      <Input
        id={id}
        name={name}
        type={type}
        min={min}
        max={max}
        defaultValue={defaultValue}
        className="h-10 border-[var(--cs-border)] bg-[var(--cs-surface)] text-sm"
      />
    </FieldRow>
  );
}

export function CheckboxSwitch({
  name,
  label,
  defaultChecked,
  helperText,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
  helperText?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-[var(--cs-r-md)] border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-3">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-6 w-11 shrink-0 rounded-full bg-[var(--cs-border-strong)] p-0.5 transition peer-checked:bg-[#7C3AED]"
      >
        <span className="size-5 rounded-full bg-white shadow-sm transition peer-checked:translate-x-5" />
      </span>
      <span>
        <span className="block text-sm font-semibold text-[var(--cs-text)]">
          {label}
        </span>
        {helperText ? (
          <span className="mt-1 block text-xs leading-5 text-[var(--cs-text-muted)]">
            {helperText}
          </span>
        ) : null}
      </span>
    </label>
  );
}

export function InlineSwitch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex h-6 w-11 shrink-0 rounded-full p-0.5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cs-sand)] disabled:cursor-not-allowed disabled:opacity-60",
        checked ? "bg-[#7C3AED]" : "bg-[var(--cs-border-strong)]"
      )}
    >
      <span
        className={cn(
          "size-5 rounded-full bg-white shadow-sm transition",
          checked && "translate-x-5"
        )}
      />
    </button>
  );
}
