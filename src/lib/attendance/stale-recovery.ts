export type StaleAttendanceRecoveryInput = {
  checkedInAt: string;
  provisionalAutoClosedAt?: string | null;
  attendanceExpectedEndAt?: string | null;
  latestNormalClockOutAt?: string | null;
  scheduledEndAt?: string | null;
  nowIso: string;
};

const MAX_UNSCHEDULED_SHIFT_MINUTES = 16 * 60;

function validInstant(value: string | null | undefined): number | null {
  if (!value) return null;
  const instant = new Date(value).getTime();
  return Number.isFinite(instant) ? instant : null;
}

/**
 * Selects a bounded, policy-derived closing instant for a stale open record.
 * It never stretches the old shift to the current scan and therefore cannot
 * convert a legitimate new-day clock-in into a multi-day clock-out.
 */
export function resolveStaleAttendanceRecoveryClockOutAt(
  input: StaleAttendanceRecoveryInput
): string | null {
  const checkedInAt = validInstant(input.checkedInAt);
  const now = validInstant(input.nowIso);
  if (checkedInAt === null || now === null || checkedInAt >= now) return null;

  const policyCandidates = [
    input.provisionalAutoClosedAt,
    input.attendanceExpectedEndAt,
    input.latestNormalClockOutAt,
    input.scheduledEndAt,
  ];
  for (const candidate of policyCandidates) {
    const instant = validInstant(candidate);
    if (instant !== null && instant > checkedInAt && instant <= now) {
      return new Date(instant).toISOString();
    }
  }

  const boundedFallback = Math.min(
    now,
    checkedInAt + MAX_UNSCHEDULED_SHIFT_MINUTES * 60_000
  );
  return boundedFallback > checkedInAt ? new Date(boundedFallback).toISOString() : null;
}
