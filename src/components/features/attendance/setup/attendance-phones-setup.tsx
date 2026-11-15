"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpDown,
  Clock3,
  FileText,
  MoreVertical,
  Plus,
  Search,
  Settings,
  Smartphone,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  StaffAvatar,
  formatAttendanceDateTime,
} from "@/components/features/attendance/attendance-ui";
import { DeviceRegistrationRequestsPanel } from "@/components/features/attendance/devices/device-registration-requests-panel";
import { RecoveryLinkDialog } from "@/components/features/attendance/devices/recovery-link-dialog";
import { RenameDeviceDialog } from "@/components/features/attendance/devices/rename-device-dialog";
import { RevokeDeviceDialog } from "@/components/features/attendance/devices/revoke-device-dialog";
import { AttendancePagination } from "@/components/features/attendance/shared/attendance-pagination";
import { CrmStatCard } from "@/components/features/crm/shared/crm-cards";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  formatAttendanceRole,
  formatDevicePlatformSummary,
} from "@/lib/attendance/crm-attendance-presenter";
import type {
  AttendanceDeviceRegistryEntry,
  AttendanceDeviceStatus,
  AttendanceWorkspaceData,
} from "@/lib/attendance/types";
import { cn } from "@/lib/utils";

type PhoneStatusFilter = "all" | "connected" | "disconnected" | "pending" | "never_used";
type PhonePlatformFilter = "all" | "android" | "ios" | "other";
type PhoneSortOrder = "last_used" | "name_az" | "status";

function normalizePlatformBucket(platformName: string | null | undefined): "android" | "ios" | "other" {
  const lower = (platformName ?? "").toLowerCase();
  if (lower.includes("android")) return "android";
  if (lower.includes("ios") || lower.includes("iphone") || lower.includes("ipad")) return "ios";
  return "other";
}

function phoneStatusDisplay(status: AttendanceDeviceStatus): {
  label: string;
  pillClass: string;
  dotClass: string;
} {
  if (status === "active") {
    return {
      label: "Connected",
      pillClass: "border-[#CFE5D6] bg-[#EEF7F1] text-[#1F4E33]",
      dotClass: "bg-[#2D6A45]",
    };
  }
  if (status === "recovery_pending") {
    return {
      label: "Pending",
      pillClass: "border-amber-200 bg-amber-50 text-amber-800",
      dotClass: "bg-amber-500",
    };
  }
  if (status === "revoked") {
    return {
      label: "Disconnected",
      pillClass: "border-stone-200 bg-stone-100 text-stone-700",
      dotClass: "bg-stone-400",
    };
  }
  if (status === "never_used") {
    return {
      label: "Never used",
      pillClass: "border-stone-200 bg-stone-100 text-stone-700",
      dotClass: "bg-stone-400",
    };
  }
  return {
    label: "Not connected",
    pillClass: "border-stone-200 bg-stone-100 text-stone-600",
    dotClass: "bg-stone-400",
  };
}

function roleBadgeClass(role: string): string {
  const lower = role.toLowerCase();
  if (lower.includes("nail")) return "border-stone-200 bg-stone-100 text-stone-700";
  if (lower.includes("manager")) return "border-[#EFE1BE] bg-[#FDF8EC] text-[#7D5A20]";
  return "border-[#E8DEC8] bg-[#FAF6EE] text-[#6E5329]";
}

export function AttendancePhonesSetup({
  data,
  initialStaffId,
  onRefresh,
}: {
  data: AttendanceWorkspaceData;
  initialStaffId?: string | null;
  onRefresh: () => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PhoneStatusFilter>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<PhonePlatformFilter>("all");
  const [sortOrder, setSortOrder] = useState<PhoneSortOrder>("last_used");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  const [selected, setSelected] = useState<AttendanceDeviceRegistryEntry | null>(
    () => data.deviceRegistry.entries.find((entry) => entry.staffId === initialStaffId) ?? null
  );
  const [dialog, setDialog] = useState<
    "activate" | "replace" | "rename" | "revoke" | "requests" | "manage" | null
  >(() => (initialStaffId ? "manage" : null));

  const allEntries = data.deviceRegistry.entries;
  const pendingRequestsCount = data.deviceRegistry.registrationRequests.filter(
    (req) => req.status === "pending"
  ).length;
  const connectedCount = allEntries.filter((e) => e.status === "active").length;
  const disconnectedCount = allEntries.filter(
    (e) => e.status === "revoked" || e.status === "no_device" || e.status === "never_used"
  ).length;
  const pendingOrRequestsCount =
    pendingRequestsCount > 0
      ? pendingRequestsCount
      : allEntries.filter((e) => e.status === "recovery_pending").length;

  const totalStaff = Math.max(1, allEntries.length);
  const connectedPct = Math.round((connectedCount / totalStaff) * 100);
  const disconnectedPct = Math.round((disconnectedCount / totalStaff) * 100);
  const pendingPct = Math.round((pendingOrRequestsCount / totalStaff) * 100);

  const roleOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of allEntries) {
      if (e.staffType) set.add(e.staffType);
    }
    return Array.from(set).sort((a, b) => formatAttendanceRole(a).localeCompare(formatAttendanceRole(b)));
  }, [allEntries]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = allEntries.filter((entry) => {
      if (statusFilter === "connected" && entry.status !== "active") return false;
      if (
        statusFilter === "disconnected" &&
        !["revoked", "no_device", "inactive_staff"].includes(entry.status)
      ) {
        return false;
      }
      if (statusFilter === "pending" && entry.status !== "recovery_pending") return false;
      if (statusFilter === "never_used" && entry.status !== "never_used") return false;

      if (roleFilter !== "all" && entry.staffType !== roleFilter) return false;

      if (platformFilter !== "all") {
        if (!entry.device) return false;
        if (normalizePlatformBucket(entry.device.platformName) !== platformFilter) return false;
      }

      if (query) {
        const hay = `${entry.staffName} ${entry.staffType} ${entry.device?.label ?? ""} ${entry.device?.platformName ?? ""} ${entry.device?.browserName ?? ""} ${entry.homeBranchName}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortOrder === "name_az") {
        return a.staffName.localeCompare(b.staffName);
      }
      if (sortOrder === "status") {
        return a.status.localeCompare(b.status) || a.staffName.localeCompare(b.staffName);
      }
      const aTime = a.device?.lastSeenAt ? new Date(a.device.lastSeenAt).getTime() : 0;
      const bTime = b.device?.lastSeenAt ? new Date(b.device.lastSeenAt).getTime() : 0;
      return bTime - aTime || a.staffName.localeCompare(b.staffName);
    });
  }, [allEntries, platformFilter, roleFilter, search, sortOrder, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedEntries = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, pageSize, safePage]);

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-[var(--cs-border-soft)] bg-white shadow-2xs">
        {/* Top Card Header + Action Buttons */}
        <div className="flex flex-col gap-3 border-b border-[var(--cs-border-soft)] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF7F1] text-[#1F4E33]">
              <Smartphone className="size-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-[var(--cs-text)] sm:text-lg">
                Staff Phones
              </h2>
              <p className="mt-0.5 text-xs text-[var(--cs-text-muted)]">
                Manage registered staff devices for QR scanning, attendance, and staff access.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDialog("requests")}
              className="h-9 rounded-lg border-[var(--cs-border)] bg-white px-3 text-xs font-semibold text-[var(--cs-text)] hover:bg-[#FAF8F5]"
            >
              <FileText className="mr-1.5 size-3.5 text-[var(--cs-text-muted)]" />
              <span>Phone Requests</span>
              {pendingRequestsCount > 0 ? (
                <span className="ml-1.5 rounded-md bg-[#EFE2BE] px-1.5 py-0.5 text-[0.68rem] font-bold text-[#6E531A]">
                  {pendingRequestsCount}
                </span>
              ) : null}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setSelected(null);
                setDialog("activate");
              }}
              className="h-9 rounded-lg bg-[#1F4E33] px-3.5 text-xs font-semibold text-white hover:bg-[#163B26]"
            >
              <Plus className="mr-1 size-3.5" />
              Add Phone
            </Button>
          </div>
        </div>

        {/* 4 Device Registration Summary Cards */}
        <div className="grid grid-cols-1 gap-3 border-b border-[var(--cs-border-soft)] bg-[#FAF8F5]/60 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <CrmStatCard
            title="Total Staff"
            value={allEntries.length}
            icon={<Users className="size-4.5" aria-hidden="true" />}
            tone="warning"
            active={statusFilter === "all"}
            ariaPressed={statusFilter === "all"}
            onClick={() => {
              setStatusFilter("all");
              setPage(1);
            }}
          />

          <CrmStatCard
            title="Connected"
            value={connectedCount}
            icon={<Wifi className="size-4.5" aria-hidden="true" />}
            tone="success"
            active={statusFilter === "connected"}
            ariaPressed={statusFilter === "connected"}
            badge={
              <span className="rounded-md bg-[#DCEFE3] px-2 py-0.5 text-[0.7rem] font-bold text-[#1F4E33] tabular-nums">
                {connectedPct}%
              </span>
            }
            onClick={() => {
              setStatusFilter((s) => (s === "connected" ? "all" : "connected"));
              setPage(1);
            }}
          />

          <CrmStatCard
            title="Disconnected"
            value={disconnectedCount}
            icon={<WifiOff className="size-4.5" aria-hidden="true" />}
            tone="danger"
            active={statusFilter === "disconnected"}
            ariaPressed={statusFilter === "disconnected"}
            badge={
              <span className="rounded-md bg-[#F8DFDF] px-2 py-0.5 text-[0.7rem] font-bold text-[#B42318] tabular-nums">
                {disconnectedPct}%
              </span>
            }
            onClick={() => {
              setStatusFilter((s) => (s === "disconnected" ? "all" : "disconnected"));
              setPage(1);
            }}
          />

          <CrmStatCard
            title="Pending Requests"
            value={pendingOrRequestsCount}
            icon={<Clock3 className="size-4.5" aria-hidden="true" />}
            tone="warning"
            badge={
              <span className="rounded-md bg-[#F5E9CB] px-2 py-0.5 text-[0.7rem] font-bold text-[#7D5A20] tabular-nums">
                {pendingPct}%
              </span>
            }
            onClick={() => setDialog("requests")}
          />
        </div>

        {/* Search & Filter Row */}
        <div className="grid gap-2.5 border-b border-[var(--cs-border-soft)] p-4 md:grid-cols-[minmax(220px,1.5fr)_repeat(4,minmax(125px,auto))]">
          <label className="relative block">
            <span className="sr-only">Search staff name, device, or phone</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--cs-text-muted)]" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search staff name, device, or phone..."
              className="h-9 rounded-lg border-[var(--cs-border)] bg-white pl-9 text-xs"
            />
          </label>

          <select
            aria-label="Filter by phone status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as PhoneStatusFilter);
              setPage(1);
            }}
            className="h-9 rounded-lg border border-[var(--cs-border)] bg-white px-3 text-xs font-semibold text-[var(--cs-text)] outline-none focus:border-[#1F4E33]"
          >
            <option value="all">All Status</option>
            <option value="connected">Connected</option>
            <option value="disconnected">Disconnected / Unlinked</option>
            <option value="pending">Pending Replacement</option>
            <option value="never_used">Never Used</option>
          </select>

          <select
            aria-label="Filter by staff role"
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-lg border border-[var(--cs-border)] bg-white px-3 text-xs font-semibold text-[var(--cs-text)] outline-none focus:border-[#1F4E33]"
          >
            <option value="all">All Roles</option>
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {formatAttendanceRole(role)}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by device platform"
            value={platformFilter}
            onChange={(e) => {
              setPlatformFilter(e.target.value as PhonePlatformFilter);
              setPage(1);
            }}
            className="h-9 rounded-lg border border-[var(--cs-border)] bg-white px-3 text-xs font-semibold text-[var(--cs-text)] outline-none focus:border-[#1F4E33]"
          >
            <option value="all">All Platforms</option>
            <option value="android">Android</option>
            <option value="ios">iPhone / iOS</option>
            <option value="other">Other</option>
          </select>

          <div className="relative">
            <ArrowUpDown className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--cs-text-muted)]" />
            <select
              aria-label="Sort staff phones"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as PhoneSortOrder)}
              className="h-9 w-full rounded-lg border border-[var(--cs-border)] bg-white pl-8 pr-3 text-xs font-semibold text-[var(--cs-text)] outline-none focus:border-[#1F4E33]"
            >
              <option value="last_used">Sort: Last Used</option>
              <option value="name_az">Sort: Name (A–Z)</option>
              <option value="status">Sort: Status</option>
            </select>
          </div>
        </div>

        {/* 6-Column Directory Table */}
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-[var(--cs-text-muted)]">
            No staff devices match the current filters.
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="border-b border-[var(--cs-border-soft)] bg-[#FAF8F5] text-[0.68rem] font-bold uppercase tracking-wider text-[var(--cs-text-muted)]">
                  <tr>
                    <th className="px-5 py-3">Staff Member</th>
                    <th className="px-3 py-3">Role</th>
                    <th className="px-3 py-3">Device / Platform</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Last Used</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--cs-border-soft)]">
                  {pagedEntries.map((entry) => {
                    const stat = phoneStatusDisplay(entry.status);
                    return (
                      <tr
                        key={`${entry.staffId}:${entry.rowId}`}
                        className="transition hover:bg-[#FAF8F5]"
                      >
                        <td className="px-5 py-3.5 align-middle">
                          <div className="flex items-center gap-2.5">
                            <StaffAvatar
                              name={entry.staffName}
                              className="size-9 bg-[#2D6A45] text-[0.7rem] font-bold text-white"
                            />
                            <span className="truncate text-xs font-bold text-[var(--cs-text)] sm:text-sm">
                              {entry.staffName}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3.5 align-middle">
                          <span
                            className={cn(
                              "inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold",
                              roleBadgeClass(entry.staffType)
                            )}
                          >
                            {formatAttendanceRole(entry.staffType)}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 align-middle">
                          {entry.device ? (
                            <div className="flex items-center gap-2.5">
                              <Smartphone className="size-4 shrink-0 text-[var(--cs-text-muted)]" />
                              <div className="min-w-0">
                                <div className="truncate text-xs font-bold text-[var(--cs-text)]">
                                  {formatDevicePlatformSummary(entry)}
                                </div>
                                <div className="truncate text-[0.7rem] text-[var(--cs-text-muted)]">
                                  {entry.device.label}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-[var(--cs-text-muted)]">
                              No phone connected
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3.5 align-middle">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold",
                              stat.pillClass
                            )}
                          >
                            <span className={cn("size-1.5 rounded-full", stat.dotClass)} />
                            {stat.label}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 align-middle text-xs">
                          <div className="font-semibold text-[var(--cs-text)] tabular-nums">
                            {entry.device?.lastSeenAt
                              ? formatAttendanceDateTime(entry.device.lastSeenAt, data.timezone)
                              : "Never"}
                          </div>
                          <div className="text-[0.7rem] text-[var(--cs-text-muted)]">
                            {entry.device?.registeredBranchName ?? entry.homeBranchName}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 align-middle">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelected(entry);
                                setDialog("manage");
                              }}
                              className="h-8 rounded-lg border-[var(--cs-border)] bg-white px-2.5 text-xs font-semibold hover:bg-[#FAF8F5]"
                            >
                              <Settings className="mr-1.5 size-3.5 text-[var(--cs-text-muted)]" />
                              Manage
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button
                                    type="button"
                                    size="icon-sm"
                                    variant="ghost"
                                    aria-label={`Actions for ${entry.staffName}`}
                                  />
                                }
                              >
                                <MoreVertical className="size-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelected(entry);
                                    setDialog(entry.device ? "replace" : "activate");
                                  }}
                                >
                                  {entry.device ? "Replace phone" : "Activate phone"}
                                </DropdownMenuItem>
                                {entry.device ? (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setSelected(entry);
                                        setDialog("rename");
                                      }}
                                    >
                                      Rename phone
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      variant="destructive"
                                      onClick={() => {
                                        setSelected(entry);
                                        setDialog("revoke");
                                      }}
                                    >
                                      Disconnect phone
                                    </DropdownMenuItem>
                                  </>
                                ) : null}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="divide-y divide-[var(--cs-border-soft)] lg:hidden">
              {pagedEntries.map((entry) => {
                const stat = phoneStatusDisplay(entry.status);
                return (
                  <div key={`${entry.staffId}:${entry.rowId}`} className="grid gap-2.5 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <StaffAvatar
                          name={entry.staffName}
                          className="size-9 bg-[#2D6A45] text-xs font-bold text-white"
                        />
                        <div>
                          <div className="text-sm font-bold text-[var(--cs-text)]">
                            {entry.staffName}
                          </div>
                          <div className="text-xs text-[var(--cs-text-muted)]">
                            {formatAttendanceRole(entry.staffType)}
                          </div>
                        </div>
                      </div>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold",
                          stat.pillClass
                        )}
                      >
                        <span className={cn("size-1.5 rounded-full", stat.dotClass)} />
                        {stat.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-[#FAF8F5] px-3 py-2 text-xs">
                      <span className="font-semibold text-[var(--cs-text)]">
                        {entry.device ? entry.device.label : "No phone connected"}
                      </span>
                      <span className="text-[var(--cs-text-muted)]">
                        {entry.device?.lastSeenAt
                          ? formatAttendanceDateTime(entry.device.lastSeenAt, data.timezone)
                          : "Never used"}
                      </span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelected(entry);
                        setDialog("manage");
                      }}
                      className="h-8 w-full rounded-lg text-xs font-semibold"
                    >
                      <Settings className="mr-1.5 size-3.5" />
                      Manage Phone
                    </Button>
                  </div>
                );
              })}
            </div>

            <AttendancePagination
              page={safePage}
              pageSize={pageSize}
              totalItems={filtered.length}
              itemLabel="staff phones"
              onPageChange={setPage}
              onPageSizeChange={(next) => {
                setPageSize(next);
                setPage(1);
              }}
              pageSizeOptions={[8, 10, 25, 50]}
            />
          </>
        )}
      </section>

      {/* Centered Manage Phone Modal (replaces oversized side sheet) */}
      <Dialog
        open={Boolean(selected) && dialog === "manage"}
        onOpenChange={(open) => {
          if (!open) {
            setDialog(null);
            setSelected(null);
          }
        }}
      >
        <DialogContent className="max-w-md rounded-2xl border-[var(--cs-border)] bg-white p-0 overflow-hidden">
          {selected ? (
            <>
              <DialogHeader className="border-b border-[var(--cs-border-soft)] bg-[#FAF8F5] px-6 py-4 text-left">
                <DialogTitle className="text-base font-bold text-[var(--cs-text)]">
                  {selected.staffName}
                </DialogTitle>
                <DialogDescription className="text-xs text-[var(--cs-text-muted)]">
                  {formatAttendanceRole(selected.staffType)} ·{" "}
                  {phoneStatusDisplay(selected.status).label}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 p-6">
                <div className="rounded-xl border border-[var(--cs-border-soft)] bg-[#FAF8F5] p-4 text-xs">
                  <div className="font-bold text-[var(--cs-text)]">
                    {selected.device?.label ?? "No phone connected"}
                  </div>
                  <div className="mt-1 text-[var(--cs-text-muted)]">
                    {selected.device
                      ? `${formatDevicePlatformSummary(selected)} · Registered at ${selected.device.registeredBranchName ?? selected.homeBranchName}`
                      : "Generate a one-tap activation link for this staff member's browser."}
                  </div>
                  {selected.device?.lastSeenAt ? (
                    <div className="mt-2 font-semibold text-[var(--cs-text-secondary)]">
                      Last scan: {formatAttendanceDateTime(selected.device.lastSeenAt, data.timezone)}
                    </div>
                  ) : null}
                </div>

                <Button
                  type="button"
                  onClick={() => setDialog(selected.device ? "replace" : "activate")}
                  className="h-10 rounded-xl bg-[#1F4E33] text-xs font-semibold text-white hover:bg-[#163B26]"
                >
                  {selected.device ? "Replace / Reconnect Phone" : "Activate Phone"}
                </Button>

                {selected.device ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDialog("rename")}
                      className="h-9 rounded-xl text-xs font-semibold"
                    >
                      Rename Phone
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => setDialog("revoke")}
                      className="h-9 rounded-xl text-xs font-semibold"
                    >
                      Disconnect
                    </Button>
                  </div>
                ) : null}
              </div>

              <DialogFooter className="border-t border-[var(--cs-border-soft)] bg-[#FAF8F5] px-6 py-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDialog(null);
                    setSelected(null);
                  }}
                  className="rounded-lg text-xs"
                >
                  Close
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <RecoveryLinkDialog
        key={`${dialog}-${selected?.rowId ?? "new"}`}
        open={dialog === "activate" || dialog === "replace"}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        registry={data.deviceRegistry}
        entry={selected}
        onGenerated={() => onRefresh()}
      />

      <RenameDeviceDialog
        key={`rename:${selected?.rowId ?? "none"}`}
        open={dialog === "rename"}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        entry={selected}
        onRenamed={() => onRefresh()}
      />

      <RevokeDeviceDialog
        key={`revoke:${selected?.rowId ?? "none"}`}
        open={dialog === "revoke"}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        entry={selected}
        onRevoked={() => {
          onRefresh();
          setSelected(null);
        }}
      />

      <Dialog
        open={dialog === "requests"}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border-[var(--cs-border)] bg-white sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Phone registration requests</DialogTitle>
            <DialogDescription>
              Verify staff-initiated phone connections and replacements.
            </DialogDescription>
          </DialogHeader>
          <DeviceRegistrationRequestsPanel registry={data.deviceRegistry} />
        </DialogContent>
      </Dialog>
    </>
  );
}
