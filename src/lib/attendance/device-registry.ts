import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { asAttendanceDb } from "@/lib/attendance/db";
import { displayDeviceLabel } from "@/lib/attendance/device-display";
import { resolveDeviceRegistryStatus } from "@/lib/attendance/device-registry-status";
import type {
  AttendanceDeviceRegistryData,
  AttendanceDeviceRegistryEntry,
  PendingDeviceRecoveryLink,
} from "@/lib/attendance/types";

type Relation<T> = T | T[] | null | undefined;

type BranchRow = {
  id: string;
  name: string | null;
};

type StaffRow = {
  id: string;
  branch_id: string;
  full_name: string;
  nickname: string | null;
  avatar_url: string | null;
  staff_type: string | null;
  is_active: boolean;
  branches?: Relation<{ name: string | null }>;
};

type DeviceRow = {
  id: string;
  staff_id: string;
  branch_id: string;
  device_label: string | null;
  status: "active" | "revoked";
  trusted_after: string;
  last_seen_at: string | null;
  created_at: string;
  registration_source: string | null;
  browser_name: string | null;
  browser_version: string | null;
  platform_name: string | null;
  last_attendance_scan_at: string | null;
  last_service_scan_at: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  revocation_reason: string | null;
};

type TokenRow = {
  id: string;
  staff_id: string;
  branch_id: string;
  reason: string | null;
  created_at: string;
  expires_at: string;
  revoke_previous_device_id: string | null;
};

type ScanRow = {
  device_id: string | null;
  scan_type: string;
  outcome: string;
  created_at: string;
};

type DeviceScanStats = {
  totalSuccessfulScans: number;
  lastAttendanceScanAt: string | null;
  lastServiceScanAt: string | null;
  lastScanAt: string | null;
};

type RegistryParams = {
  branchId: string;
  branchName: string;
  canSwitchBranch?: boolean;
};

function first<T>(value: Relation<T>): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function maxIso(current: string | null, next: string): string {
  if (!current) return next;
  return new Date(next).getTime() > new Date(current).getTime() ? next : current;
}

function emptyStats(): DeviceScanStats {
  return {
    totalSuccessfulScans: 0,
    lastAttendanceScanAt: null,
    lastServiceScanAt: null,
    lastScanAt: null,
  };
}

function buildScanStats(scans: ScanRow[]): Map<string, DeviceScanStats> {
  const byDevice = new Map<string, DeviceScanStats>();

  for (const scan of scans) {
    if (!scan.device_id || scan.outcome !== "success") continue;
    if (scan.scan_type !== "attendance" && scan.scan_type !== "room") continue;

    const stats = byDevice.get(scan.device_id) ?? emptyStats();
    stats.totalSuccessfulScans += 1;
    stats.lastScanAt = maxIso(stats.lastScanAt, scan.created_at);
    if (scan.scan_type === "attendance") {
      stats.lastAttendanceScanAt = maxIso(stats.lastAttendanceScanAt, scan.created_at);
    }
    if (scan.scan_type === "room") {
      stats.lastServiceScanAt = maxIso(stats.lastServiceScanAt, scan.created_at);
    }
    byDevice.set(scan.device_id, stats);
  }

  return byDevice;
}

function toPendingRecoveryLink(token: TokenRow, staff: StaffRow, branchName: string): PendingDeviceRecoveryLink {
  return {
    id: token.id,
    staffId: token.staff_id,
    staffName: staff.full_name,
    staffNickname: staff.nickname,
    branchId: token.branch_id,
    branchName,
    reason: token.reason ?? "other",
    createdAt: token.created_at,
    expiresAt: token.expires_at,
    revokePreviousDeviceId: token.revoke_previous_device_id,
  };
}

function toEntry(params: {
  staff: StaffRow;
  branchName: string;
  device: DeviceRow | null;
  pendingRecovery: TokenRow | null;
  stats: DeviceScanStats;
}): AttendanceDeviceRegistryEntry {
  const branchName = first(params.staff.branches)?.name ?? params.branchName;
  const device = params.device;
  const status = resolveDeviceRegistryStatus({
    staffIsActive: params.staff.is_active,
    hasPendingRecovery: Boolean(params.pendingRecovery),
    hasDevice: Boolean(device),
    deviceStatus: device?.status ?? null,
    totalSuccessfulScans: params.stats.totalSuccessfulScans,
  });

  return {
    rowId: device?.id ?? `staff-${params.staff.id}-no-device`,
    staffId: params.staff.id,
    staffName: params.staff.full_name,
    staffNickname: params.staff.nickname,
    avatarUrl: params.staff.avatar_url,
    staffType: params.staff.staff_type ?? "staff",
    staffIsActive: params.staff.is_active,
    homeBranchId: params.staff.branch_id,
    homeBranchName: branchName,
    status,
    device: device
      ? {
          id: device.id,
          label: displayDeviceLabel(device.device_label, device.platform_name),
          browserName: device.browser_name,
          browserVersion: device.browser_version,
          platformName: device.platform_name,
          registeredAt: device.created_at,
          registrationSource: device.registration_source,
          registeredBranchId: device.branch_id,
          registeredBranchName: branchName,
          lastSeenAt: device.last_seen_at,
          lastAttendanceScanAt: device.last_attendance_scan_at ?? params.stats.lastAttendanceScanAt,
          lastServiceScanAt: device.last_service_scan_at ?? params.stats.lastServiceScanAt,
          lastScanAt: params.stats.lastScanAt,
          totalSuccessfulScans: params.stats.totalSuccessfulScans,
          isActive: device.status === "active",
          revokedAt: device.revoked_at,
          revokedByName: null,
          revocationReason: device.revocation_reason,
        }
      : null,
    pendingRecovery: params.pendingRecovery
      ? {
          id: params.pendingRecovery.id,
          reason: params.pendingRecovery.reason ?? "other",
          createdAt: params.pendingRecovery.created_at,
          expiresAt: params.pendingRecovery.expires_at,
          revokePreviousDeviceId: params.pendingRecovery.revoke_previous_device_id,
        }
      : null,
  };
}

async function loadBranches(canSwitchBranch: boolean): Promise<BranchRow[]> {
  if (!canSwitchBranch) return [];
  const admin = asAttendanceDb(createAdminClient());
  const { data, error } = await admin
    .from("branches")
    .select("id, name")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as BranchRow[];
}

export async function getAttendanceDeviceRegistry(params: RegistryParams): Promise<AttendanceDeviceRegistryData> {
  const admin = asAttendanceDb(createAdminClient());
  const now = new Date().toISOString();

  const [branches, staffResult, devicesResult, tokensResult, scansResult] = await Promise.all([
    loadBranches(params.canSwitchBranch ?? false),
    admin
      .from("staff")
      .select("id, branch_id, full_name, nickname, avatar_url, staff_type, is_active, branches(name)")
      .eq("branch_id", params.branchId)
      .order("is_active", { ascending: false })
      .order("full_name", { ascending: true }),
    admin
      .from("staff_devices")
      .select("id, staff_id, branch_id, device_label, status, trusted_after, last_seen_at, created_at, registration_source, browser_name, browser_version, platform_name, last_attendance_scan_at, last_service_scan_at, revoked_at, revoked_by, revocation_reason")
      .eq("branch_id", params.branchId)
      .order("created_at", { ascending: false }),
    admin
      .from("device_activation_tokens")
      .select("id, staff_id, branch_id, reason, created_at, expires_at, revoke_previous_device_id")
      .eq("branch_id", params.branchId)
      .eq("purpose", "device_recovery")
      .is("used_at", null)
      .is("revoked_at", null)
      .gt("expires_at", now)
      .order("expires_at", { ascending: true }),
    admin
      .from("qr_scan_events")
      .select("device_id, scan_type, outcome, created_at")
      .eq("branch_id", params.branchId)
      .not("device_id", "is", null)
      .in("scan_type", ["attendance", "room"])
      .order("created_at", { ascending: false })
      .limit(5000),
  ]);

  if (staffResult.error) throw new Error(staffResult.error.message);
  if (devicesResult.error) throw new Error(devicesResult.error.message);
  if (tokensResult.error) throw new Error(tokensResult.error.message);
  if (scansResult.error) throw new Error(scansResult.error.message);

  const staffRows = ((staffResult.data ?? []) as unknown as StaffRow[]).filter((staff) => staff.branch_id === params.branchId);
  const staffById = new Map(staffRows.map((staff) => [staff.id, staff]));
  const devices = (devicesResult.data ?? []) as DeviceRow[];
  const tokens = (tokensResult.data ?? []) as TokenRow[];
  const pendingByStaff = new Map<string, TokenRow>();

  for (const token of tokens) {
    if (!pendingByStaff.has(token.staff_id)) pendingByStaff.set(token.staff_id, token);
  }

  const statsByDevice = buildScanStats((scansResult.data ?? []) as ScanRow[]);
  const devicesByStaff = new Map<string, DeviceRow[]>();
  for (const device of devices) {
    const existing = devicesByStaff.get(device.staff_id) ?? [];
    existing.push(device);
    devicesByStaff.set(device.staff_id, existing);
  }

  const entries: AttendanceDeviceRegistryEntry[] = [];
  for (const staff of staffRows) {
    const staffDevices = devicesByStaff.get(staff.id) ?? [];
    const pendingRecovery = pendingByStaff.get(staff.id) ?? null;

    if (staffDevices.length === 0) {
      entries.push(toEntry({
        staff,
        branchName: params.branchName,
        device: null,
        pendingRecovery,
        stats: emptyStats(),
      }));
      continue;
    }

    for (const device of staffDevices) {
      entries.push(toEntry({
        staff,
        branchName: params.branchName,
        device,
        pendingRecovery,
        stats: statsByDevice.get(device.id) ?? emptyStats(),
      }));
    }
  }

  const pendingRecoveryLinks = tokens
    .map((token) => {
      const staff = staffById.get(token.staff_id);
      return staff ? toPendingRecoveryLink(token, staff, params.branchName) : null;
    })
    .filter((token): token is PendingDeviceRecoveryLink => Boolean(token));

  return {
    branchId: params.branchId,
    branchName: params.branchName,
    canSwitchBranch: params.canSwitchBranch ?? false,
    branches: branches.map((branch) => ({ id: branch.id, name: branch.name ?? "Branch" })),
    staffOptions: staffRows
      .filter((staff) => staff.is_active)
      .map((staff) => ({
        id: staff.id,
        name: staff.full_name,
        staffType: staff.staff_type ?? "staff",
        branchId: staff.branch_id,
        branchName: first(staff.branches)?.name ?? params.branchName,
      })),
    activeDevices: devices
      .filter((device) => device.status === "active")
      .map((device) => ({
        id: device.id,
        staffId: device.staff_id,
        label: displayDeviceLabel(device.device_label, device.platform_name),
      })),
    entries,
    pendingRecoveryLinks,
  };
}

export async function getPendingDeviceRecoveryLinks(params: RegistryParams): Promise<PendingDeviceRecoveryLink[]> {
  const registry = await getAttendanceDeviceRegistry(params);
  return registry.pendingRecoveryLinks;
}

export async function getAttendanceDeviceDetails(params: {
  branchId: string;
  branchName: string;
  deviceId: string;
}): Promise<AttendanceDeviceRegistryEntry | null> {
  const registry = await getAttendanceDeviceRegistry({
    branchId: params.branchId,
    branchName: params.branchName,
  });
  return registry.entries.find((entry) => entry.device?.id === params.deviceId) ?? null;
}

export async function getDeviceScanHistory(params: {
  branchId: string;
  deviceId: string;
  limit?: number;
}) {
  const admin = asAttendanceDb(createAdminClient());
  const { data, error } = await admin
    .from("qr_scan_events")
    .select("id, scan_type, action, outcome, reason_code, message, created_at, staff_id, booking_id, resource_id, qr_points(label)")
    .eq("branch_id", params.branchId)
    .eq("device_id", params.deviceId)
    .order("created_at", { ascending: false })
    .limit(params.limit ?? 100);
  if (error) throw new Error(error.message);
  return data ?? [];
}
