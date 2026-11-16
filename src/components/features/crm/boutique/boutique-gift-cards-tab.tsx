"use client";

import Image from "next/image";
import { Gift, ShieldAlert } from "lucide-react";
import { CrmStatusBadge } from "@/components/features/crm/premium/crm-status-badge";
import {
  WorkspaceNotice,
  WorkspaceSection,
} from "@/components/features/crm/shared/crm-workspace-primitives";
import { formatPhp } from "@/lib/public/boutique-catalog";
import type { BoutiqueGiftCardOverview } from "@/lib/boutique/crm-boutique-model";
import { PendingActionButton } from "./pending-authorization-control";

export function BoutiqueGiftCardsTab({
  overview,
}: {
  overview: BoutiqueGiftCardOverview;
}) {
  return (
    <div className="space-y-4">
      <WorkspaceNotice
        tone="warning"
        title={
          <span className="inline-flex items-center gap-2">
            <ShieldAlert className="size-4 shrink-0 text-amber-700" aria-hidden="true" />
            Gift Certificate Issuance & Redemption Pending Authorization
          </span>
        }
      >
        <p className="m-0 text-xs leading-5">
          Storefront guests may select gift denominations in their browser concierge list, while{" "}
          <strong>serialized voucher issuance, payment capture, and reception redemption</strong>{" "}
          remain blocked until ledger controls are approved.
        </p>
      </WorkspaceNotice>

      <WorkspaceSection
        title="Published Gift Certificate Catalogue"
        description={`Approved public denominations from ${overview.minAmountLabel} to ${overview.maxAmountLabel} (virtual digital voucher or printed linen envelope).`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PendingActionButton
              label="Issue Voucher"
              reason="Serialized gift certificate issuance is locked pending operational authorization."
            />
            <PendingActionButton
              label="Redeem Code"
              reason="Voucher redemption against customer bookings requires authorized gift ledger tables."
            />
          </div>
        }
      >
        <div className="space-y-4 p-4">
          {overview.parentProduct ? (
            <div className="flex flex-col gap-4 rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)]/60 p-4 sm:flex-row sm:items-center">
              <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg border border-[var(--cs-border-soft)] bg-white">
                <Image
                  src={overview.parentProduct.image}
                  alt={overview.parentProduct.imageAlt}
                  fill
                  sizes="112px"
                  className="object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Gift className="size-4 text-[var(--cs-sand-dark)]" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-[var(--cs-text)]">
                    {overview.parentProduct.name}
                  </h3>
                  <CrmStatusBadge variant="info" label="Front Desk Concierge" size="sm" />
                </div>
                <p className="mt-1 text-xs text-[var(--cs-text-secondary)]">
                  {overview.parentProduct.description}
                </p>
                <p className="mt-1 text-[11px] text-[var(--cs-text-muted)]">
                  Published format label: {overview.parentProduct.sizeOrVolume} · Catalog ID:{" "}
                  <code>{overview.parentProduct.id}</code>
                </p>
              </div>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-xl border border-[var(--cs-border-soft)]">
            <table className="w-full min-w-[600px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] text-[11px] font-semibold uppercase tracking-wider text-[var(--cs-text-muted)]">
                  <th className="px-4 py-3">Option Key</th>
                  <th className="px-3 py-3">Published Label</th>
                  <th className="px-3 py-3">Denomination</th>
                  <th className="px-3 py-3">Delivery Format</th>
                  <th className="px-4 py-3 text-right">System Issuance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--cs-border-soft)] bg-[var(--cs-surface)]">
                {overview.options.map((option) => (
                  <tr key={option.id}>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--cs-text-muted)]">
                      {option.id}
                    </td>
                    <td className="px-3 py-3 font-semibold text-[var(--cs-text)]">
                      {option.label}
                    </td>
                    <td className="px-3 py-3 font-semibold text-[#1F4E33]">
                      {formatPhp(option.amount)}
                    </td>
                    <td className="px-3 py-3 text-xs text-[var(--cs-text-secondary)]">
                      {option.format}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <CrmStatusBadge
                        variant="warning"
                        label="Issuance Disabled"
                        size="sm"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </WorkspaceSection>
    </div>
  );
}
