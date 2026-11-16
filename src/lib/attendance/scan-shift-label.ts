/** Presentation only; stored schedule metadata never authorizes attendance. */
export function scanShiftLabel(primary: unknown, metadata?: unknown): string | null {
  const label = (value: unknown) =>
    typeof value === "string" && value.trim().length > 0 && value.trim().length <= 80
      ? value.trim()
      : null;
  const preferred = label(primary);
  if (preferred) return preferred;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const data = metadata as Record<string, unknown>;
  for (const key of ["shiftInstance", "schedule"]) {
    const source = data[key];
    if (source && typeof source === "object" && !Array.isArray(source)) {
      const found = label((source as Record<string, unknown>).shiftType);
      if (found) return found;
    }
  }
  return null;
}
