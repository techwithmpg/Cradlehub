export function serviceTransitionEventId(
  transition: "started" | "completed", bookingId: string, timestamp: string
): string {
  return `service_${transition}:${bookingId}:${timestamp}`;
}
