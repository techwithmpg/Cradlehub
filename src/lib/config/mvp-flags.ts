/**
 * Deployment-time launch gates that are safe to read in both Server and Client
 * Components. Only NEXT_PUBLIC_* values belong in this module.
 */

const ENABLED_VALUES = new Set(["1", "true", "yes", "on", "enabled"]);

export type AttendanceEnforcementConfig = {
  NEXT_PUBLIC_ATTENDANCE_ENFORCEMENT_ENABLED?: string;
};

export type AttendanceScanningConfig = {
  NEXT_PUBLIC_ATTENDANCE_SCANNING_ENABLED?: string;
};

export type RetainedWorkspaceRollout = "off" | "crm" | "all";

export type RetainedWorkspaceConfig = {
  NEXT_PUBLIC_RETAINED_WORKSPACES?: string;
};

/**
 * Attendance enforcement is fail-closed: a missing or unrecognized value keeps
 * schedule-based availability in place until operations explicitly enables it.
 */
export function isAttendanceEnforcementEnabled(
  env: AttendanceEnforcementConfig = process.env as AttendanceEnforcementConfig
): boolean {
  const value = env.NEXT_PUBLIC_ATTENDANCE_ENFORCEMENT_ENABLED?.trim().toLowerCase();
  return value ? ENABLED_VALUES.has(value) : false;
}

/** Scanning preserves the established production behavior unless explicitly disabled. */
export function isAttendanceScanningEnabled(
  env: AttendanceScanningConfig = process.env as AttendanceScanningConfig
): boolean {
  const value = env.NEXT_PUBLIC_ATTENDANCE_SCANNING_ENABLED?.trim().toLowerCase();
  return value ? ENABLED_VALUES.has(value) : true;
}

/**
 * Retained workspaces roll out CRM-first. The value is intentionally public:
 * it controls client interaction behavior and is not an authorization gate.
 * Unknown values fail safely to CRM-only, while `off` remains an immediate
 * deployment rollback path.
 */
export function getRetainedWorkspaceRollout(
  env: RetainedWorkspaceConfig = process.env as RetainedWorkspaceConfig
): RetainedWorkspaceRollout {
  const value = env.NEXT_PUBLIC_RETAINED_WORKSPACES?.trim().toLowerCase();
  if (value === "off" || value === "crm" || value === "all") return value;
  return "crm";
}

export function isRetainedWorkspaceEnabled(
  workspace: "crm" | "owner",
  env: RetainedWorkspaceConfig = process.env as RetainedWorkspaceConfig
): boolean {
  const rollout = getRetainedWorkspaceRollout(env);
  return rollout === "all" || (rollout === "crm" && workspace === "crm");
}

/** @deprecated Use isAttendanceEnforcementEnabled(). */
export const MVP_CHECKIN_PAUSED = !isAttendanceEnforcementEnabled();
