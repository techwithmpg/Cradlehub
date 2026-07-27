import "server-only";

import type { PublicScanResult } from "@/lib/attendance/types";

export const ATTENDANCE_MAINTENANCE_REASON_CODE = "attendance_maintenance" as const;

export const DEFAULT_ATTENDANCE_MAINTENANCE_TITLE = "Attendance is temporarily under maintenance";

export const DEFAULT_ATTENDANCE_MAINTENANCE_MESSAGE =
  "Attendance scanning is temporarily unavailable while we complete system maintenance. Please record your arrival and departure with the front desk.";

export const ATTENDANCE_MAINTENANCE_INSTRUCTION =
  "Do not scan repeatedly. The front desk will record your arrival and departure during maintenance.";

export const ATTENDANCE_MAINTENANCE_BANNER =
  "Attendance maintenance mode is active. New scans, corrections, device changes, and Attendance resolutions are temporarily paused. Existing records remain available for review.";

export const ATTENDANCE_MAINTENANCE_ACTION_MESSAGE =
  "Attendance maintenance mode is active. This change is temporarily unavailable; existing Attendance records remain unchanged.";

export type AttendanceMaintenanceState = {
  active: boolean;
  title: string;
  message: string;
  instruction: string;
  banner: string;
};

export type AttendanceMaintenanceEnvironment = {
  ATTENDANCE_MAINTENANCE_MODE?: string;
  ATTENDANCE_MAINTENANCE_TITLE?: string;
  ATTENDANCE_MAINTENANCE_MESSAGE?: string;
};

function configuredCopy(value: string | undefined, fallback: string): string {
  return value?.trim() || fallback;
}

export function getAttendanceMaintenanceState(
  env: AttendanceMaintenanceEnvironment = process.env as AttendanceMaintenanceEnvironment
): AttendanceMaintenanceState {
  return {
    active: env.ATTENDANCE_MAINTENANCE_MODE?.trim().toLowerCase() === "true",
    title: configuredCopy(env.ATTENDANCE_MAINTENANCE_TITLE, DEFAULT_ATTENDANCE_MAINTENANCE_TITLE),
    message: configuredCopy(
      env.ATTENDANCE_MAINTENANCE_MESSAGE,
      DEFAULT_ATTENDANCE_MAINTENANCE_MESSAGE
    ),
    instruction: ATTENDANCE_MAINTENANCE_INSTRUCTION,
    banner: ATTENDANCE_MAINTENANCE_BANNER,
  };
}

export function isAttendanceMaintenanceMode(env?: AttendanceMaintenanceEnvironment): boolean {
  return getAttendanceMaintenanceState(env).active;
}

export class AttendanceMaintenanceError extends Error {
  readonly code = ATTENDANCE_MAINTENANCE_REASON_CODE;
  readonly status = 503;

  constructor() {
    super(ATTENDANCE_MAINTENANCE_ACTION_MESSAGE);
    this.name = "AttendanceMaintenanceError";
  }
}

export function assertAttendanceWritable(env?: AttendanceMaintenanceEnvironment): void {
  if (isAttendanceMaintenanceMode(env)) {
    throw new AttendanceMaintenanceError();
  }
}

export function isAttendanceMaintenanceError(error: unknown): error is AttendanceMaintenanceError {
  return (
    error instanceof AttendanceMaintenanceError ||
    (error instanceof Error && "code" in error && error.code === ATTENDANCE_MAINTENANCE_REASON_CODE)
  );
}

export function createAttendanceMaintenanceResult(params?: {
  operationId?: string | null;
}): PublicScanResult {
  const maintenance = getAttendanceMaintenanceState();
  const operationId = params?.operationId?.trim() || undefined;

  return {
    ok: false,
    outcome: "noop",
    reasonCode: ATTENDANCE_MAINTENANCE_REASON_CODE,
    severity: "info",
    title: maintenance.title,
    message: maintenance.message,
    detail: maintenance.instruction,
    securityNote: "Attendance changed: No",
    operationId,
    recoverable: false,
    resolution: {
      safeErrorCode: ATTENDANCE_MAINTENANCE_REASON_CODE,
      category: "attendance_state",
      title: maintenance.title,
      staffMessage: maintenance.message,
      crmSummary: maintenance.banner,
      whatHappened: "Attendance was intentionally paused for planned maintenance.",
      whyProtected: "No Attendance, device, exception, or incident write was attempted.",
      recommendedSteps: [maintenance.instruction],
      resolutionOwner: "automatic",
      staffActionRequired: false,
      crmActionRequired: false,
      technicalSupportRequired: false,
      canRetry: false,
      retryLabel: null,
      attendanceChanged: false,
      incidentRequired: false,
      severity: "info",
      suggestedActions: [],
      staffActionLabel: "Follow the front desk procedure",
      staffActionHref: "",
      staffPrevention: maintenance.instruction,
      rootCause: "Planned Attendance maintenance is active.",
      preventionAction: "Use the agreed front desk arrival and departure procedure.",
      verification: "Existing Attendance records remain unchanged and readable.",
      operationId,
    },
  };
}

export function isAttendanceMaintenanceResult(
  result: Pick<PublicScanResult, "reasonCode">
): boolean {
  return result.reasonCode === ATTENDANCE_MAINTENANCE_REASON_CODE;
}
