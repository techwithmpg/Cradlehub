import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";
import styles from "./native-foundation.module.css";

export function StaffCanvas({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(styles.canvas, className)}>{children}</div>;
}

export function StaffScreen({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(styles.screen, className)}>{children}</div>;
}

export function StaffScreenHeader({
  title,
  subtitle,
  trailing,
}: {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
}) {
  return (
    <header className={styles.header}>
      <div>
        <h1 className={styles.title}>{title}</h1>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>
      {trailing}
    </header>
  );
}

export function StaffCard({
  children,
  className,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: ElementType;
}) {
  return <Tag className={cn(styles.card, className)}>{children}</Tag>;
}

export function StaffInset({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(styles.inset, className)}>{children}</div>;
}

export function StaffSegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className={styles.segment}>
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(styles.segmentButton, value === option.value && styles.segmentSelected)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function StaffStatTile({
  value,
  label,
  icon,
}: {
  value: number | string;
  label: string;
  icon?: ReactNode;
}) {
  return (
    <div className={styles.stat}>
      {icon}
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

export function StaffListRow({ children, className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div className={cn(styles.listRow, className)} {...props}>
      {children}
    </div>
  );
}

export function StaffAvatarRow({
  avatar,
  title,
  subtitle,
}: {
  avatar: ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <StaffListRow>
      {avatar}
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{title}</div>
        {subtitle ? <div className="truncate text-xs text-[#65746b]">{subtitle}</div> : null}
      </div>
    </StaffListRow>
  );
}

export function StaffStatusChip({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: "green" | "gold";
}) {
  return <span className={cn(styles.chip, tone === "gold" && styles.chipGold)}>{children}</span>;
}

export function StaffButton({
  variant = "primary",
  className,
  ...props
}: ComponentPropsWithoutRef<"button"> & { variant?: "primary" | "secondary" | "destructive" }) {
  return (
    <button
      className={cn(
        styles.button,
        variant === "primary"
          ? styles.buttonPrimary
          : variant === "secondary"
            ? styles.buttonSecondary
            : styles.buttonDestructive,
        className
      )}
      {...props}
    />
  );
}

export function StaffTextField(props: ComponentPropsWithoutRef<"input">) {
  return <input {...props} className={cn(styles.field, props.className)} />;
}

export function StaffEmptyState({
  icon,
  title,
  description,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <StaffCard>
      <div className={styles.empty}>
        {icon}
        <div>
          <div className="font-semibold text-[#20342c]">{title}</div>
          {description ? <p className="mt-1 text-xs">{description}</p> : null}
        </div>
      </div>
    </StaffCard>
  );
}

export function StaffFeedback({
  children,
  error = false,
  className,
}: {
  children: ReactNode;
  error?: boolean;
  className?: string;
}) {
  return (
    <div
      role={error ? "alert" : "status"}
      className={cn(styles.feedback, error && styles.feedbackError, className)}
    >
      {children}
    </div>
  );
}

export function StaffServiceTimer({ children }: { children: ReactNode }) {
  return <div className={styles.timer}>{children}</div>;
}

export function StaffDialog({ children, ...props }: ComponentPropsWithoutRef<"dialog">) {
  return (
    <dialog {...props} className={cn(styles.dialog, props.className)}>
      {children}
    </dialog>
  );
}
