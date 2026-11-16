"use client";

import { useMemo, useState } from "react";
import { Boxes } from "lucide-react";
import { CrmStatusBadge } from "@/components/features/crm/premium/crm-status-badge";
import {
  ToolbarSearch,
  ToolbarSelect,
  ToolbarShell,
  WorkspaceNotice,
  WorkspaceSection,
} from "@/components/features/crm/shared/crm-workspace-primitives";
import type { BoutiqueSkuKind, BoutiqueStockMatrixRow } from "@/lib/boutique/crm-boutique-model";
import { PendingActionButton } from "./pending-authorization-control";

export function BoutiqueStockTab({
  rows,
}: {
  rows: readonly BoutiqueStockMatrixRow[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | BoutiqueSkuKind>("all");

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rows.filter((row) => {
      if (kindFilter !== "all" && row.skuKind !== kindFilter) return false;
      if (!q) return true;
      return (
        row.productName.toLowerCase().includes(q) ||
        row.productId.toLowerCase().includes(q) ||
        row.categoryLabel.toLowerCase().includes(q)
      );
    });
  }, [rows, searchQuery, kindFilter]);

  const branchHeaders = rows[0]?.branchAssignments ?? [];

  return (
    <div className="space-y-4">
      <WorkspaceNotice
        tone="info"
        title={
          <span className="inline-flex items-center gap-2">
            <Boxes className="size-4 shrink-0" aria-hidden="true" />
            Stock Ledger Mutations Locked (Zero Synthetic Counts)
          </span>
        }
      >
        <p className="m-0 text-xs leading-5">
          All retail SKUs explicitly display <strong>Not Tracked (Manual Shelf Check)</strong> or{" "}
          <strong>Voucher SKU (No Physical Stock)</strong>. Inventory deductions, restock entries,
          and cross-branch transfers remain disabled pending ledger authorization.
        </p>
      </WorkspaceNotice>

      <WorkspaceSection
        title="Branch SKU Stock Readiness Matrix"
        description="Read-only SKU status across active Bacolod sanctuaries."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PendingActionButton
              label="Adjust Stock"
              reason="Direct stock count mutations are disabled until inventory ledger authorization."
            />
            <PendingActionButton
              label="Transfer Stock"
              reason="Inter-branch stock movement tracking awaits operational authorization."
            />
          </div>
        }
      >
        <div className="space-y-4 p-4">
          <ToolbarShell fieldsClassName="md:grid-cols-[minmax(220px,1.4fr)_minmax(180px,0.8fr)]">
            <ToolbarSearch
              label="Search Stock"
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Filter stock rows by SKU name or ID..."
            />
            <ToolbarSelect
              label="SKU Type"
              value={kindFilter}
              onChange={(value) => setKindFilter(value as "all" | BoutiqueSkuKind)}
            >
              <option value="all">All SKU Types</option>
              <option value="retail">Physical Retail Items</option>
              <option value="kit">Wellness Kits</option>
              <option value="voucher">Gift Certificate Vouchers</option>
            </ToolbarSelect>
          </ToolbarShell>

          <div className="overflow-x-auto rounded-xl border border-[var(--cs-border-soft)]">
            <table className="w-full min-w-[700px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] text-[11px] font-semibold uppercase tracking-wider text-[var(--cs-text-muted)]">
                  <th className="px-4 py-3">SKU & Packaging</th>
                  <th className="px-3 py-3">SKU Type</th>
                  <th className="px-3 py-3">Retail Price</th>
                  {branchHeaders.map((branch) => (
                    <th key={branch.branchId} className="px-3 py-3">
                      {branch.branchName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--cs-border-soft)] bg-[var(--cs-surface)]">
                {filteredRows.map((row) => (
                  <tr key={row.productId}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-[var(--cs-text)]">
                        {row.productName}
                      </div>
                      <div className="text-xs text-[var(--cs-text-muted)]">
                        <code>{row.productId}</code> · {row.sizeOrVolume}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs capitalize text-[var(--cs-text-secondary)]">
                      {row.skuKind} ({row.categoryLabel})
                    </td>
                    <td className="px-3 py-3 font-semibold text-[var(--cs-text)]">
                      {row.priceLabel}
                    </td>
                    {row.branchAssignments.map((cell) => (
                      <td key={`${row.productId}-${cell.branchId}`} className="px-3 py-3">
                        <CrmStatusBadge
                          variant={row.skuKind === "voucher" ? "info" : "neutral"}
                          label={cell.trackingLabel}
                          size="sm"
                        />
                      </td>
                    ))}
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
