"use client";

import { useId, useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, ShieldCheck, UserCheck, Wrench } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { assignProviderToServiceAction } from "@/app/(dashboard)/crm/services/actions";
import { SERVICE_STAFF_TYPES } from "@/constants/staff-roles";
import type { OperationalStaffMember } from "@/lib/operations-center/issue-model";

type ServiceProviderModalProps = {
  open: boolean;
  branchId: string;
  branchName: string;
  serviceId: string | null;
  serviceName: string | null;
  branchStaff: OperationalStaffMember[];
  onClose: () => void;
  onAssigned: () => void;
};

export function ServiceProviderModal({
  open,
  branchId,
  branchName,
  serviceId,
  serviceName,
  branchStaff,
  onClose,
  onAssigned,
}: ServiceProviderModalProps) {
  const selectId = useId();
  const [isPending, startTransition] = useTransition();
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [assignedSuccess, setAssignedSuccess] = useState<boolean>(false);

  if (!open || !serviceId) return null;

  // Filter staff to active, unarchived service-facing roles at this branch
  const hardExcludedRoles = new Set(["digital_marketer", "driver", "utility"]);
  const eligibleProviders = branchStaff.filter(
    (staff) =>
      staff.is_active &&
      !staff.archived_at &&
      !staff.merged_into_staff_id &&
      !hardExcludedRoles.has(staff.system_role) &&
      (SERVICE_STAFF_TYPES as readonly string[]).includes(staff.staff_type)
  );

  const handleAssign = () => {
    if (!selectedStaffId) {
      setErrorMessage("Please select an eligible service provider.");
      return;
    }

    setErrorMessage(null);
    startTransition(async () => {
      try {
        const result = await assignProviderToServiceAction({
          branchId,
          serviceId,
          staffId: selectedStaffId,
        });

        if (!result.ok) {
          setErrorMessage(result.message || "Failed to assign provider.");
          return;
        }

        setAssignedSuccess(true);
        onAssigned();
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Unexpected error assigning provider.");
      }
    });
  };

  const handleClose = () => {
    setSelectedStaffId("");
    setErrorMessage(null);
    setAssignedSuccess(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-[min(100%-2rem,560px)] overflow-y-auto p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-[var(--cs-border-soft)] p-5 pr-12">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--cs-text-muted)]">
            <Wrench size={14} aria-hidden />
            Service Configuration · {branchName}
          </div>
          <DialogTitle className="mt-1 text-lg font-bold">
            Assign Provider to Service
          </DialogTitle>
          <DialogDescription className="text-sm text-[var(--cs-text-secondary)]">
            {serviceName ?? "Selected service"} has no eligible provider assigned.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 p-5 text-sm">
          {assignedSuccess ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 size={18} className="text-emerald-700" aria-hidden />
                Provider Assigned & Verified
              </div>
              <p className="mt-2 text-xs leading-5">
                The provider was successfully assigned in <code>staff_services</code>.
                Authoritative service readiness data has been refreshed. The service is now ready for online booking and front-desk dispatch.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
                <div className="flex items-center gap-2 font-semibold text-xs uppercase tracking-wide text-amber-900">
                  <AlertCircle size={16} aria-hidden />
                  Root Cause Confirmed
                </div>
                <p className="mt-1 text-sm font-medium">
                  Active service cannot be booked because zero active branch providers are assigned.
                </p>
                <p className="mt-1 text-xs text-amber-900/80">
                  Online booking and front-desk appointment wizards require at least one eligible staff member in <code>staff_services</code> before appointments can be scheduled.
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor={selectId} className="block text-xs font-bold uppercase text-[var(--cs-text-muted)]">
                  Select Eligible Provider for {branchName}
                </label>
                {eligibleProviders.length === 0 ? (
                  <div className="rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] p-4 text-xs text-[var(--cs-text-secondary)]">
                    <p className="font-semibold text-stone-900">No eligible providers found in this branch.</p>
                    <p className="mt-1">
                      There are currently no active therapists, nail technicians, or aestheticians assigned to {branchName}. Onboard a new provider or transfer an existing staff member in Staff Management before assigning services.
                    </p>
                  </div>
                ) : (
                  <select
                    id={selectId}
                    value={selectedStaffId}
                    onChange={(e) => {
                      setSelectedStaffId(e.target.value);
                      setErrorMessage(null);
                    }}
                    disabled={isPending}
                    className="min-h-10 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-sm focus:border-[var(--cs-sand)] focus:outline-none"
                  >
                    <option value="">-- Choose an eligible staff member --</option>
                    {eligibleProviders.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.full_name} ({provider.staff_type.replace(/_/g, " ")})
                        {provider.nickname ? ` - "${provider.nickname}"` : ""}
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-[11px] text-[var(--cs-text-muted)]">
                  Only active, verified therapists, nail technicians, and aestheticians assigned to this branch are listed.
                </p>
              </div>

              {errorMessage ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800" role="alert">
                  <span className="font-semibold">Assignment error: </span>{errorMessage}
                </div>
              ) : null}

              <div className="flex items-start gap-2 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] p-3 text-xs text-[var(--cs-text-muted)]">
                <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden />
                <span>
                  <strong>Authoritative Server Action: </strong>
                  This correction updates the canonical <code>staff_services</code> junction table with branch validation and invalidates booking availability caches.
                </span>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="mx-0 mb-0 gap-2 border-t border-[var(--cs-border-soft)] p-4">
          <Button type="button" variant="outline" onClick={handleClose}>
            {assignedSuccess ? "Done" : "Cancel"}
          </Button>
          {!assignedSuccess && (
            <Button
              type="button"
              disabled={isPending || !selectedStaffId || eligibleProviders.length === 0}
              onClick={handleAssign}
              className="bg-[var(--cs-sidebar-active)] text-white hover:opacity-95"
            >
              <UserCheck size={15} className="mr-1.5" aria-hidden />
              {isPending ? "Assigning…" : "Assign Provider"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
