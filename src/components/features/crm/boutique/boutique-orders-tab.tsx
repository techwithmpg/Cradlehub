"use client";

import Link from "next/link";
import { ClipboardList, ExternalLink, MapPin, ShieldAlert } from "lucide-react";
import { CrmStatusBadge } from "@/components/features/crm/premium/crm-status-badge";
import {
  WorkspaceNotice,
  WorkspaceSection,
} from "@/components/features/crm/shared/crm-workspace-primitives";
import type { CrmBoutiqueBranchRecord } from "@/lib/boutique/crm-boutique-model";
import { PendingActionButton } from "./pending-authorization-control";

export function BoutiqueOrdersTab({
  branches,
  conciergeStorageKey,
}: {
  branches: readonly CrmBoutiqueBranchRecord[];
  conciergeStorageKey: string;
}) {
  return (
    <div className="space-y-4">
      <WorkspaceNotice
        tone="warning"
        title={
          <span className="inline-flex items-center gap-2">
            <ShieldAlert className="size-4 shrink-0 text-amber-700" aria-hidden="true" />
            Persistent Boutique Orders & Payments Pending Operational Authorization
          </span>
        }
      >
        <p className="m-0 text-xs leading-5">
          Public visitors currently assemble a guest pickup request locally in their browser (
          <code>{conciergeStorageKey}</code>) and coordinate collection directly at reception.{" "}
          <strong>
            Automated checkout, payment processing, and database order queues remain disabled.
          </strong>
        </p>
      </WorkspaceNotice>

      <WorkspaceSection
        title="Persisted Boutique Orders Queue"
        description="No database retail orders table is enabled. This panel will populate once boutique checkout and reception payment settlement are authorized."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PendingActionButton
              label="Create Boutique Order"
              reason="Persistent order creation awaits database order ledger & operational approval."
            />
            <PendingActionButton
              label="Capture Boutique Payment"
              reason="Online and POS boutique payment settlement is blocked pending authorization."
            />
          </div>
        }
      >
        <div className="p-4">
          <div className="rounded-xl border border-dashed border-[var(--cs-border)] bg-[var(--cs-surface-warm)]/60 px-6 py-10 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[var(--cs-surface)] text-[#1F4E33] shadow-[var(--cs-shadow-xs)]">
              <ClipboardList className="size-5" aria-hidden="true" />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-[var(--cs-text)]">
              0 persisted boutique orders in database
            </h3>
            <p className="mx-auto mt-1 max-w-xl text-xs leading-relaxed text-[var(--cs-text-muted)]">
              CradleHub does not fabricate placeholder order rows or pending payments. Guests use the
              storefront cart solely to prepare their in-spa pickup list ahead of an appointment or
              front-desk inquiry.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Link
                href="/crm/bookings"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#CFE5D6] bg-[#EEF7F1] px-3 text-xs font-semibold text-[#1F4E33] hover:bg-[#E1F1E7]"
              >
                <span>Open Bookings Queue</span>
              </Link>
              <Link
                href="/products"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-xs font-medium text-[var(--cs-text)] hover:bg-[var(--cs-surface-warm)]"
              >
                <ExternalLink className="size-3.5" aria-hidden="true" />
                <span>Preview Guest Storefront</span>
              </Link>
            </div>
          </div>
        </div>
      </WorkspaceSection>

      <WorkspaceSection
        title="In-Spa Front Desk Concierge Protocol"
        description="Operational steps for staff assisting guests who request boutique items or gift envelopes in person."
      >
        <div className="grid gap-3 p-4 md:grid-cols-3">
          <div className="rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#1F4E33]">Step 1 · Guest Inquiry</span>
              <CrmStatusBadge variant="active" label="Live" size="sm" />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[var(--cs-text-secondary)]">
              Verify SKU name, volume, and published retail price in the Products tab before
              confirming item availability at reception.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#1F4E33]">
                Step 2 · Physical Shelf Check
              </span>
              <CrmStatusBadge variant="neutral" label="Manual" size="sm" />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[var(--cs-text-secondary)]">
              Confirm physical retail bottle or kit inventory directly on the branch shelf until an
              authorized boutique ledger is enabled.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#1F4E33]">
                Step 3 · Branch Handoff
              </span>
              <CrmStatusBadge variant="info" label="Concierge" size="sm" />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[var(--cs-text-secondary)]">
              Coordinate pickup across active Bacolod sanctuaries:{" "}
              {branches.map((branch) => branch.name).join(" · ")}.
            </p>
            <div className="mt-2 flex items-center gap-1 text-[11px] text-[var(--cs-text-muted)]">
              <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
              <span>{branches.length} active pickup branches</span>
            </div>
          </div>
        </div>
      </WorkspaceSection>
    </div>
  );
}
