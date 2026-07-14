"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { revokeDeviceRecoveryLinkAction } from "@/app/(dashboard)/crm/attendance/actions";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/features/attendance/attendance-ui";
import { DeviceRegistryTable } from "@/components/features/attendance/devices/device-registry-table";
import { DeviceRegistryToolbar } from "@/components/features/attendance/devices/device-registry-toolbar";
import { PendingRecoveryLinks } from "@/components/features/attendance/devices/pending-recovery-links";
import { RecoveryLinkDialog } from "@/components/features/attendance/devices/recovery-link-dialog";
import { RenameDeviceDialog } from "@/components/features/attendance/devices/rename-device-dialog";
import { RevokeDeviceDialog } from "@/components/features/attendance/devices/revoke-device-dialog";
import { SelectedDevicePanel } from "@/components/features/attendance/devices/selected-device-panel";
import { DeviceRegistrationRequestsPanel } from "@/components/features/attendance/devices/device-registration-requests-panel";
import type {
  AttendanceDeviceRegistryData,
  AttendanceDeviceRegistryEntry,
  AttendanceDeviceStatus,
  AttendanceWorkspaceData,
  DeviceRevocationReason,
  PendingDeviceRecoveryLink,
} from "@/lib/attendance/types";

function entryMatchesQuery(entry: AttendanceDeviceRegistryEntry, query: string): boolean {
  if (!query) return true;
  const device = entry.device;
  const haystack = [
    entry.staffName,
    entry.staffNickname,
    device?.label,
    device?.browserName,
    device?.platformName,
  ].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(query);
}

function updateEntryDevice(
  entry: AttendanceDeviceRegistryEntry,
  deviceId: string,
  update: Partial<NonNullable<AttendanceDeviceRegistryEntry["device"]>>
): AttendanceDeviceRegistryEntry {
  if (entry.device?.id !== deviceId) return entry;
  return { ...entry, device: { ...entry.device, ...update } };
}

export function RegisteredDevicesTab({
  data,
  nowMs,
  routeBasePath,
  routeBranchId,
}: {
  data: AttendanceWorkspaceData;
  nowMs: number;
  routeBasePath?: string;
  routeBranchId?: string | null;
}) {
  const [registry, setRegistry] = useState<AttendanceDeviceRegistryData>(data.deviceRegistry);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | AttendanceDeviceStatus>("all");
  const [staffType, setStaffType] = useState("all");
  const [selectedRowId, setSelectedRowId] = useState(registry.entries[0]?.rowId ?? null);
  const [recoveryEntry, setRecoveryEntry] = useState<AttendanceDeviceRegistryEntry | null>(null);
  const [renameEntry, setRenameEntry] = useState<AttendanceDeviceRegistryEntry | null>(null);
  const [revokeEntry, setRevokeEntry] = useState<AttendanceDeviceRegistryEntry | null>(null);
  const [isPending, startTransition] = useTransition();

  const normalizedQuery = query.trim().toLowerCase();
  const staffTypes = useMemo(
    () => Array.from(new Set(registry.entries.map((entry) => entry.staffType))).sort(),
    [registry.entries]
  );
  const filteredEntries = useMemo(
    () => registry.entries.filter((entry) => {
      const matchesStatus = status === "all" || entry.status === status;
      const matchesType = staffType === "all" || entry.staffType === staffType;
      return matchesStatus && matchesType && entryMatchesQuery(entry, normalizedQuery);
    }),
    [normalizedQuery, registry.entries, staffType, status]
  );
  const selectedEntry =
    filteredEntries.find((entry) => entry.rowId === selectedRowId) ??
    registry.entries.find((entry) => entry.rowId === selectedRowId) ??
    filteredEntries[0] ??
    null;

  function clearFilters() {
    setQuery("");
    setStatus("all");
    setStaffType("all");
  }

  function changeBranch(branchId: string) {
    if (branchId === registry.branchId) return;
    window.location.href = `${routeBasePath ?? "/owner/attendance"}?tab=devices&branchId=${branchId}`;
  }

  function upsertPendingLink(link: PendingDeviceRecoveryLink) {
    setRegistry((current) => ({
      ...current,
      pendingRecoveryLinks: [
        link,
        ...current.pendingRecoveryLinks.filter((item) => item.staffId !== link.staffId),
      ],
      entries: current.entries.map((entry) =>
        entry.staffId === link.staffId
          ? {
              ...entry,
              status: "recovery_pending",
              pendingRecovery: {
                id: link.id,
                reason: link.reason,
                createdAt: link.createdAt,
                expiresAt: link.expiresAt,
                revokePreviousDeviceId: link.revokePreviousDeviceId,
              },
            }
          : entry
      ),
    }));
  }

  function handleGenerated(link: PendingDeviceRecoveryLink) {
    upsertPendingLink(link);
  }

  function handleRenamed(deviceId: string, label: string) {
    setRegistry((current) => ({
      ...current,
      activeDevices: current.activeDevices.map((device) => device.id === deviceId ? { ...device, label } : device),
      entries: current.entries.map((entry) => updateEntryDevice(entry, deviceId, { label })),
    }));
  }

  function handleRevoked(deviceId: string, reason: DeviceRevocationReason) {
    setRegistry((current) => ({
      ...current,
      activeDevices: current.activeDevices.filter((device) => device.id !== deviceId),
      entries: current.entries.map((entry) =>
        updateEntryDevice(entry, deviceId, {
          isActive: false,
          revokedAt: new Date().toISOString(),
          revocationReason: reason,
        })
      ).map((entry) => entry.device?.id === deviceId ? { ...entry, status: "revoked" } : entry),
    }));
  }

  function revokePendingLink(link: PendingDeviceRecoveryLink) {
    startTransition(async () => {
      const result = await revokeDeviceRecoveryLinkAction({
        branchId: link.branchId,
        tokenId: link.id,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setRegistry((current) => ({
        ...current,
        pendingRecoveryLinks: current.pendingRecoveryLinks.filter((item) => item.id !== link.id),
        entries: current.entries.map((entry) =>
          entry.pendingRecovery?.id === link.id
            ? { ...entry, pendingRecovery: null, status: entry.device ? (entry.device.isActive ? "active" : "revoked") : "no_device" }
            : entry
        ),
      }));
      toast.success("Recovery link revoked.");
    });
  }

  function replacePendingLink(link: PendingDeviceRecoveryLink) {
    const entry = registry.entries.find((item) => item.staffId === link.staffId) ?? null;
    setRecoveryEntry(entry);
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Device Registry and Recovery Center</h2>
          <p className="text-sm text-muted-foreground">Manage trusted staff devices and one-time recovery links.</p>
        </div>
        <Button type="button" onClick={() => setRecoveryEntry(selectedEntry)}>
          <Plus data-icon="inline-start" />
          Generate recovery link
        </Button>
      </div>

      <DeviceRegistrationRequestsPanel registry={registry} />

      <DeviceRegistryToolbar
        query={query}
        onQueryChange={setQuery}
        branchId={registry.branchId}
        onBranchChange={changeBranch}
        branches={registry.branches}
        canSwitchBranch={registry.canSwitchBranch}
        status={status}
        onStatusChange={setStatus}
        staffType={staffType}
        onStaffTypeChange={setStaffType}
        staffTypes={staffTypes}
        onClear={clearFilters}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="grid gap-4">
          {filteredEntries.length === 0 ? (
            <EmptyState title="No devices match these filters." detail="Clear filters to return to the full registry." />
          ) : (
            <DeviceRegistryTable
              entries={filteredEntries}
              selectedRowId={selectedEntry?.rowId ?? null}
              onSelect={(entry) => setSelectedRowId(entry.rowId)}
              onGenerateRecovery={setRecoveryEntry}
            />
          )}
          <PendingRecoveryLinks
            links={registry.pendingRecoveryLinks}
            nowMs={nowMs}
            onRevoke={revokePendingLink}
            onReplace={replacePendingLink}
          />
        </div>
        <SelectedDevicePanel
          entry={selectedEntry}
          nowMs={nowMs}
          timezone={data.timezone}
          routeBasePath={routeBasePath}
          routeBranchId={routeBranchId}
          onGenerateRecovery={setRecoveryEntry}
          onRename={setRenameEntry}
          onRevoke={setRevokeEntry}
        />
      </div>

      {recoveryEntry ? (
        <RecoveryLinkDialog
          key={`recovery-${recoveryEntry.rowId}`}
          open={Boolean(recoveryEntry)}
          onOpenChange={(open) => {
            if (!open) setRecoveryEntry(null);
          }}
          registry={registry}
          entry={recoveryEntry}
          onGenerated={handleGenerated}
        />
      ) : null}
      {renameEntry ? (
        <RenameDeviceDialog
          key={`rename-${renameEntry.rowId}`}
          open={Boolean(renameEntry)}
          onOpenChange={(open) => {
            if (!open) setRenameEntry(null);
          }}
          entry={renameEntry}
          onRenamed={handleRenamed}
        />
      ) : null}
      {revokeEntry ? (
        <RevokeDeviceDialog
          key={`revoke-${revokeEntry.rowId}`}
          open={Boolean(revokeEntry)}
          onOpenChange={(open) => {
            if (!open) setRevokeEntry(null);
          }}
          entry={revokeEntry}
          onRevoked={handleRevoked}
        />
      ) : null}
      {isPending ? <span className="sr-only" aria-live="polite">Updating recovery links</span> : null}
    </div>
  );
}
