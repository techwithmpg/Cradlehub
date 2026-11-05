export function serviceTransitionEventId(
  transition: "started" | "completed", bookingId: string, timestamp: string
): string {
  // Match the transactional PostgreSQL notification trigger exactly. PostgREST
  // may serialize the same timestamptz using +00:00 instead of Z.
  const parsed = Date.parse(timestamp);
  const normalized = Number.isFinite(parsed) ? new Date(parsed).toISOString() : timestamp;
  return `service_${transition}:${bookingId}:${normalized}`;
}
