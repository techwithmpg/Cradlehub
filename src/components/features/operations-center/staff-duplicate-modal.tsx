"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Info,
  Lock,
  ShieldAlert,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { OperationalStaffMember } from "@/lib/operations-center/issue-model";
import type { AttendanceWorkspaceData } from "@/lib/attendance/types";

type StaffDuplicateModalProps = {
  open: boolean;
  branchId?: string;
  branchName: string;
  initialStaffId?: string | null;
  branchStaff: OperationalStaffMember[];
  attendanceData: AttendanceWorkspaceData | null;
  onClose: () => void;
};

export function StaffDuplicateModal({
  open,
  branchName,
  initialStaffId,
  branchStaff,
  attendanceData,
  onClose,
}: StaffDuplicateModalProps) {
  // Derive suspected counterpart purely during render/memo without side-effects
  const suspectedCounterpart = useMemo(() => {
    if (!initialStaffId) return null;
    const current = branchStaff.find((s) => s.id === initialStaffId);
    if (!current) return null;
    const normName = current.full_name.trim().toLowerCase();
    const normPhone = current.phone?.replace(/\D/g, "") ?? "";
    return (
      branchStaff.find((s) => {
        if (s.id === current.id) return false;
        const otherName = s.full_name.trim().toLowerCase();
        const otherPhone = s.phone?.replace(/\D/g, "") ?? "";
        return (
          (normName.length > 2 && normName === otherName) ||
          (normPhone.length >= 7 && normPhone === otherPhone)
        );
      }) ?? null
    );
  }, [initialStaffId, branchStaff]);

  const [selectedIdA, setSelectedIdA] = useState<string>(initialStaffId ?? "");
  const [selectedIdB, setSelectedIdB] = useState<string>("");

  if (!open) return null;

  const effectiveIdB = selectedIdB || suspectedCounterpart?.id || "";

  const staffA = branchStaff.find((s) => s.id === selectedIdA) ?? null;
  const staffB = branchStaff.find((s) => s.id === effectiveIdB) ?? null;

  // Review Item 4: Count all active devices across registry, devices array, and entries
  const getDevicesCount = (staffId: string) => {
    if (!attendanceData) return 0;
    const deviceIds = new Set<string>();

    if (Array.isArray(attendanceData.deviceRegistry?.activeDevices)) {
      for (const d of attendanceData.deviceRegistry.activeDevices) {
        if (d.staffId === staffId && d.id) deviceIds.add(d.id);
      }
    }
    if (Array.isArray(attendanceData.devices)) {
      for (const d of attendanceData.devices) {
        if (d.staff_id === staffId && d.status === "active" && d.id) deviceIds.add(d.id);
      }
    }
    if (Array.isArray(attendanceData.deviceRegistry?.entries)) {
      for (const e of attendanceData.deviceRegistry.entries) {
        if (e.staffId === staffId && e.device?.isActive && e.device.id) {
          deviceIds.add(e.device.id);
        }
      }
    }
    return deviceIds.size;
  };

  // Retrieve today's scan attempts count
  const getScansCount = (staffId: string) => {
    return attendanceData?.scanEvents.filter((e) => e.staff_id === staffId).length ?? 0;
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-[min(100%-2rem,720px)] overflow-y-auto p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-[var(--cs-border-soft)] p-5 pr-12">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--cs-text-muted)]">
            <Users size={14} aria-hidden />
            Staff &amp; Identity Review · {branchName}
          </div>
          <DialogTitle className="mt-1 text-lg font-bold">
            Compare Potential Duplicate Staff Records
          </DialogTitle>
          <DialogDescription className="text-sm text-[var(--cs-text-secondary)]">
            Review identity, account status, device links, and historical activity side by side.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 p-5 text-sm">
          {/* Security & Audit Safeguard Notice */}
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
            <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wide text-amber-900">
              <ShieldAlert size={16} className="text-amber-800" aria-hidden />
              Non-Destructive Review Safeguard Active
            </div>
            <p className="mt-1.5 text-xs font-medium leading-5">
              <strong>Automatic deletion and merging are strictly disabled.</strong> Historical attendance records, payroll entries, booking assignments, and audit logs are bound to staff records. Deleting or merging records without an authorized migration contract causes irreversible foreign-key corruption.
            </p>
          </div>

          {/* Account Selection Controls */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="staff-select-a" className="block text-xs font-bold uppercase text-[var(--cs-text-muted)]">
                Staff Profile A
              </label>
              <select
                id="staff-select-a"
                value={selectedIdA}
                onChange={(e) => setSelectedIdA(e.target.value)}
                className="min-h-10 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-sm focus:border-[var(--cs-sand)] focus:outline-none"
              >
                <option value="">-- Choose Profile A --</option>
                {branchStaff.map((s) => (
                  <option key={s.id} value={s.id} disabled={s.id === effectiveIdB}>
                    {s.full_name} ({s.staff_type.replace(/_/g, " ")}) {s.is_active ? "" : "[Inactive]"}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="staff-select-b" className="block text-xs font-bold uppercase text-[var(--cs-text-muted)]">
                Staff Profile B (Suspected Duplicate)
              </label>
              <select
                id="staff-select-b"
                value={effectiveIdB}
                onChange={(e) => setSelectedIdB(e.target.value)}
                className="min-h-10 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-sm focus:border-[var(--cs-sand)] focus:outline-none"
              >
                <option value="">-- Choose Profile B --</option>
                {branchStaff.map((s) => (
                  <option key={s.id} value={s.id} disabled={s.id === selectedIdA}>
                    {s.full_name} ({s.staff_type.replace(/_/g, " ")}) {s.is_active ? "" : "[Inactive]"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Side-by-Side Comparison */}
          {staffA && staffB ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <ProfileCard
                  label="Profile A"
                  staff={staffA}
                  devicesCount={getDevicesCount(staffA.id)}
                  scansCount={getScansCount(staffA.id)}
                />
                <ProfileCard
                  label="Profile B"
                  staff={staffB}
                  devicesCount={getDevicesCount(staffB.id)}
                  scansCount={getScansCount(staffB.id)}
                />
              </div>

              {/* Review Item 3: Display activity indicators as unverified evidence requiring manual identity review */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-blue-950">
                <div className="flex items-center gap-1.5 font-bold text-blue-900">
                  <Info size={15} aria-hidden />
                  Unverified Diagnostic Evidence for Manual Review
                </div>
                <p className="mt-1 leading-5 text-blue-900/90">
                  The activity indicators above represent raw system records across login, phone, and attendance tables to assist authorized staff during manual review.
                  The system does <strong>not</strong> designate a primary account or make automated decisions.
                  Staff managers must verify identity directly with the employee before modifying accounts in Staff Management.
                </p>
              </div>

              {/* Missing Backend Contract Specification */}
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-xs leading-5 text-stone-700">
                <div className="flex items-center gap-1.5 font-bold text-stone-900">
                  <Lock size={14} className="text-stone-600" aria-hidden />
                  Required Backend Contract for Identity Consolidation
                </div>
                <p className="mt-1">
                  CradleHub&apos;s database architecture contains foreign keys across <code>bookings</code>, <code>attendance_records</code>, <code>payroll_entries</code>, and <code>device_activation_tokens</code>.
                  To merge accounts safely without data loss, a dedicated server transaction must:
                </p>
                <ol className="mt-2 list-decimal space-y-1 pl-4 text-stone-600">
                  <li>Migrate all booking references (<code>bookings.staff_id</code>) to the surviving profile.</li>
                  <li>Reassign attendance sessions and verify no duplicate punch intervals exist.</li>
                  <li>Reassign registered device tokens or revoke superseded hardware tokens.</li>
                  <li>Set <code>merged_into_staff_id = target_id</code> and <code>is_active = false</code> atomically.</li>
                  <li>Record an immutable governance audit log specifying reviewer and rationale.</li>
                </ol>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--cs-border)] p-8 text-center text-xs text-[var(--cs-text-muted)]">
              Select two staff members above to compare identity status, device links, and historical records.
            </div>
          )}
        </div>

        <DialogFooter className="mx-0 mb-0 flex-wrap gap-2 border-t border-[var(--cs-border-soft)] p-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          {staffA ? (
            <Button asChild variant="outline" className="text-xs">
              <Link href={`/crm/staff?tab=management&staffId=${encodeURIComponent(staffA.id)}`}>
                Review Profile A in Staff Management <ArrowUpRight size={13} className="ml-1" aria-hidden />
              </Link>
            </Button>
          ) : null}
          {staffB ? (
            <Button asChild variant="outline" className="text-xs">
              <Link href={`/crm/staff?tab=management&staffId=${encodeURIComponent(staffB.id)}`}>
                Review Profile B in Staff Management <ArrowUpRight size={13} className="ml-1" aria-hidden />
              </Link>
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProfileCard({
  label,
  staff,
  devicesCount,
  scansCount,
}: {
  label: string;
  staff: OperationalStaffMember;
  devicesCount: number;
  scansCount: number;
}) {
  return (
    <div className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4 text-xs">
      <div className="flex items-center justify-between gap-1">
        <span className="font-bold uppercase tracking-wider text-[var(--cs-text-muted)]">{label}</span>
        <span className={`font-semibold ${staff.is_active ? "text-emerald-700" : "text-amber-700"}`}>
          {staff.is_active ? "Active Profile" : "Inactive Profile"}
        </span>
      </div>

      <div className="mt-2 text-sm font-bold text-stone-900">{staff.full_name}</div>
      {staff.nickname ? (
        <div className="text-[11px] text-[var(--cs-text-muted)]">
          Nickname: &ldquo;{staff.nickname}&rdquo;
        </div>
      ) : null}

      <div className="mt-3 space-y-1.5 border-t border-[var(--cs-border-soft)] pt-2.5">
        <div className="flex justify-between">
          <span className="text-[var(--cs-text-muted)]">Role &amp; Staff Type:</span>
          <span className="font-medium text-stone-800">{staff.system_role} · {staff.staff_type}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--cs-text-muted)]">Phone on Record:</span>
          <span className="font-mono text-stone-800">{staff.phone || "None on file"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--cs-text-muted)]">Login Identity:</span>
          <span className="font-medium text-stone-800">
            {staff.auth_user_id ? "Linked to login account" : "No login account linked"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--cs-text-muted)]">Identity Verification:</span>
          <span className="font-medium text-stone-800">
            {staff.identity_verified_at ? `Verified on ${new Date(staff.identity_verified_at).toLocaleDateString()}` : "Unverified"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--cs-text-muted)]">Active Registered Phones:</span>
          <span className="font-semibold text-stone-800">{devicesCount} device(s)</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--cs-text-muted)]">Attendance Scans Today:</span>
          <span className="font-semibold text-stone-800">{scansCount}</span>
        </div>
      </div>
    </div>
  );
}
