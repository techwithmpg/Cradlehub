"use client";

import { useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Building2, Clock, Mail, MapPin, Phone, SlidersHorizontal, Tag } from "lucide-react";
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
  WorkspaceNotice,
  WorkspaceSection,
} from "@/components/features/crm/shared/crm-workspace-primitives";
import type { CrmBoutiqueBranchRecord } from "@/lib/boutique/crm-boutique-model";

export function BoutiqueBranchAssignmentTab({
  branches,
  currentBranchName,
  totalSkus,
}: {
  branches: readonly CrmBoutiqueBranchRecord[];
  currentBranchName: string;
  totalSkus: number;
}) {
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [branchId, setBranchId] = useState(
    branches[0]?.id ?? "c1000000-0000-0000-0000-000000000001"
  );
  const [sku, setSku] = useState("ginger-oil");
  const [isAssigned, setIsAssigned] = useState(true);
  const [priceOverride, setPriceOverride] = useState("");
  const [busy, setBusy] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const handleSaveOverride = async () => {
    setBusy(true);
    setSavedNotice(null);
    const { error } = await supabase.rpc("crm_set_branch_sku_override", {
      p_branch_id: branchId,
      p_sku: sku,
      p_is_assigned: isAssigned,
      p_price_override: priceOverride.trim() ? Number(priceOverride) : null,
    });
    setBusy(false);
    if (error) {
      setSavedNotice(`Error: ${error.message}`);
      return;
    }
    setSavedNotice(`Updated branch settings for ${sku}.`);
    setOverrideOpen(false);
  };

  return (
    <div className="space-y-4">

      <WorkspaceSection
        title="Branch Pickup & SKU Eligibility Directory"
        description="Live active sanctuaries loaded from CradleHub's branches directory."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setOverrideOpen(true)}>
              <SlidersHorizontal className="size-3.5" aria-hidden="true" />
              <span>Assign Branch SKUs</span>
            </Button>
            <Button type="button" size="sm" onClick={() => setOverrideOpen(true)}>
              <Tag className="size-3.5" aria-hidden="true" />
              <span>Override Branch Price</span>
            </Button>
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
                      variant="active"
                      label="Branch Overrides Enabled"
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setBranchId(branch.id);
                    setOverrideOpen(true);
                  }}
                >
                  Configure Branch SKUs
                </Button>
              </div>
            </div>
          ))}
        </div>
      </WorkspaceSection>

      <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Branch SKU Assignment & Price Override</DialogTitle>
            <DialogDescription>
              Updates <code>public.boutique_branch_inventory</code> for the selected sanctuary.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold">Branch</label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-sm"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold">SKU</label>
              <select
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-sm"
              >
                <option value="ginger-oil">Ginger Oil</option>
                <option value="borneol-oil">Borneol Oil</option>
                <option value="linen-spray">Linen Spray</option>
                <option value="gift-certificate">Gift Certificate</option>
                <option value="calm-evening-duo">Calm Evening Duo</option>
                <option value="sanctuary-body-trilogy">Sanctuary Ritual Trio</option>
              </select>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)]/60 p-3">
              <label className="font-semibold">Available for Pickup at This Branch</label>
              <input
                type="checkbox"
                checked={isAssigned}
                onChange={(e) => setIsAssigned(e.target.checked)}
              />
            </div>
            <div>
              <label className="block font-semibold">
                Branch Price Override (₱) — Leave blank to use default retail price
              </label>
              <input
                type="number"
                value={priceOverride}
                onChange={(e) => setPriceOverride(e.target.value)}
                placeholder="e.g. 280"
                className="mt-1 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setOverrideOpen(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" disabled={busy} onClick={handleSaveOverride}>
              {busy ? "Saving..." : "Save Branch Settings"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
