"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, Settings2, Sparkles, UserCheck, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ServiceLite } from "@/app/(dashboard)/owner/branches/[branchId]/branch-services-panel";
import type { StaffForServicePanel, ServiceAssignmentRow } from "@/lib/queries/crm-services";
import { isValidProvider } from "@/components/features/crm/services/crm-therapist-assignment-tab";
import { StaffServiceEditorSheet } from "@/components/features/staff/staff-service-editor-sheet";
import { updateStaffServicesFromCrmAction } from "@/lib/actions/crm-staff-services";
import {
  getCrmStaffServiceId,
  getCrmStaffServiceName,
  toCrmStaffServiceRows,
} from "./service-row-adapter";

type Props = {
  branchId: string;
  activeServices: ServiceLite[];
  providerStaff: StaffForServicePanel[];
  providerAssignments: ServiceAssignmentRow[];
};

export function CrmStaffAssignmentsTab({
  activeServices,
  providerStaff,
  providerAssignments,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [editingStaff, setEditingStaff] = useState<StaffForServicePanel | null>(null);
  const [servicesDraft, setServicesDraft] = useState<string[]>([]);
  const [isSaving, startSaving] = useTransition();

  const serviceRows = useMemo(
    () => toCrmStaffServiceRows(activeServices),
    [activeServices]
  );

  const { staffRows, stats } = useMemo(() => {
    const assignMap = new Map<string, Set<string>>();
    for (const a of providerAssignments) {
      const set = assignMap.get(a.staff_id) ?? new Set<string>();
      set.add(a.service_id);
      assignMap.set(a.staff_id, set);
    }

    const serviceById = new Map<string, string>();
    for (const service of activeServices) {
      const serviceId = getCrmStaffServiceId(service);
      const serviceName = getCrmStaffServiceName(service);
      if (serviceId && serviceName) {
        serviceById.set(serviceId, serviceName);
      }
    }

    const eligibleStaff = providerStaff.filter(isValidProvider);

    const rows = eligibleStaff.map((staff) => {
      const assignedServiceIds = assignMap.get(staff.id) ?? new Set<string>();
      const assignedServices = Array.from(assignedServiceIds)
        .map((id) => serviceById.get(id))
        .filter((name): name is string => Boolean(name));

      return {
        staff,
        assignedServices,
        assignmentCount: assignedServices.length,
        currentServiceIds: Array.from(assignedServiceIds),
      };
    });

    const sorted = rows.sort((a, b) => {
      if (a.assignmentCount === 0 && b.assignmentCount > 0) return -1;
      if (a.assignmentCount > 0 && b.assignmentCount === 0) return 1;
      return a.staff.full_name.localeCompare(b.staff.full_name);
    });

    const unassignedCount = rows.filter((r) => r.assignmentCount === 0).length;
    const totalAssignments = providerAssignments.length;
    const avgAssignments =
      rows.length > 0 ? Math.round((totalAssignments / rows.length) * 10) / 10 : 0;

    return {
      staffRows: sorted,
      stats: { eligibleCount: eligibleStaff.length, unassignedCount, totalAssignments, avgAssignments },
    };
  }, [activeServices, providerStaff, providerAssignments]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return staffRows;
    return staffRows.filter(
      (r) =>
        r.staff.full_name.toLowerCase().includes(q) ||
        r.assignedServices.some((s) => s.toLowerCase().includes(q))
    );
  }, [staffRows, search]);

  const handleOpenEditor = useCallback(
    (staff: StaffForServicePanel, currentIds: string[]) => {
      setServicesDraft(currentIds);
      setEditingStaff(staff);
    },
    []
  );

  const handleToggle = useCallback((id: string) => {
    setServicesDraft((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }, []);

  const handleSave = useCallback(
    (ids: string[]) => {
      if (!editingStaff) return;
      startSaving(async () => {
        const result = await updateStaffServicesFromCrmAction({
          staffId: editingStaff.id,
          serviceIds: ids,
        });
        if (result.ok) {
          toast.success("Service capabilities updated.");
          router.refresh();
          setTimeout(() => setEditingStaff(null), 1200);
        } else {
          toast.error(result.message ?? "Could not update service capabilities.");
        }
      });
    },
    [editingStaff, router]
  );

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Eligible Providers" value={stats.eligibleCount} icon={<Users className="size-4" />} />
        <StatCard
          label="Unassigned"
          value={stats.unassignedCount}
          icon={<UserCheck className="size-4" />}
          accent={stats.unassignedCount > 0 ? "var(--cs-error)" : undefined}
        />
        <StatCard label="Total Assignments" value={stats.totalAssignments} icon={<Sparkles className="size-4" />} />
        <StatCard label="Avg per Staff" value={stats.avgAssignments} icon={<Sparkles className="size-4" />} />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--cs-text-muted)]" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search staff or services..."
          className="h-10 bg-[var(--cs-surface-warm)] pl-10 text-sm"
        />
      </div>

      {/* Table */}
      {filteredRows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--cs-border-strong)] bg-[var(--cs-surface-warm)] p-8 text-center text-sm text-[var(--cs-text-muted)]">
          {search.trim()
            ? "No staff match your search."
            : "No eligible service providers found. Make sure staff have the correct staff type (therapist, nail_tech, aesthetician)."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] shadow-[var(--cs-shadow-xs)]">
          <table className="w-full table-fixed border-collapse text-left">
            <thead>
              <tr className="border-b border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] text-xs font-semibold text-[var(--cs-text-muted)]">
                <th className="w-[30%] px-4 py-3">Staff</th>
                <th className="w-[15%] px-4 py-3">Type</th>
                <th className="w-[40%] px-4 py-3">Assigned Services</th>
                <th className="w-[15%] px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr
                  key={row.staff.id}
                  className="border-b border-[var(--cs-border-soft)] last:border-b-0"
                >
                  <td className="px-4 py-3 align-middle">
                    <span className="block text-sm font-semibold text-[var(--cs-text)]">
                      {row.staff.full_name}
                    </span>
                    {row.assignmentCount === 0 && (
                      <span className="mt-0.5 block text-xs text-[var(--cs-error-text)]">Needs assignment</span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <span className="inline-flex items-center rounded-full border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] px-2.5 py-1 text-xs font-medium text-[var(--cs-text-secondary)]">
                      {row.staff.staff_type ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    {row.assignedServices.length === 0 ? (
                      <span className="text-xs text-[var(--cs-error-text)]">No services assigned</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {row.assignedServices.slice(0, 3).map((name) => (
                          <span
                            key={name}
                            className="inline-flex items-center rounded-md border border-[var(--cs-border-soft)] bg-[var(--cs-sand-tint)] px-2 py-0.5 text-xs text-[var(--cs-sand-dark)]"
                          >
                            {name}
                          </span>
                        ))}
                        {row.assignedServices.length > 3 && (
                          <span className="inline-flex items-center rounded-md border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] px-2 py-0.5 text-xs text-[var(--cs-text-muted)]">
                            +{row.assignedServices.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right align-middle">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 border-[var(--cs-border)] text-xs text-[var(--cs-text-secondary)] hover:bg-[var(--cs-sand-tint)]"
                      onClick={() => handleOpenEditor(row.staff, row.currentServiceIds)}
                    >
                      <Settings2 className="size-3.5" />
                      Manage
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Service editor sheet */}
      <StaffServiceEditorSheet
        open={editingStaff !== null}
        services={serviceRows}
        selectedIds={servicesDraft}
        onToggle={handleToggle}
        onClose={() => setEditingStaff(null)}
        onSave={handleSave}
        saving={isSaving}
        staffName={editingStaff?.full_name}
      />

    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4 shadow-[var(--cs-shadow-xs)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="m-0 text-xs font-medium text-[var(--cs-text-muted)]">{label}</p>
          <p
            className="mt-2 text-3xl font-semibold leading-none"
            style={{ color: accent ?? "var(--cs-text)" }}
          >
            {value}
          </p>
        </div>
        <div className="flex size-8 items-center justify-center rounded-lg bg-[var(--cs-sand-mist)] text-[var(--cs-sand-dark)]">
          {icon}
        </div>
      </div>
    </div>
  );
}
