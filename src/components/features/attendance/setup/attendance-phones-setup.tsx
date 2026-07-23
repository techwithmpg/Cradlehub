"use client";

import { useMemo, useState } from "react";
import { MoreHorizontal, Search, ShieldCheck, Smartphone } from "lucide-react";
import { DeviceRegistrationRequestsPanel } from "@/components/features/attendance/devices/device-registration-requests-panel";
import { RecoveryLinkDialog } from "@/components/features/attendance/devices/recovery-link-dialog";
import { RenameDeviceDialog } from "@/components/features/attendance/devices/rename-device-dialog";
import { RevokeDeviceDialog } from "@/components/features/attendance/devices/revoke-device-dialog";
import {
  StaffAvatar,
  formatAttendanceDateTime,
} from "@/components/features/attendance/attendance-ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type {
  AttendanceDeviceRegistryEntry,
  AttendanceWorkspaceData,
} from "@/lib/attendance/types";

function statusLabel(entry: AttendanceDeviceRegistryEntry): string {
  if (entry.status === "active") return "Connected";
  if (entry.status === "recovery_pending") return "Replacement pending";
  if (entry.status === "revoked") return "Disconnected";
  if (entry.status === "never_used") return "Never used";
  return "Not connected";
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
  const [selected, setSelected] = useState<AttendanceDeviceRegistryEntry | null>(
    () => data.deviceRegistry.entries.find((entry) => entry.staffId === initialStaffId) ?? null
  );
  const [dialog, setDialog] = useState<
    "activate" | "replace" | "rename" | "revoke" | "requests" | null
  >(null);
  const entries = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.deviceRegistry.entries.filter(
      (entry) =>
        !query ||
        `${entry.staffName} ${entry.device?.label ?? ""} ${entry.status}`
          .toLowerCase()
          .includes(query)
    );
  }, [data.deviceRegistry.entries, search]);
  const pendingRequests = data.deviceRegistry.registrationRequests.filter(
    (request) => request.status === "pending"
  ).length;
  return (
    <>
      <section className="overflow-hidden rounded-xl border border-[var(--cs-border)] bg-white">
        <div className="flex flex-col gap-3 border-b border-[var(--cs-border-soft)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold">Staff phones</h2>
            <p className="mt-0.5 text-xs text-[var(--cs-text-muted)]">
              Connect, replace, rename, or disconnect trusted phones.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setDialog("requests")}>
              <ShieldCheck />
              Requests {pendingRequests ? `(${pendingRequests})` : ""}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setSelected(null);
                setDialog("activate");
              }}
            >
              <Smartphone />
              Activate phone
            </Button>
          </div>
        </div>
        <div className="border-b border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-3">
          <label className="relative block max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--cs-text-muted)]" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
              placeholder="Search staff or phone"
            />
            <span className="sr-only">Search staff phones</span>
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-[var(--cs-text-muted)]">
              <tr>
                <th className="px-4 py-3">Staff</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Last used</th>
                <th className="px-4 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={`${entry.staffId}:${entry.rowId}`}
                  onClick={() => setSelected(entry)}
                  className="cursor-pointer border-t border-[var(--cs-border-soft)] hover:bg-[var(--cs-surface-warm)]"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <StaffAvatar name={entry.staffName} />
                      <span className="font-semibold">{entry.staffName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-bold ${entry.status === "active" ? "bg-emerald-50 text-emerald-800" : entry.status === "recovery_pending" ? "bg-amber-50 text-amber-800" : "bg-stone-100 text-stone-700"}`}
                    >
                      {statusLabel(entry)}
                    </span>
                  </td>
                  <td className="px-4 py-3">{entry.device?.label ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-[var(--cs-text-muted)]">
                    {entry.device?.lastSeenAt
                      ? formatAttendanceDateTime(entry.device.lastSeenAt, data.timezone)
                      : "Never"}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(event) => event.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Actions for ${entry.staffName}`}
                          />
                        }
                      >
                        <MoreHorizontal />
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <Sheet
        open={Boolean(selected) && !dialog}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{selected?.staffName}</SheetTitle>
            <SheetDescription>
              {statusLabel(selected ?? data.deviceRegistry.entries[0]!)}
            </SheetDescription>
          </SheetHeader>
          {selected ? (
            <div className="grid gap-3 p-4">
              <div className="rounded-xl border bg-[var(--cs-surface-warm)] p-4 text-sm">
                <div className="font-semibold">
                  {selected.device?.label ?? "No phone connected"}
                </div>
                <div className="mt-1 text-xs text-[var(--cs-text-muted)]">
                  {selected.device
                    ? `${selected.device.platformName ?? "Unknown platform"} · ${selected.device.browserName ?? "Unknown browser"}`
                    : "Create a secure link for this staff member."}
                </div>
              </div>
              <Button onClick={() => setDialog(selected.device ? "replace" : "activate")}>
                {selected.device ? "Replace phone" : "Activate phone"}
              </Button>
              {selected.device ? (
                <>
                  <Button variant="outline" onClick={() => setDialog("rename")}>
                    Rename phone
                  </Button>
                  <Button variant="destructive" onClick={() => setDialog("revoke")}>
                    Disconnect phone
                  </Button>
                </>
              ) : null}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
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
