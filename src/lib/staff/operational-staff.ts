export type OperationalStaffFlags = {
  is_active?: boolean | null;
  archived_at?: string | null;
  merged_into_staff_id?: string | null;
  metadata?: unknown;
};

function metadataFlag(metadata: unknown, key: string, fallback: boolean): boolean {
  const record =
    metadata && typeof metadata === "object" && Array.isArray(metadata) === false
      ? (metadata as Record<string, unknown>)
      : null;
  const value = record?.[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "t", "1", "yes", "y"].includes(normalized)) return true;
    if (["false", "f", "0", "no", "n"].includes(normalized)) return false;
  }
  return fallback;
}

export function isOperationalStaff(row: OperationalStaffFlags): boolean {
  return (
    row.is_active === true &&
    row.archived_at == null &&
    row.merged_into_staff_id == null &&
    !metadataFlag(row.metadata, "is_test", false) &&
    !metadataFlag(row.metadata, "test", false) &&
    metadataFlag(row.metadata, "is_schedulable", true) &&
    metadataFlag(row.metadata, "schedulable", true) &&
    !metadataFlag(row.metadata, "non_schedulable", false)
  );
}
