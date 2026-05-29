"use client";

import { cn } from "@/lib/utils";

export function StaffProfileSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-4 shadow-sm",
        className
      )}
    >
      <div className="mb-4">
        <h3 className="text-sm font-bold text-[var(--cs-text)]">{title}</h3>
        {description ? (
          <p className="mt-1 text-xs leading-5 text-[var(--cs-text-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function StaffProfileField({
  label,
  htmlFor,
  required,
  helper,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-xs font-semibold text-[var(--cs-text)]"
      >
        {label}
        {required ? <span className="text-[var(--cs-error)]"> *</span> : null}
      </label>
      {children}
      {helper ? (
        <p className="text-[0.6875rem] leading-4 text-[var(--cs-text-muted)]">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

export const staffProfileInputClass = cn(
  "h-9 w-full rounded-lg border border-[var(--cs-border-soft)] bg-white px-3 text-sm text-[var(--cs-text)] shadow-xs outline-none transition",
  "placeholder:text-[var(--cs-text-muted)] focus:border-[var(--cs-sand)] focus:ring-2 focus:ring-[var(--cs-sand)]/20",
  "disabled:cursor-not-allowed disabled:bg-[var(--cs-surface-warm)] disabled:text-[var(--cs-text-muted)] disabled:opacity-70"
);

export const staffProfileCheckboxClass =
  "size-4 rounded border-[var(--cs-border)] accent-[var(--cs-success)] disabled:cursor-not-allowed disabled:opacity-60";
