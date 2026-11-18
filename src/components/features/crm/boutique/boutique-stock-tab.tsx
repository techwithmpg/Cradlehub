"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { ArrowLeftRight, Boxes, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CrmStatusBadge } from "@/components/features/crm/premium/crm-status-badge";
import {
  ToolbarSearch,
  ToolbarSelect,
  ToolbarShell,
  WorkspaceNotice,
  WorkspaceSection,
} from "@/components/features/crm/shared/crm-workspace-primitives";
import type { BoutiqueSkuKind, BoutiqueStockMatrixRow } from "@/lib/boutique/crm-boutique-model";

export function BoutiqueStockTab({
  rows,
}: {
  rows: readonly BoutiqueStockMatrixRow[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | BoutiqueSkuKind>("all");
  const [stockMap, setStockMap] = useState<Record<string, number>>({});

  const [modalOpen, setModalOpen] = useState(false);
  const [isTransfer, setIsTransfer] = useState(false);
  const [selectedSku, setSelectedSku] = useState("ginger-oil");
  const [selectedBranchId, setSelectedBranchId] = useState(
    rows[0]?.branchAssignments[0]?.branchId ?? "c1000000-0000-0000-0000-000000000001"
  );
  const [targetBranchId, setTargetBranchId] = useState(
    rows[0]?.branchAssignments[1]?.branchId ?? "c1000000-0000-0000-0000-000000000002"
  );
  const [deltaQty, setDeltaQty] = useState("5");
  const [busy, setBusy] = useState(false);

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const loadLiveStock = useCallback(async () => {
    const { data } = await supabase
      .from("boutique_branch_inventory")
      .select("branch_id, stock_on_hand, boutique_products!inner(sku)");
    if (data) {
      const next: Record<string, number> = {};
      for (const row of data as unknown as Array<{
        branch_id: string;
        stock_on_hand: number;
        boutique_products: { sku: string };
      }>) {
        next[`${row.boutique_products.sku}-${row.branch_id}`] = row.stock_on_hand;
      }
      setStockMap(next);
    }
  }, [supabase]);

  useEffect(() => {
    loadLiveStock();
  }, [loadLiveStock]);

  const handleSaveStock = async () => {
    setBusy(true);
    const qty = Number(deltaQty) || 0;
    await supabase.rpc("crm_adjust_boutique_stock", {
      p_sku: selectedSku,
      p_branch_id: selectedBranchId,
      p_delta: isTransfer ? -Math.abs(qty) : qty,
      p_transfer_to_branch_id: isTransfer ? targetBranchId : null,
    });
    setBusy(false);
    setModalOpen(false);
    await loadLiveStock();
  };

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
            <Boxes className="size-4 shrink-0 text-[#1F4E33]" aria-hidden="true" />
            Live Branch Stock Ledger Enabled
          </span>
        }
      >
        <p className="m-0 text-xs leading-5">
          Physical retail and kit SKUs are tracked per branch in{" "}
          <code>public.boutique_branch_inventory</code>. Use <strong>Adjust Stock</strong> for
          restocks/audits or <strong>Transfer Stock</strong> to move units between Main Spa and SM
          Bacolod.
        </p>
      </WorkspaceNotice>

      <WorkspaceSection
        title="Branch SKU Stock Readiness Matrix"
        description="Live SKU inventory across active Bacolod sanctuaries."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setIsTransfer(false);
                setDeltaQty("5");
                setModalOpen(true);
              }}
            >
              <Plus className="size-3.5" aria-hidden="true" />
              <span>Adjust Stock</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsTransfer(true);
                setDeltaQty("5");
                setModalOpen(true);
              }}
            >
              <ArrowLeftRight className="size-3.5" aria-hidden="true" />
              <span>Transfer Stock</span>
            </Button>
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
                      <div className="font-semibold text-[var(--cs-text)]">{row.productName}</div>
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
                    {row.branchAssignments.map((cell) => {
                      const count = stockMap[`${row.productId}-${cell.branchId}`];
                      return (
                        <td key={`${row.productId}-${cell.branchId}`} className="px-3 py-3">
                          {row.skuKind === "voucher" ? (
                            <CrmStatusBadge
                              variant="info"
                              label="Voucher (Unlimited Digital/Card)"
                              size="sm"
                            />
                          ) : (
                            <CrmStatusBadge
                              variant={(count ?? 20) > 5 ? "active" : "warning"}
                              label={`${count ?? 20} in stock`}
                              size="sm"
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </WorkspaceSection>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isTransfer ? "Transfer Branch Stock" : "Adjust Branch Stock"}</DialogTitle>
            <DialogDescription>
              Updates <code>public.boutique_branch_inventory</code> immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold">SKU</label>
              <select
                value={selectedSku}
                onChange={(e) => setSelectedSku(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-sm"
              >
                {rows
                  .filter((r) => r.skuKind !== "voucher")
                  .map((r) => (
                    <option key={r.productId} value={r.productId}>
                      {r.productName} ({r.productId})
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold">
                {isTransfer ? "From Branch" : "Branch"}
              </label>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-sm"
              >
                {branchHeaders.map((b) => (
                  <option key={b.branchId} value={b.branchId}>
                    {b.branchName}
                  </option>
                ))}
              </select>
            </div>
            {isTransfer ? (
              <div>
                <label className="block font-semibold">To Branch</label>
                <select
                  value={targetBranchId}
                  onChange={(e) => setTargetBranchId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-sm"
                >
                  {branchHeaders.map((b) => (
                    <option key={b.branchId} value={b.branchId}>
                      {b.branchName}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div>
              <label className="block font-semibold">
                {isTransfer ? "Quantity to Transfer" : "Quantity Delta (+ to add, - to deduct)"}
              </label>
              <input
                type="number"
                value={deltaQty}
                onChange={(e) => setDeltaQty(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" disabled={busy} onClick={handleSaveStock}>
              {busy ? "Saving..." : "Apply Stock Change"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
