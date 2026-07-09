import fs from "node:fs";
import path from "node:path";

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}
loadEnv();

import { createAdminClient } from "@/lib/supabase/admin";

const PUBLIC_CODE = "att_TfTw_tTF9HzJoyPuVloxwKsF";

function isMainBranch(name: string) {
  return name.toLowerCase().includes("main");
}

async function run() {
  const admin = createAdminClient();

  const { data: allBranches, error: branchesError } = await admin.from("branches").select("id, name");
  if (branchesError) {
    console.error("Could not load branches:", branchesError.message);
    return;
  }
  const branchMap = new Map((allBranches ?? []).map((b) => [b.id, b.name]));
  const mainBranch = (allBranches ?? []).find((b) => isMainBranch(b.name));
  const mainBranchId = mainBranch?.id;

  console.log("=== DIAGNOSTIC 1: Identify this QR code ===\n");
  const { data: qr1, error: qr1Error } = await admin
    .from("qr_points")
    .select(
      "id, label, public_code, point_type, branch_id, is_active, requires_registered_device, scan_behavior, created_at, updated_at"
    )
    .eq("public_code", PUBLIC_CODE)
    .maybeSingle();

  if (qr1Error) {
    console.error("QR lookup error:", qr1Error.message);
    return;
  }

  if (!qr1) {
    console.log("Result: public_code DOES NOT EXIST");
    return;
  }

  const qr1BranchName = branchMap.get(qr1.branch_id) ?? "(unknown)";
  console.log("QR public_code:", qr1.public_code);
  console.log("QR label:", qr1.label);
  console.log("QR point_type:", qr1.point_type);
  console.log("QR is_active:", qr1.is_active);
  console.log("QR branch_id:", qr1.branch_id);
  console.log("QR branch_name:", qr1BranchName);
  console.log("QR requires_registered_device:", qr1.requires_registered_device);
  console.log("QR scan_behavior:", qr1.scan_behavior);
  console.log();

  console.log("=== DIAGNOSTIC 2: List all attendance QRs ===\n");
  const { data: allAttendanceQrs, error: allQrsError } = await admin
    .from("qr_points")
    .select(
      "id, label, public_code, point_type, branch_id, is_active, requires_registered_device, scan_behavior, created_at, updated_at"
    )
    .eq("point_type", "attendance")
    .order("branch_id", { ascending: true })
    .order("created_at", { ascending: false });

  if (allQrsError) {
    console.error("Attendance QR list error:", allQrsError.message);
    return;
  }

  console.log("Total attendance QR points:", (allAttendanceQrs ?? []).length);
  for (const q of allAttendanceQrs ?? []) {
    const branchName = branchMap.get(q.branch_id) ?? "?";
    console.log(
      `- [${q.is_active ? "ACTIVE" : "inactive"}] ${branchName} | ${q.label} | ${q.public_code} | branch_id=${q.branch_id}`
    );
  }
  console.log();

  console.log("=== DIAGNOSTIC 3: Recent wrong_branch events ===\n");
  const { data: wrongEvents, error: eventsError } = await admin
    .from("qr_scan_events")
    .select(
      "id, created_at, outcome, reason_code, message, branch_id, qr_point_id, staff_id, device_id, metadata"
    )
    .eq("reason_code", "wrong_branch")
    .order("created_at", { ascending: false })
    .limit(100);

  if (eventsError) {
    console.error("wrong_branch events error:", eventsError.message);
    return;
  }

  const events = wrongEvents ?? [];
  console.log("Recent wrong_branch events:", events.length);

  if (events.length === 0) {
    console.log("No wrong_branch scan events found.\n");
  } else {
    const qrIds = new Set<string>();
    const staffIds = new Set<string>();
    const deviceIds = new Set<string>();

    for (const e of events) {
      if (e.qr_point_id) qrIds.add(e.qr_point_id);
      if (e.staff_id) staffIds.add(e.staff_id);
      if (e.device_id) deviceIds.add(e.device_id);
    }

    const [{ data: qrPoints }, { data: staffRows }, { data: devices }] = await Promise.all([
      admin.from("qr_points").select("id, label, public_code, branch_id, point_type").in("id", Array.from(qrIds)),
      admin.from("staff").select("id, full_name, nickname, branch_id").in("id", Array.from(staffIds)),
      admin.from("staff_devices").select("id, staff_id, branch_id, status, device_label, registration_source, created_at, last_seen_at, last_attendance_scan_at").in("id", Array.from(deviceIds)),
    ]);

    const qrMap = new Map((qrPoints ?? []).map((q) => [q.id, q]));
    const staffMap = new Map((staffRows ?? []).map((s) => [s.id, s]));
    const deviceMap = new Map((devices ?? []).map((d) => [d.id, d]));

    console.log(
      "scan_event_id | created_at | qr_label | qr_branch | staff_name | staff_branch | device_branch | cause"
    );
    console.log("-".repeat(140));

    const causeCounts = {
      wrong_printed_qr: 0,
      qr_mislabeled: 0,
      staff_branch_mismatch: 0,
      device_branch_mismatch: 0,
      staff_unresolved: 0,
      unknown: 0,
    };

    for (const e of events.slice(0, 20)) {
      const qr = e.qr_point_id ? qrMap.get(e.qr_point_id) : undefined;
      const staff = e.staff_id ? staffMap.get(e.staff_id) : undefined;
      const device = e.device_id ? deviceMap.get(e.device_id) : undefined;

      const qrBranchName = qr?.branch_id ? branchMap.get(qr.branch_id) : undefined;
      const staffBranchName = staff?.branch_id ? branchMap.get(staff.branch_id) : undefined;
      const deviceBranchName = device?.branch_id ? branchMap.get(device.branch_id) : undefined;

      let cause: keyof typeof causeCounts = "unknown";
      if (!qr) {
        cause = "unknown";
      } else if (mainBranchId && qr.branch_id !== mainBranchId) {
        cause = "wrong_printed_qr";
      } else if (!staff) {
        cause = "staff_unresolved";
      } else if (mainBranchId && staff.branch_id !== mainBranchId) {
        cause = "staff_branch_mismatch";
      } else if (device && mainBranchId && device.branch_id !== mainBranchId) {
        cause = "device_branch_mismatch";
      } else if (qr.label?.toLowerCase().includes("main") && mainBranchId && qr.branch_id !== mainBranchId) {
        cause = "qr_mislabeled";
      }

      causeCounts[cause]++;

      console.log(
        `${e.id.slice(0, 8)} | ${e.created_at?.slice(0, 19) ?? ""} | ${qr?.label ?? "?"} | ${qrBranchName ?? "?"} | ${staff?.full_name ?? "?"} | ${staffBranchName ?? "?"} | ${deviceBranchName ?? "n/a"} | ${cause}`
      );
    }

    console.log("\nCause counts (sample of 20 most recent):");
    console.log(causeCounts);
    console.log();
  }

  console.log("=== DIAGNOSTIC 4: Staff branch assignments ===\n");
  const { data: staffList, error: staffError } = await admin
    .from("staff")
    .select("id, full_name, nickname, staff_type, system_role, branch_id, is_active, auth_user_id")
    .eq("is_active", true)
    .order("branch_id", { ascending: true })
    .order("full_name", { ascending: true });

  if (staffError) {
    console.error("Staff lookup error:", staffError.message);
    return;
  }

  const byBranch = new Map<string, number>();
  const mainStaff: typeof staffList = [];
  const missingAuth: typeof staffList = [];

  for (const s of staffList ?? []) {
    const branchName = branchMap.get(s.branch_id) ?? "(no branch)";
    byBranch.set(branchName, (byBranch.get(branchName) ?? 0) + 1);
    if (mainBranchId && s.branch_id === mainBranchId) mainStaff.push(s);
    if (!s.auth_user_id) missingAuth.push(s);
  }

  console.log("Active staff by branch:");
  for (const [name, count] of byBranch.entries()) {
    console.log(`- ${name}: ${count}`);
  }
  console.log("\nMAIN branch staff count:", mainStaff.length);
  const nonMainStaff = (staffList ?? []).filter((s) => !mainBranchId || s.branch_id !== mainBranchId);
  if (nonMainStaff.length > 0) {
    console.log("\nNon-MAIN active staff:");
    for (const s of nonMainStaff) {
      console.log(`- ${s.full_name} (${s.nickname ?? ""}) | ${branchMap.get(s.branch_id) ?? "?"}`);
    }
  }
  if (missingAuth.length > 0) {
    console.log(`\nStaff missing auth_user_id: ${missingAuth.length}`);
    for (const s of missingAuth) {
      const branchName = branchMap.get(s.branch_id) ?? "?";
      console.log(`- ${s.full_name} | ${branchName}`);
    }
  }
  console.log();

  console.log("=== DIAGNOSTIC 5: Active device branch mismatches ===\n");
  const { data: deviceRows, error: deviceError } = await admin
    .from("staff_devices")
    .select(
      "id, staff_id, branch_id, status, device_label, registration_source, created_at, last_seen_at, last_attendance_scan_at"
    )
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (deviceError) {
    console.error("Device lookup error:", deviceError.message);
    return;
  }

  const activeDeviceStaffIds = new Set((deviceRows ?? []).map((d) => d.staff_id).filter(Boolean));
  const { data: deviceStaffRows } = await admin
    .from("staff")
    .select("id, full_name, nickname, branch_id")
    .in("id", Array.from(activeDeviceStaffIds));
  const deviceStaffMap = new Map((deviceStaffRows ?? []).map((s) => [s.id, s]));

  const mismatchedDevices: typeof deviceRows = [];
  for (const d of deviceRows ?? []) {
    const staff = deviceStaffMap.get(d.staff_id);
    if (staff && staff.branch_id && d.branch_id && staff.branch_id !== d.branch_id) {
      mismatchedDevices.push(d);
    }
  }

  console.log("Active devices:", (deviceRows ?? []).length);
  console.log("Devices with branch_id != staff.branch_id:", mismatchedDevices.length);

  if (mismatchedDevices.length > 0) {
    console.log("\nMismatched devices:");
    for (const d of mismatchedDevices) {
      const staff = deviceStaffMap.get(d.staff_id);
      console.log(
        `- device=${d.id.slice(0, 8)} staff=${staff?.full_name ?? "?"} staff_branch=${branchMap.get(staff?.branch_id ?? "") ?? "?"} device_branch=${branchMap.get(d.branch_id) ?? "?"} label=${d.device_label ?? ""}`
      );
    }
  }
  console.log();

  console.log("=== SUMMARY ===");
  console.log("QR public_code checked:", PUBLIC_CODE);
  console.log("QR label:", qr1.label);
  console.log("QR point_type:", qr1.point_type);
  console.log("QR is_active:", qr1.is_active);
  console.log("QR branch_id:", qr1.branch_id);
  console.log("QR branch_name:", qr1BranchName);
  console.log("MAIN branch detected:", mainBranch?.name ?? "(none)", "id=", mainBranchId ?? "(none)");
  console.log("QR belongs to MAIN:", mainBranchId ? qr1.branch_id === mainBranchId : "unknown");
}

run().catch((err) => {
  console.error("Diagnostic failed:", err);
  process.exit(1);
});
