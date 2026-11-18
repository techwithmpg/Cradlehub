"use client";

import Link from "next/link";
import { ExternalLink, LockKeyhole, ShieldCheck } from "lucide-react";
import { CrmStatusBadge } from "@/components/features/crm/premium/crm-status-badge";
import {
  WorkspaceNotice,
  WorkspaceSection,
} from "@/components/features/crm/shared/crm-workspace-primitives";
import type { CrmBoutiqueWorkspaceData } from "@/lib/boutique/crm-boutique-model";
import { CapabilityStatusTag } from "./pending-authorization-control";

export function BoutiqueSettingsTab({
  data,
}: {
  data: CrmBoutiqueWorkspaceData;
}) {
  const functionalItems = data.capabilityMatrix.filter((entry) => entry.group === "functional");
  const marketingItems = data.capabilityMatrix.filter(
    (entry) => entry.group === "marketing_governed"
  );
  const pendingItems = data.capabilityMatrix.filter(
    (entry) => entry.group === "pending_authorization"
  );

  return (
    <div className="space-y-5">

      <WorkspaceSection
        title="Functional Now vs. Pending Operational Authorization"
        description="Transparent feature inventory distinguishing live CRM inspection tools from operations awaiting formal authorization."
      >
        <div className="grid gap-4 p-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-[#CFE5D6] bg-[#EEF7F1]/55 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#1F4E33]">
              <ShieldCheck className="size-4" aria-hidden="true" />
              <span>Functional Capabilities (Active in CRM)</span>
            </div>
            <div className="space-y-2.5">
              {[...functionalItems, ...marketingItems].map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[var(--cs-text)]">
                      {entry.title}
                    </span>
                    <CapabilityStatusTag group={entry.group} label={entry.statusLabel} />
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--cs-text-secondary)]">
                    {entry.summary}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface-warm)]/65 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--cs-text)]">
              <LockKeyhole className="size-4 text-amber-700" aria-hidden="true" />
              <span>Pending Operational Authorization (Hard-Disabled)</span>
            </div>
            <div className="space-y-2.5">
              {pendingItems.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[var(--cs-text)]">
                      {entry.title}
                    </span>
                    <CapabilityStatusTag group={entry.group} label={entry.statusLabel} />
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--cs-text-secondary)]">
                    {entry.summary}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </WorkspaceSection>

      <WorkspaceSection
        title="Storefront Integration & Role Governance"
        description="Read-only snapshot of public storefront linkage, Marketing Studio governance, and your session permissions."
      >
        <div className="grid gap-4 p-4 md:grid-cols-2">
          <div className="rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--cs-text-muted)]">
              Catalog & Marketing Architecture Parity
            </h3>
            <dl className="mt-3 space-y-2 text-xs text-[var(--cs-text-secondary)]">
              <div className="flex items-center justify-between gap-2">
                <dt>Canonical SKU File</dt>
                <dd className="font-mono text-[11px] text-[var(--cs-text)]">
                  {data.governance.catalogSourcePath}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt>Guest Storefront Route</dt>
                <dd>
                  <Link
                    href={data.governance.publicRoute}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-[#1F4E33] hover:underline"
                  >
                    <span>{data.governance.publicRoute}</span>
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </Link>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt>Public Site Sections (Enabled / Total)</dt>
                <dd className="font-semibold text-[var(--cs-text)]">
                  {data.governance.enabledSectionCount} / {data.governance.publicSectionCount}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt>Published Brand Settings</dt>
                <dd className="font-semibold text-[var(--cs-text)]">
                  {data.governance.publishedBrandSettingCount} / {data.governance.brandSettingCount}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt>Guest Browser Cart Key</dt>
                <dd className="font-mono text-[11px]">{data.governance.conciergeStorageKey}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--cs-text-muted)]">
              Active Actor Permission Audit
            </h3>
            <dl className="mt-3 space-y-2 text-xs text-[var(--cs-text-secondary)]">
              <div className="flex items-center justify-between gap-2">
                <dt>Signed-In Role</dt>
                <dd className="font-mono font-semibold uppercase text-[var(--cs-text)]">
                  {data.actorRole}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt>Boutique Workspace Access</dt>
                <dd>
                  <CrmStatusBadge variant="active" label="Authorized" size="sm" />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt>Catalog Publish / Cutover Approval</dt>
                <dd>
                  <CrmStatusBadge
                    variant={data.canApproveCatalogChanges ? "active" : "neutral"}
                    label={data.canApproveCatalogChanges ? "Owner Eligible" : "Owner Role Only"}
                    size="sm"
                  />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt>Payments / Stock / Orders / Gift Writes</dt>
                <dd>
                  <CrmStatusBadge variant="warning" label="Disabled (System-Wide)" size="sm" />
                </dd>
              </div>
            </dl>

            <div className="mt-4 border-t border-[var(--cs-border-soft)] pt-3">
              {data.canApproveCatalogChanges ? (
                <Link
                  href={data.governance.ownerMarketingHref}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#CFE5D6] bg-[#EEF7F1] px-3 text-xs font-semibold text-[#1F4E33] hover:bg-[#E1F1E7]"
                >
                  <span>Open Owner Marketing Governance</span>
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </Link>
              ) : (
                <p className="m-0 text-xs text-[var(--cs-text-muted)]">
                  Storefront branding &amp; CMS edits are restricted to Owner and Digital Marketer
                  roles in Marketing Studio.
                </p>
              )}
            </div>
          </div>
        </div>
      </WorkspaceSection>
    </div>
  );
}
