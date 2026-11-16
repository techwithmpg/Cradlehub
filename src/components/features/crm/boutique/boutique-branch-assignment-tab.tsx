"use client";

import { Building2, Clock, Mail, MapPin, Phone } from "lucide-react";
import { CrmStatusBadge } from "@/components/features/crm/premium/crm-status-badge";
import {
  WorkspaceNotice,
  WorkspaceSection,
} from "@/components/features/crm/shared/crm-workspace-primitives";
import type { CrmBoutiqueBranchRecord } from "@/lib/boutique/crm-boutique-model";
import { PendingActionButton } from "./pending-authorization-control";

export function BoutiqueBranchAssignmentTab({
  branches,
  currentBranchName,
  totalSkus,
}: {
  branches: readonly CrmBoutiqueBranchRecord[];
  currentBranchName: string;
  totalSkus: number;
}) {
  return (
    <div className="space-y-4">
      <WorkspaceNotice tone="info" title="Global Canonical Catalogue Across Active Branches">
        <p className="m-0 text-xs leading-5">
          All {totalSkus} canonical Boutique SKUs apply uniformly across active Cradle Wellness
          Living branches for reception pickup coordination. Your active workspace branch is{" "}
          <strong>{currentBranchName}</strong>.
        </p>
      </WorkspaceNotice>

      <WorkspaceSection
        title="Branch Pickup & SKU Eligibility Directory"
        description="Live active sanctuaries loaded from CradleHub's branches directory."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PendingActionButton
              label="Assign Branch SKUs"
              reason="Per-branch SKU visibility overrides await database schema authorization."
            />
            <PendingActionButton
              label="Override Branch Price"
              reason="Branch-specific boutique pricing awaits owner approval & database tables."
            />
          </div>
        }
      >
        <div className="grid gap-4 p-4 md:grid-cols-2">
          {branches.map((branch) => (
            <div
              key={branch.id}
              className="flex flex-col justify-between rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-4 shadow-[var(--cs-shadow-xs)]"
            >
              <div>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EEF7F1] text-[#1F4E33]">
                      <Building2 className="size-4" aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--cs-text)]">
                        {branch.name}
                      </h3>
                      <p className="font-mono text-[10px] text-[var(--cs-text-muted)]">
                        id: {branch.id}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {branch.isCurrentScope ? (
                      <CrmStatusBadge variant="active" label="Current Branch Scope" dot size="sm" />
                    ) : (
                      <CrmStatusBadge variant="neutral" label="Active Sanctuary" size="sm" />
                    )}
                    <CrmStatusBadge
                      variant="warning"
                      label="Custom SKU Overrides Locked"
                      size="sm"
                    />
                  </div>
                </div>

                <dl className="mt-4 space-y-2 text-xs text-[var(--cs-text-secondary)]">
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 size-3.5 shrink-0 text-[var(--cs-sand-dark)]" aria-hidden="true" />
                    <span>{branch.address ?? "Address synced with active branch record"}</span>
                  </div>
                  {branch.openingHours ? (
                    <div className="flex items-center gap-2">
                      <Clock className="size-3.5 shrink-0 text-[var(--cs-sand-dark)]" aria-hidden="true" />
                      <span>{branch.openingHours}</span>
                    </div>
                  ) : null}
                  {branch.phone ? (
                    <div className="flex items-center gap-2">
                      <Phone className="size-3.5 shrink-0 text-[var(--cs-sand-dark)]" aria-hidden="true" />
                      <span>{branch.phone}</span>
                    </div>
                  ) : null}
                  {branch.email ? (
                    <div className="flex items-center gap-2">
                      <Mail className="size-3.5 shrink-0 text-[var(--cs-sand-dark)]" aria-hidden="true" />
                      <span>{branch.email}</span>
                    </div>
                  ) : null}
                </dl>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--cs-border-soft)] pt-3 text-xs">
                <span className="font-medium text-[#1F4E33]">{branch.pickupConciergeStatus}</span>
                <span className="text-[var(--cs-text-muted)]">
                  {totalSkus} canonical SKUs visible
                </span>
              </div>
            </div>
          ))}
        </div>
      </WorkspaceSection>
    </div>
  );
}
