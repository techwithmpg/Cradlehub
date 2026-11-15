import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Semantic tone families matching the canonical Attendance card palette:
 * - success -> soft forest green
 * - warning -> soft amber / warm gold
 * - danger  -> soft rose / crimson
 * - info    -> soft azure blue
 * - neutral -> warm cream / sand-neutral
 */
export type CrmCardTone = "success" | "warning" | "danger" | "info" | "neutral";

type ToneTokens = {
  pastelSurface: string;
  flatSurface: string;
  iconWrap: string;
  swoosh: string;
  accentText: string;
  activeRing: string;
};

const TONE_MAP: Record<CrmCardTone, ToneTokens> = {
  success: {
    pastelSurface:
      "border-[#BFE0CA] bg-gradient-to-br from-[#F4FBF6] via-[#ECF7F0] to-[#DFF0E5]",
    flatSurface: "border-[#CFE5D6] bg-[#EEF7F1]",
    iconWrap: "bg-white/90 text-[#1F4E33] ring-1 ring-[#CFE5D6]",
    swoosh: "bg-[#CFE8D7]/70",
    accentText: "text-[#1F4E33]",
    activeRing: "ring-2 ring-[#1F4E33]/25 border-[#1F4E33]",
  },
  warning: {
    pastelSurface:
      "border-[#EAD9AE] bg-gradient-to-br from-[#FFFDF7] via-[#FDF6E4] to-[#F9EDCE]",
    flatSurface: "border-[#EFE1BE] bg-[#FDF8EC]",
    iconWrap: "bg-white/90 text-[#A16207] ring-1 ring-[#EFE1BE]",
    swoosh: "bg-[#F3E2BA]/70",
    accentText: "text-[#94681C]",
    activeRing: "ring-2 ring-[#94681C]/25 border-[#C4966E]",
  },
  danger: {
    pastelSurface:
      "border-[#F0C7C7] bg-gradient-to-br from-[#FFF9F9] via-[#FDF0F0] to-[#FAE2E2]",
    flatSurface: "border-[#F2D0D0] bg-[#FDF3F3]",
    iconWrap: "bg-white/90 text-[#B42318] ring-1 ring-[#F2D0D0]",
    swoosh: "bg-[#F6D3D3]/70",
    accentText: "text-[#B42318]",
    activeRing: "ring-2 ring-[#B42318]/20 border-[#D98282]",
  },
  info: {
    pastelSurface:
      "border-[#C7DAF2] bg-gradient-to-br from-[#F8FBFF] via-[#EFF5FD] to-[#E3EEFB]",
    flatSurface: "border-[#D3E1F4] bg-[#EFF5FD]",
    iconWrap: "bg-white/90 text-[#1D4ED8] ring-1 ring-[#D3E1F4]",
    swoosh: "bg-[#D4E4F8]/70",
    accentText: "text-[#1D4ED8]",
    activeRing: "ring-2 ring-[#1D4ED8]/20 border-[#7FA8E3]",
  },
  neutral: {
    pastelSurface:
      "border-[var(--cs-border)] bg-gradient-to-br from-[#FFFFFF] via-[#FAF8F5] to-[#F4EFE8]",
    flatSurface: "border-[var(--cs-border-soft)] bg-[#FAF8F5]",
    iconWrap: "bg-white/90 text-[#1F4E33] ring-1 ring-[var(--cs-border)]",
    swoosh: "bg-[#EAE2D6]/75",
    accentText: "text-[var(--cs-text-secondary)]",
    activeRing: "ring-2 ring-[#1F4E33]/20 border-[#1F4E33]",
  },
};

export function getCrmCardToneTokens(tone: CrmCardTone): ToneTokens {
  return TONE_MAP[tone];
}

export type CrmStatCardProps = {
  title: ReactNode;
  value: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  tone?: CrmCardTone;
  badge?: ReactNode;
  footer?: ReactNode;
  action?: ReactNode;
  /** "pastel" uses canonical Attendance gradient + tint; "flat" uses soft flat tint; "plain" uses clean white utility card. */
  surface?: "pastel" | "flat" | "plain";
  /** Renders the subtle bottom-right circular shape seen in the Attendance summary cards. Defaults to true when surface="pastel". */
  decorative?: boolean;
  compact?: boolean;
  loading?: boolean;
  active?: boolean;
  href?: string;
  onClick?: () => void;
  ariaPressed?: boolean;
  className?: string;
};

/**
 * Family A: Canonical Summary Stat Card aligned with the approved Attendance KPI standard.
 */
export function CrmStatCard({
  title,
  value,
  subtitle,
  icon,
  tone = "neutral",
  badge,
  footer,
  action,
  surface = "pastel",
  decorative,
  compact = false,
  loading = false,
  active = false,
  href,
  onClick,
  ariaPressed,
  className,
}: CrmStatCardProps) {
  const tokens = TONE_MAP[tone];
  const showSwoosh = decorative ?? surface === "pastel";
  const interactive = Boolean(href || onClick);

  const surfaceClass =
    surface === "plain"
      ? "border-[var(--cs-border-soft)] bg-white"
      : surface === "flat"
        ? tokens.flatSurface
        : tokens.pastelSurface;

  const baseClass = cn(
    "group relative flex min-w-0 flex-col justify-between overflow-hidden rounded-2xl border text-left shadow-2xs transition",
    compact ? "px-3.5 py-2.5" : "px-4 py-3",
    surfaceClass,
    interactive &&
      "cursor-pointer hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4E33]",
    active && tokens.activeRing,
    className
  );

  const inner = loading ? (
    <div className="relative space-y-2.5 animate-pulse" aria-busy="true">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "shrink-0 rounded-xl bg-black/5",
            compact ? "size-8" : "size-10"
          )}
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="h-5 w-14 rounded bg-black/10" />
          <div className="h-3 w-24 rounded bg-black/5" />
        </div>
      </div>
      <div className="h-2.5 w-32 rounded bg-black/5" />
    </div>
  ) : (
    <>
      {showSwoosh ? (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute -right-5 -bottom-7 size-24 rounded-full opacity-75 transition-transform",
            interactive && "group-hover:scale-105",
            tokens.swoosh
          )}
        />
      ) : null}

      <div className="relative flex items-start justify-between gap-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {icon ? (
            <span
              className={cn(
                "flex shrink-0 items-center justify-center rounded-xl shadow-2xs",
                compact ? "size-8.5" : "size-10",
                surface === "plain"
                  ? "bg-[#FAF8F5] text-[#1F4E33] ring-1 ring-[var(--cs-border-soft)]"
                  : tokens.iconWrap
              )}
            >
              {icon}
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "font-extrabold leading-none tracking-tight text-[var(--cs-text)] tabular-nums",
                compact ? "text-lg" : "text-[1.6rem]"
              )}
            >
              {value}
            </p>
            <p
              className={cn(
                "mt-1 font-bold leading-tight text-[var(--cs-text)]",
                compact ? "text-[0.75rem]" : "text-[0.82rem]"
              )}
            >
              {title}
            </p>
          </div>
        </div>

        {badge || action ? (
          <div className="relative flex shrink-0 items-center gap-1.5">
            {badge}
            {action}
          </div>
        ) : null}
      </div>

      {subtitle ? (
        <p
          className={cn(
            "relative mt-2 font-medium leading-snug text-[var(--cs-text-secondary)]",
            compact ? "text-[0.68rem]" : "text-[0.7rem]"
          )}
        >
          {subtitle}
        </p>
      ) : null}

      {footer ? (
        <div className="relative mt-2 border-t border-black/5 pt-2 text-[0.72rem] text-[var(--cs-text-secondary)]">
          {footer}
        </div>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={baseClass}>
        {inner}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={ariaPressed}
        className={baseClass}
      >
        {inner}
      </button>
    );
  }

  return <div className={baseClass}>{inner}</div>;
}

export type CrmSectionCardProps = {
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  context?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  tone?: "plain" | "warm";
  noPadding?: boolean;
  compact?: boolean;
  loading?: boolean;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  children: ReactNode;
};

/**
 * Family B: Section Container Card for grouped CRM content panels, lists, and tables.
 */
export function CrmSectionCard({
  title,
  description,
  icon,
  badge,
  context,
  actions,
  footer,
  tone = "plain",
  noPadding = false,
  compact = false,
  loading = false,
  ariaLabel,
  ariaLabelledBy,
  className,
  headerClassName,
  bodyClassName,
  children,
}: CrmSectionCardProps) {
  const hasHeader = Boolean(title || description || icon || badge || context || actions);

  return (
    <section
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={cn(
        "overflow-hidden rounded-2xl border border-[var(--cs-border-soft)] shadow-2xs",
        tone === "warm" ? "bg-[#FAF8F5]" : "bg-white",
        className
      )}
    >
      {hasHeader ? (
        <div
          className={cn(
            "flex flex-wrap items-start justify-between gap-3 border-b border-[var(--cs-border-soft)]",
            compact ? "px-4 py-3" : "px-4 py-3.5 sm:px-5",
            headerClassName
          )}
        >
          <div className="flex min-w-0 items-start gap-3">
            {icon ? (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#EEF7F1] text-[#1F4E33]">
                {icon}
              </span>
            ) : null}
            <div className="min-w-0">
              {title ? (
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="m-0 text-base font-bold tracking-tight text-[var(--cs-text)]">
                    {title}
                  </h2>
                  {badge}
                </div>
              ) : null}
              {description ? (
                <p className="mt-0.5 text-xs text-[var(--cs-text-muted)]">{description}</p>
              ) : null}
            </div>
          </div>

          {context || actions ? (
            <div className="flex flex-wrap items-center gap-2">
              {context}
              {actions}
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        className={cn(
          !noPadding && (compact ? "p-3.5" : "p-4 sm:p-5"),
          bodyClassName
        )}
      >
        {loading ? (
          <div className="space-y-3 animate-pulse" aria-busy="true">
            <div className="h-4 w-1/3 rounded bg-[var(--cs-surface-warm)]" />
            <div className="h-20 w-full rounded-xl bg-[var(--cs-surface-warm)]" />
          </div>
        ) : (
          children
        )}
      </div>

      {footer ? (
        <div className="border-t border-[var(--cs-border-soft)] bg-[#FAF8F5]/70 px-4 py-3 sm:px-5">
          {footer}
        </div>
      ) : null}
    </section>
  );
}

export type CrmInfoCardProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  avatar?: ReactNode;
  badge?: ReactNode;
  tone?: CrmCardTone;
  compact?: boolean;
  active?: boolean;
  actions?: ReactNode;
  footer?: ReactNode;
  onClick?: () => void;
  className?: string;
  children?: ReactNode;
};

/**
 * Family C: Profile / Entity Summary Card (customers, staff, services, devices, bookings).
 */
export function CrmInfoCard({
  title,
  subtitle,
  icon,
  avatar,
  badge,
  tone = "neutral",
  compact = false,
  active = false,
  actions,
  footer,
  onClick,
  className,
  children,
}: CrmInfoCardProps) {
  const tokens = TONE_MAP[tone];
  const interactive = Boolean(onClick);
  const surfaceClass =
    tone === "neutral"
      ? "border-[var(--cs-border-soft)] bg-white"
      : tokens.flatSurface;

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {avatar}
          {!avatar && icon ? (
            <span
              className={cn(
                "flex shrink-0 items-center justify-center rounded-xl shadow-2xs",
                compact ? "size-9" : "size-10",
                tokens.iconWrap
              )}
            >
              {icon}
            </span>
          ) : null}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="truncate text-sm font-bold text-[var(--cs-text)]">{title}</div>
              {badge}
            </div>
            {subtitle ? (
              <div className="mt-0.5 text-xs text-[var(--cs-text-muted)]">{subtitle}</div>
            ) : null}
          </div>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>

      {children ? <div className={cn(compact ? "mt-2.5" : "mt-3")}>{children}</div> : null}

      {footer ? (
        <div className="mt-3 border-t border-[var(--cs-border-soft)] pt-2.5 text-xs text-[var(--cs-text-secondary)]">
          {footer}
        </div>
      ) : null}
    </>
  );

  const cardClass = cn(
    "rounded-2xl border shadow-2xs transition text-left",
    compact ? "p-3.5" : "p-4",
    surfaceClass,
    interactive &&
      "w-full cursor-pointer hover:border-[#CFE5D6] hover:bg-[#FAF8F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4E33]",
    active && tokens.activeRing,
    className
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cardClass}>
        {content}
      </button>
    );
  }

  return <article className={cardClass}>{content}</article>;
}

export type CrmActionCardProps = {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  trailing?: ReactNode;
  tone?: CrmCardTone | "primary";
  /** "pastel" uses canonical Attendance gradient + swoosh; "flat" uses soft flat tint; "plain" uses clean white utility surface. */
  surface?: "pastel" | "flat" | "plain";
  decorative?: boolean;
  compact?: boolean;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
};

/**
 * Family D: Action / Shortcut / Launch Card for operational workflows and quick actions.
 */
export function CrmActionCard({
  title,
  description,
  icon,
  badge,
  trailing,
  tone = "neutral",
  surface = "pastel",
  decorative,
  compact = false,
  href,
  onClick,
  disabled = false,
  className,
}: CrmActionCardProps) {
  const isPrimary = tone === "primary";
  const semanticTone: CrmCardTone = isPrimary ? "success" : tone;
  const tokens = TONE_MAP[semanticTone];
  const showSwoosh = decorative ?? (surface === "pastel" || isPrimary);

  const toneClass = isPrimary
    ? "border-[#1F4E33] bg-[#1F4E33] bg-gradient-to-br from-[#1F4E33] via-[#1B452D] to-[#143723] text-white"
    : surface === "plain"
      ? "border-[var(--cs-border-soft)] bg-white text-[var(--cs-text)] hover:border-[#CFE5D6] hover:bg-[#FAF8F5]"
      : surface === "flat"
        ? cn(tokens.flatSurface, "text-[var(--cs-text)]")
        : cn(tokens.pastelSurface, "text-[var(--cs-text)]");

  const iconClass = isPrimary
    ? "bg-white/15 text-white ring-1 ring-white/25"
    : surface === "plain" && tone === "neutral"
      ? "bg-[#EEF7F1] text-[#1F4E33] ring-1 ring-[#CFE5D6]"
      : tokens.iconWrap;

  const sharedClass = cn(
    "group relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-2xl border text-left shadow-2xs transition hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4E33] disabled:pointer-events-none disabled:opacity-55",
    compact ? "p-3" : "p-4",
    toneClass,
    className
  );

  const inner = (
    <>
      {showSwoosh ? (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute -right-5 -bottom-7 size-24 rounded-full opacity-75 transition-transform group-hover:scale-105",
            isPrimary ? "bg-white/10" : tokens.swoosh
          )}
        />
      ) : null}

      <div className="relative flex min-w-0 items-center gap-3">
        {icon ? (
          <span
            className={cn(
              "flex shrink-0 items-center justify-center rounded-xl shadow-2xs transition-transform group-hover:scale-[1.03]",
              compact ? "size-9" : "size-10",
              iconClass
            )}
          >
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-bold">{title}</span>
            {badge}
          </div>
          {description ? (
            <p
              className={cn(
                "mt-0.5 text-xs leading-snug",
                isPrimary ? "text-white/80" : "text-[var(--cs-text-secondary)]"
              )}
            >
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {trailing ? <span className="relative shrink-0">{trailing}</span> : null}
    </>
  );

  if (href && !disabled) {
    return (
      <Link href={href} className={sharedClass}>
        {inner}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={sharedClass}
    >
      {inner}
    </button>
  );
}

export type CrmAlertCardProps = {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  tone?: CrmCardTone;
  badge?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
  role?: "alert" | "status" | "region";
  className?: string;
  children?: ReactNode;
};

/**
 * Family E: Alert / Review Card for operational exceptions, warnings, and queue items.
 */
export function CrmAlertCard({
  title,
  description,
  icon,
  tone = "warning",
  badge,
  meta,
  actions,
  compact = false,
  role,
  className,
  children,
}: CrmAlertCardProps) {
  const tokens = TONE_MAP[tone];
  const resolvedRole = role ?? (tone === "danger" || tone === "warning" ? "alert" : undefined);

  return (
    <article
      role={resolvedRole}
      className={cn(
        "rounded-2xl border shadow-2xs",
        compact ? "p-3" : "p-4",
        tokens.flatSurface,
        className
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {icon ? (
            <span
              className={cn(
                "flex shrink-0 items-center justify-center rounded-xl shadow-2xs",
                compact ? "size-8.5" : "size-10",
                tokens.iconWrap
              )}
            >
              {icon}
            </span>
          ) : null}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-bold text-[var(--cs-text)]">{title}</div>
              {badge}
            </div>
            {description ? (
              <p className="mt-1 text-xs leading-relaxed text-[var(--cs-text-secondary)]">
                {description}
              </p>
            ) : null}
            {meta ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.7rem] font-medium text-[var(--cs-text-muted)]">
                {meta}
              </div>
            ) : null}
          </div>
        </div>

        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>

      {children ? <div className="mt-3">{children}</div> : null}
    </article>
  );
}
