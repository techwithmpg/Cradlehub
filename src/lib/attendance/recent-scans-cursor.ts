export type AttendanceScanCursor = {
  createdAt: string;
  eventId: string;
};

const CURSOR_SEPARATOR = "|";

function isIsoTimestamp(value: string): boolean {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

export function encodeAttendanceScanCursor(cursor: AttendanceScanCursor): string {
  return `${cursor.createdAt}${CURSOR_SEPARATOR}${cursor.eventId}`;
}

export function parseAttendanceScanCursor(
  value: string | null | undefined
): AttendanceScanCursor | null {
  if (!value) return null;
  const separatorIndex = value.indexOf(CURSOR_SEPARATOR);
  if (separatorIndex <= 0 || separatorIndex === value.length - 1) return null;

  const createdAt = value.slice(0, separatorIndex);
  const eventId = value.slice(separatorIndex + 1);
  if (!isIsoTimestamp(createdAt) || eventId.includes(CURSOR_SEPARATOR)) return null;
  return { createdAt, eventId };
}

export function attendanceScanCursorFilter(cursor: AttendanceScanCursor): string {
  return [
    `created_at.gt.${cursor.createdAt}`,
    `and(created_at.eq.${cursor.createdAt},id.gt.${cursor.eventId})`,
  ].join(",");
}

export function compareAttendanceScanCursor(
  left: AttendanceScanCursor,
  right: AttendanceScanCursor
): number {
  const timestampDifference =
    new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  if (timestampDifference !== 0) return timestampDifference;
  return left.eventId.localeCompare(right.eventId);
}
