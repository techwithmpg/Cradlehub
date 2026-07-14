function formatCountdown(seconds: number): string {
  const safe = Math.abs(Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainder = safe % 60;
  const minuteLabel = String(minutes).padStart(2, "0");
  const secondLabel = String(remainder).padStart(2, "0");
  return hours > 0 ? `${hours}:${minuteLabel}:${secondLabel}` : `${minuteLabel}:${secondLabel}`;
}
export function HybridSelectedBookingCountdown({
  elapsedSeconds,
  remainingSeconds,
  progressPercent,
  durationMinutes,
  sessionStartedAt,
  staffName,
  resourceName,
}: {
  elapsedSeconds: number;
  remainingSeconds: number;
  progressPercent: number;
  durationMinutes: number;
  sessionStartedAt: string;
  staffName?: string | null;
  resourceName?: string | null;
}) {
  const overtime = elapsedSeconds > durationMinutes * 60;
  const timer = overtime
    ? `+${formatCountdown(elapsedSeconds - durationMinutes * 60)}`
    : formatCountdown(remainingSeconds);
  const started = new Date(sessionStartedAt);
  const startedLabel = Number.isFinite(started.getTime())
    ? started.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", hour12: true })
    : null;

  return (
    <div className="border-t border-[var(--cs-success-bg)] bg-[var(--cs-success-bg)] px-4 py-3">
      <p className="text-center text-[10px] font-bold uppercase tracking-wide text-[var(--cs-success-text)]">In service</p>
      <div className="mt-1 text-center">
        <p className="text-[11px] font-semibold text-[var(--cs-success-text)]">{overtime ? "Overtime" : `${Math.ceil(remainingSeconds / 60)} min`}</p>
        <p className="text-[10px] text-[var(--cs-text-muted)]">{overtime ? "Ready to complete" : "remaining"}</p>
        <p className="mt-1 text-[30px] font-bold tabular-nums leading-none text-[var(--cs-success-text)]">{timer}</p>
        <p className="mt-0.5 text-[11px] text-[var(--cs-text-muted)]">of {durationMinutes} min</p>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-black/10" role="progressbar" aria-valuenow={Math.round(progressPercent)} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-[var(--cs-success)] transition-[width] duration-700 ease-linear" style={{ width: `${progressPercent}%` }} />
      </div>
      {startedLabel ? (
        <p className="mt-2 flex flex-wrap items-center justify-center gap-1 text-[10px] text-[var(--cs-text-muted)]">
          <span>Started {startedLabel}</span>
          {staffName ? <><span>·</span><span>Staff: {staffName}</span></> : null}
          {resourceName ? <><span>·</span><span>Room: {resourceName}</span></> : null}
        </p>
      ) : null}
    </div>
  );
}
