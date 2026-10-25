"use client";

import { useId, useState, useTransition } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  Wrench,
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
import {
  assignProviderToServiceAction,
  verifyServiceProviderReadinessAction,
} from "@/app/(dashboard)/crm/services/actions";
import { SERVICE_STAFF_TYPES } from "@/constants/staff-roles";
import type { OperationalStaffMember } from "@/lib/operations-center/issue-model";

type VerificationStatus =
  | "idle"
  | "submitting"
  | "verifying"
  | "verified"
  | "unconfirmed"
  | "error";

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
  const [status, setStatus] = useState<VerificationStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [providerCount, setProviderCount] = useState<number>(0);

  if (!open || !serviceId) return null;

  // Filter staff to active service-facing roles at this branch
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
      setStatus("error");
      setStatusMessage("Please select an eligible service provider.");
      return;
    }

    setStatus("submitting");
    setStatusMessage("Saving provider assignment in staff_services…");

    startTransition(async () => {
      try {
        const result = await assignProviderToServiceAction({
          branchId,
          serviceId,
          staffId: selectedStaffId,
        });

        if (!result.ok) {
          setStatus("error");
          setStatusMessage(result.message || "Failed to assign provider.");
          return;
        }

        // Post-mutation verification: Re-query authoritative readiness
        setStatus("verifying");
        setStatusMessage("Mutation submitted. Verifying authoritative service readiness…");

        const verifyResult = await verifyServiceProviderReadinessAction({
          branchId,
          serviceId,
        });

        if (!verifyResult.ok) {
          setStatus("error");
          setStatusMessage(
            `Mutation succeeded, but authoritative verification failed: ${verifyResult.message}`
          );
          return;
        }

        if (verifyResult.hasEligibleProvider) {
          setStatus("verified");
          setProviderCount(verifyResult.providerCount);
          setStatusMessage(verifyResult.message);
          onAssigned();
        } else {
          setStatus("unconfirmed");
          setProviderCount(verifyResult.providerCount);
          setStatusMessage(
            "The provider assignment was saved, but the authoritative re-query indicates the service still has 0 active providers. Cache propagation may be in progress or the staff member is not currently eligible."
          );
        }
      } catch (err) {
        setStatus("error");
        setStatusMessage(
          err instanceof Error ? err.message : "Unexpected error during provider assignment."
        );
      }
    });
  };

  const handleReverify = () => {
    setStatus("verifying");
    setStatusMessage("Re-checking authoritative service readiness…");

    startTransition(async () => {
      try {
        const verifyResult = await verifyServiceProviderReadinessAction({
          branchId,
          serviceId,
        });

        if (!verifyResult.ok) {
          setStatus("error");
          setStatusMessage(verifyResult.message);
          return;
        }

        if (verifyResult.hasEligibleProvider) {
          setStatus("verified");
          setProviderCount(verifyResult.providerCount);
          setStatusMessage(verifyResult.message);
          onAssigned();
        } else {
          setStatus("unconfirmed");
          setProviderCount(verifyResult.providerCount);
          setStatusMessage(
            "Authoritative re-check confirmed zero active providers. Review the staff member's active status and branch assignment."
          );
        }
      } catch (err) {
        setStatus("error");
        setStatusMessage(
          err instanceof Error ? err.message : "Authoritative verification query failed."
        );
      }
    });
  };

  const handleClose = () => {
    setSelectedStaffId("");
    setStatus("idle");
    setStatusMessage(null);
    setProviderCount(0);
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
          {status === "verifying" ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-950">
              <div className="flex items-center gap-2 font-semibold">
                <Loader2 size={18} className="animate-spin text-blue-700" aria-hidden />
                Verifying Authoritative Service Readiness…
              </div>
              <p className="mt-2 text-xs leading-5 text-blue-900/80">
                Mutation completed on server. Re-querying <code>getBranchProviderReadiness</code> to confirm active provider coverage.
              </p>
            </div>
          ) : status === "verified" ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 size={18} className="text-emerald-700" aria-hidden />
                Provider Coverage Confirmed &amp; Authoritatively Verified
              </div>
              <p className="mt-2 text-xs leading-5">
                Authoritative readiness check confirmed: <strong>{providerCount} qualified provider(s)</strong> assigned to {serviceName} at {branchName}.
                Provider readiness caches have been invalidated. (Full booking readiness also requires active branch schedules, resources, and catalog configuration.)
              </p>
            </div>
          ) : status === "unconfirmed" ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
              <div className="flex items-center gap-2 font-semibold text-amber-900">
                <AlertTriangle size={18} className="text-amber-700" aria-hidden />
                Mutation Saved — Readiness Unconfirmed
              </div>
              <p className="mt-2 text-xs leading-5 text-amber-900">
                {statusMessage}
              </p>
              <div className="mt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={handleReverify}
                  className="border-amber-300 text-xs"
                >
                  <RefreshCw size={13} className="mr-1.5" aria-hidden />
                  Re-check Authoritative Readiness
                </Button>
              </div>
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
                  Select Service Provider for {branchName}
                </label>
                {eligibleProviders.length === 0 ? (
                  <div className="rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] p-4 text-xs text-[var(--cs-text-secondary)]">
                    <p className="font-semibold text-stone-900">No eligible service providers found in this branch.</p>
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
                      setStatus("idle");
                      setStatusMessage(null);
                    }}
                    disabled={isPending || status === "submitting"}
                    className="min-h-10 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-sm focus:border-[var(--cs-sand)] focus:outline-none"
                  >
                    <option value="">-- Choose a staff member --</option>
                    {eligibleProviders.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.full_name} ({provider.staff_type.replace(/_/g, " ")})
                        {provider.nickname ? ` - "${provider.nickname}"` : ""}
                        {provider.identity_verified_at ? " · [Verified ID]" : ""}
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-[11px] text-[var(--cs-text-muted)]">
                  Only active service providers (therapists, nail technicians, aestheticians) assigned to this branch are listed.
                </p>
              </div>

              {status === "error" && statusMessage ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800" role="alert">
                  <span className="font-semibold">Error: </span>{statusMessage}
                </div>
              ) : null}

              <div className="flex items-start gap-2 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] p-3 text-xs text-[var(--cs-text-muted)]">
                <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden />
                <span>
                  <strong>Authoritative Server Action &amp; Verification: </strong>
                  Updates canonical <code>staff_services</code> and re-queries branch provider readiness before presenting confirmation.
                </span>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="mx-0 mb-0 gap-2 border-t border-[var(--cs-border-soft)] p-4">
          <Button type="button" variant="outline" onClick={handleClose}>
            {status === "verified" ? "Done" : "Cancel"}
          </Button>
          {status !== "verified" && (
            <Button
              type="button"
              disabled={isPending || status === "submitting" || status === "verifying" || !selectedStaffId || eligibleProviders.length === 0}
              onClick={handleAssign}
              className="bg-[var(--cs-sidebar-active)] text-white hover:opacity-95"
            >
              {isPending || status === "submitting" ? (
                <>
                  <Loader2 size={14} className="mr-1.5 animate-spin" aria-hidden />
                  Submitting…
                </>
              ) : status === "verifying" ? (
                <>
                  <Loader2 size={14} className="mr-1.5 animate-spin" aria-hidden />
                  Verifying…
                </>
              ) : (
                <>
                  <UserCheck size={15} className="mr-1.5" aria-hidden />
                  Assign Provider
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
