export type SessionTimerInput = {
  status: string;
  booking_progress_status?: string | null;
  session_started_at?: string | null;
  session_due_at?: string | null;
  session_completed_at?: string | null;
  durationMinutes: number;
  autoCompletionEnabled?: boolean;
};

export function formatSessionCountdown(totalSeconds: number, showHours: boolean): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = String(seconds % 60).padStart(2, "0");
  if (showHours) return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${remainder}`;
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${remainder}`;
}

export function getSessionTimerDisplay(input: SessionTimerInput, now: number) {
  const start = Date.parse(input.session_started_at ?? "");
  const due = Date.parse(input.session_due_at ?? "");
  const validPlan = Number.isFinite(start) && Number.isFinite(due) && due > start;
  const completed =
    input.status === "completed" ||
    input.booking_progress_status === "completed" ||
    Boolean(input.session_completed_at);
  const closed =
    ["cancelled", "no_show", "expired"].includes(input.status) ||
    ["cancelled", "no_show"].includes(input.booking_progress_status ?? "");
  const active =
    !closed &&
    !completed &&
    validPlan &&
    (input.status === "in_progress" || input.booking_progress_status === "session_started");
  const remaining = active ? Math.max(0, due - now) : 0;
  const overtime = active && now >= due;
  const grace = overtime && input.autoCompletionEnabled === true && now < due + 120_000;
  const displaySeconds = active
    ? grace
      ? Math.ceil((due + 120_000 - now) / 1000)
      : overtime
        ? Math.floor((now - due) / 1000)
        : Math.ceil(remaining / 1000)
    : 0;
  const showHours = input.durationMinutes >= 60 || (validPlan && due - start >= 3_600_000);
  const minutes = active
    ? Math.ceil((overtime ? now - due : remaining) / 60_000)
    : input.durationMinutes;
  return {
    active,
    phase: completed
      ? "completed"
      : closed
        ? "closed"
        : !active
          ? "scheduled"
          : grace
            ? "grace"
            : overtime
            ? "overtime"
            : remaining <= 300_000
              ? "ending"
              : "running",
    minutes,
    displaySeconds,
    displayTime: active ? `${overtime && !grace ? "+" : ""}${formatSessionCountdown(displaySeconds, showHours && !grace)}` : null,
    graceSeconds: grace ? displaySeconds : null,
    // Offset consumes the ring clockwise; a persisted later due retargets the same SVG stroke.
    progress: completed
      ? 100
      : active
        ? Math.min(100, Math.max(0, ((now - start) / (due - start)) * 100))
        : 0,
  };
}
