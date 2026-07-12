import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { asAttendanceDb, type AttendanceDb } from "@/lib/attendance/db";
import {
  mapRecentScan,
  type RecentScanRow,
} from "@/lib/attendance/recent-scans-map";
import type {
  AttendanceScanFeedData,
  AttendanceScanFeedWorkspace,
  RecentAttendanceScan,
} from "@/lib/attendance/types";

type RecentScanFeedParams = {
  workspace: AttendanceScanFeedWorkspace;
  selectedDate: string;
  branchId?: string | null;
  branchName?: string | null;
  maxItems?: number;
};

function dateBoundaryIso(date: string, dayOffset = 0): string {
  const [year, month, day] = date.split("-").map(Number);
  const utcMs = Date.UTC(
    year ?? 1970,
    (month ?? 1) - 1,
    (day ?? 1) + dayOffset,
    -8,
    0,
    0,
    0
  );
  return new Date(utcMs).toISOString();
}

function safeLimit(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) return 5;
  return Math.max(1, Math.min(10, Math.floor(value)));
}

function baseScanQuery(
  admin: AttendanceDb,
  branchId: string | null | undefined,
  columns: string,
  options?: { count?: "exact"; head?: boolean }
) {
  let query = admin
    .from("qr_scan_events")
    .select(columns, options)
    .eq("scan_type", "attendance")
    .eq("outcome", "success")
    .eq("is_test", false)
    .in("action", ["clock_in", "clock_out"]);

  if (branchId) query = query.eq("branch_id", branchId);
  return query;
}

export function createAttendanceScanFeedFallback(
  params: RecentScanFeedParams & { error?: string | null }
): AttendanceScanFeedData {
  return {
    selectedDate: params.selectedDate,
    branchId: params.branchId ?? null,
    branchName: params.branchName ?? null,
    items: [],
    lastHourCount: 0,
    error: params.error ?? null,
  };
}

export async function getRecentAttendanceScanFeed(
  params: RecentScanFeedParams
): Promise<AttendanceScanFeedData> {
  const admin = asAttendanceDb(createAdminClient());
  const limit = safeLimit(params.maxItems);
  const startIso = dateBoundaryIso(params.selectedDate);
  const endIso = dateBoundaryIso(params.selectedDate, 1);
  const oneHourAgoIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const scanQuery = baseScanQuery(
    admin,
    params.branchId,
    [
      "id",
      "branch_id",
      "staff_id",
      "action",
      "created_at",
      "staff(id, full_name, nickname, avatar_url)",
      "branches(id, name)",
      "qr_points(label)",
      "checkin:staff_shift_checkins!qr_scan_events_checkin_id_fkey(shift_type, attendance_status, worked_minutes, checked_in_at, checked_out_at)",
    ].join(", ")
  )
    .gte("created_at", startIso)
    .lt("created_at", endIso)
    .order("created_at", { ascending: false })
    .limit(limit);

  const countQuery = baseScanQuery(admin, params.branchId, "id", {
    count: "exact",
    head: true,
  })
    .gte("created_at", oneHourAgoIso);

  const [scanResult, countResult] = await Promise.all([scanQuery, countQuery]);
  if (scanResult.error) throw new Error(scanResult.error.message);
  if (countResult.error) throw new Error(countResult.error.message);

  return {
    selectedDate: params.selectedDate,
    branchId: params.branchId ?? null,
    branchName: params.branchName ?? null,
    items: ((scanResult.data ?? []) as unknown as RecentScanRow[])
      .map((row) => mapRecentScan(row, params))
      .filter((row): row is RecentAttendanceScan => row !== null),
    lastHourCount: countResult.count ?? 0,
    error: null,
  };
}
