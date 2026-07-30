import "server-only";

import { asAttendanceDb, type AttendanceDb } from "@/lib/attendance/db";
import {
  collapseRecentAttendanceScans,
  rootAttendanceOperationId,
} from "@/lib/attendance/recent-scan-grouping";
import {
  isCompleteAttendanceScanPayload,
  mapStoredAttendanceScan,
  type AttendanceRealtimeScanRow,
} from "@/lib/attendance/recent-scan-event";
import {
  attendanceScanCursorFilter,
  compareAttendanceScanCursor,
  encodeAttendanceScanCursor,
  type AttendanceScanCursor,
} from "@/lib/attendance/recent-scans-cursor";
import { mapRecentScan, type RecentScanRow } from "@/lib/attendance/recent-scans-map";
import { attendanceDateBoundaryIso } from "@/lib/attendance/recent-scans-time";
import type {
  AttendanceScanFeedData,
  AttendanceScanFeedWorkspace,
  AttendanceScanOperation,
  RecentAttendanceScan,
} from "@/lib/attendance/types";
import { BRANCH_TIMEZONE } from "@/lib/engine/slot-time";
import { createAdminClient } from "@/lib/supabase/admin";

type RecentScanFeedParams = {
  workspace: AttendanceScanFeedWorkspace;
  selectedDate: string;
  branchId?: string | null;
  branchName?: string | null;
  maxItems?: number;
  cursor?: AttendanceScanCursor | null;
};

type LastHourScanRow = {
  id: string;
  request_id: string | null;
  operation_id: string | null;
  created_at: string;
};

const TIMEZONE_CACHE_TTL_MS = 5 * 60_000;
const timezoneCache = new Map<string, { timezone: string; expiresAt: number }>();

function safeLimit(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) return 5;
  return Math.max(1, Math.min(10, Math.floor(value)));
}

function baseScanQuery(
  admin: AttendanceDb,
  branchId: string | null | undefined,
  columns: string
) {
  let query = admin
    .from("qr_scan_events")
    .select(columns)
    .eq("scan_type", "attendance")
    .eq("is_test", false);

  if (branchId) query = query.eq("branch_id", branchId);
  return query;
}

function validTimezone(value: string | null | undefined): string {
  const timezone = value?.trim() || BRANCH_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
    return timezone;
  } catch {
    return BRANCH_TIMEZONE;
  }
}

async function resolveFeedTimezone(
  admin: AttendanceDb,
  branchId: string | null | undefined
): Promise<string> {
  if (!branchId) return BRANCH_TIMEZONE;
  const cached = timezoneCache.get(branchId);
  if (cached && cached.expiresAt > Date.now()) return cached.timezone;

  const { data, error } = await admin
    .from("attendance_settings")
    .select("timezone")
    .eq("branch_id", branchId)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const timezone = validTimezone(data?.timezone);
  timezoneCache.set(branchId, { timezone, expiresAt: Date.now() + TIMEZONE_CACHE_TTL_MS });
  return timezone;
}

function operationFromRow(row: LastHourScanRow): AttendanceScanOperation {
  return {
    operationId: rootAttendanceOperationId(row.operation_id, row.request_id, row.id),
    occurredAt: row.created_at,
  };
}

function latestCursor(
  rows: Array<Pick<AttendanceRealtimeScanRow, "id" | "created_at">>,
  fallback: AttendanceScanCursor | null | undefined
): string | null {
  let latest = fallback ?? null;
  for (const row of rows) {
    const candidate = { createdAt: row.created_at, eventId: row.id };
    if (!latest || compareAttendanceScanCursor(candidate, latest) > 0) latest = candidate;
  }
  return latest ? encodeAttendanceScanCursor(latest) : null;
}

async function mapScanRows(params: {
  admin: AttendanceDb;
  rows: AttendanceRealtimeScanRow[];
  branchId?: string | null;
  branchName?: string | null;
  timezone: string;
}): Promise<RecentAttendanceScan[]> {
  const context = {
    branchId: params.branchId,
    branchName: params.branchName,
    timezone: params.timezone,
  };
  const fallbackIds = params.rows
    .filter((row) => !isCompleteAttendanceScanPayload(row))
    .map((row) => row.id);
  const fallbackById = new Map<string, RecentScanRow>();

  if (fallbackIds.length > 0) {
    const fallbackResult = await baseScanQuery(
      params.admin,
      params.branchId,
      [
        "id",
        "branch_id",
        "staff_id",
        "action",
        "outcome",
        "reason_code",
        "message",
        "request_id",
        "operation_id",
        "created_at",
        "staff(id, full_name, nickname, avatar_url)",
        "branches(id, name)",
        "qr_points(label)",
        "checkin:staff_shift_checkins!qr_scan_events_checkin_id_fkey(shift_type, attendance_status, worked_minutes, checked_in_at, checked_out_at)",
      ].join(", ")
    ).in("id", fallbackIds);
    if (fallbackResult.error) throw new Error(fallbackResult.error.message);
    for (const row of (fallbackResult.data ?? []) as unknown as RecentScanRow[]) {
      fallbackById.set(row.id, row);
    }
  }

  return params.rows
    .map(
      (row) =>
        mapStoredAttendanceScan(row, context) ??
        (fallbackById.has(row.id) ? mapRecentScan(fallbackById.get(row.id)!, context) : null)
    )
    .filter((row): row is RecentAttendanceScan => row !== null);
}

export function createAttendanceScanFeedFallback(
  params: RecentScanFeedParams & { error?: string | null }
): AttendanceScanFeedData {
  return {
    selectedDate: params.selectedDate,
    timezone: BRANCH_TIMEZONE,
    branchId: params.branchId ?? null,
    branchName: params.branchName ?? null,
    items: [],
    lastHourCount: 0,
    lastHourOperations: [],
    nextCursor: params.cursor ? encodeAttendanceScanCursor(params.cursor) : null,
    error: params.error ?? null,
  };
}

export async function getRecentAttendanceScanFeed(
  params: RecentScanFeedParams
): Promise<AttendanceScanFeedData> {
  const admin = asAttendanceDb(createAdminClient());
  const limit = safeLimit(params.maxItems);
  const queryLimit = params.cursor ? 200 : Math.min(100, Math.max(limit * 6, 24));
  const timezone = await resolveFeedTimezone(admin, params.branchId);
  const startIso = attendanceDateBoundaryIso(params.selectedDate, timezone);
  const endIso = attendanceDateBoundaryIso(params.selectedDate, timezone, 1);
  const oneHourAgoIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const minimalColumns = [
    "id",
    "branch_id",
    "staff_id",
    "action",
    "outcome",
    "reason_code",
    "message",
    "request_id",
    "operation_id",
    "operation_result",
    "operation_result_recorded_at",
    "created_at",
    "scan_type",
    "is_test",
  ].join(", ");

  let scanQuery = baseScanQuery(admin, params.branchId, minimalColumns)
    .gte("created_at", startIso)
    .lt("created_at", endIso);
  if (params.cursor) {
    scanQuery = scanQuery
      .or(attendanceScanCursorFilter(params.cursor))
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
  } else {
    scanQuery = scanQuery
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
  }
  scanQuery = scanQuery.limit(queryLimit);

  const lastHourQuery = params.cursor
    ? null
    : baseScanQuery(admin, params.branchId, "id, request_id, operation_id, created_at")
        .gte("created_at", oneHourAgoIso)
        .order("created_at", { ascending: false })
        .limit(500);

  const [scanResult, lastHourResult] = await Promise.all([
    scanQuery,
    lastHourQuery ?? Promise.resolve({ data: null, error: null }),
  ]);
  if (scanResult.error) throw new Error(scanResult.error.message);
  if (lastHourResult.error) throw new Error(lastHourResult.error.message);

  const rawRows = (scanResult.data ?? []) as unknown as AttendanceRealtimeScanRow[];
  const mapped = await mapScanRows({
    admin,
    rows: rawRows,
    branchId: params.branchId,
    branchName: params.branchName,
    timezone,
  });
  const operationRows = params.cursor
    ? (rawRows as LastHourScanRow[]).filter((row) => row.created_at > oneHourAgoIso)
    : ((lastHourResult.data ?? []) as unknown as LastHourScanRow[]);
  const lastHourOperations = operationRows.map(operationFromRow);

  return {
    selectedDate: params.selectedDate,
    timezone,
    branchId: params.branchId ?? null,
    branchName: params.branchName ?? null,
    items: params.cursor ? mapped : collapseRecentAttendanceScans(mapped, limit),
    lastHourCount: new Set(lastHourOperations.map((operation) => operation.operationId)).size,
    lastHourOperations,
    nextCursor: latestCursor(rawRows, params.cursor),
    error: null,
  };
}
