"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Eye, Sparkles } from "lucide-react";
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
import {
  BOUTIQUE_CATEGORIES,
  type BoutiqueCategoryId,
} from "@/lib/public/boutique-catalog";
import {
  filterAndSortBoutiqueCatalog,
  type BoutiqueCatalogItemView,
  type BoutiqueProductSortKey,
} from "@/lib/boutique/crm-boutique-model";
import { PendingActionButton } from "./pending-authorization-control";

export function BoutiqueProductsTab({
  items,
  selectedCategory,
  onCategoryChange,
}: {
  items: readonly BoutiqueCatalogItemView[];
  selectedCategory: BoutiqueCategoryId;
  onCategoryChange: (category: BoutiqueCategoryId) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<BoutiqueProductSortKey>("catalog");
  const [inspectedItemId, setInspectedItemId] = useState<string | null>(null);

  const filteredItems = useMemo(
    () =>
      filterAndSortBoutiqueCatalog(items, {
        category: selectedCategory,
        search: searchQuery,
        sort: sortBy,
      }),
    [items, selectedCategory, searchQuery, sortBy]
  );

  const inspectedItem = useMemo(
    () => items.find((item) => item.product.id === inspectedItemId) ?? null,
    [items, inspectedItemId]
  );

  const hasFilters =
    selectedCategory !== "all" || searchQuery.trim().length > 0 || sortBy !== "catalog";

  const handleResetFilters = () => {
    onCategoryChange("all");
    setSearchQuery("");
    setSortBy("catalog");
  };

  return (
    <div className="space-y-4">
      <WorkspaceSection
        title="Canonical Boutique Catalogue"
        description="Read-only operational directory synced directly with src/lib/public/boutique-catalog.ts and the public /products storefront."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/products"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-2.5 text-xs font-medium text-[var(--cs-text)] hover:bg-[var(--cs-surface-warm)]"
            >
              <ExternalLink className="size-3.5" aria-hidden="true" />
              <span>View /products</span>
            </Link>
            <PendingActionButton
              label="Add Product SKU"
              reason="Creating or editing boutique SKUs requires authorized database catalog tables."
            />
          </div>
        }
      >
        <div className="space-y-4 p-4">
          <ToolbarShell
            fieldsClassName="md:grid-cols-[minmax(220px,1.4fr)_minmax(160px,0.8fr)_minmax(160px,0.8fr)]"
            actions={
              <div className="flex items-center gap-2">
                {hasFilters ? (
                  <Button type="button" variant="outline" size="sm" onClick={handleResetFilters}>
                    Reset
                  </Button>
                ) : null}
              </div>
            }
          >
            <ToolbarSearch
              label="Search Products"
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search name, ID, badge, or description..."
            />
            <ToolbarSelect
              label="Category"
              value={selectedCategory}
              onChange={(value) => onCategoryChange(value as BoutiqueCategoryId)}
            >
              {BOUTIQUE_CATEGORIES.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </ToolbarSelect>
            <ToolbarSelect
              label="Sort"
              value={sortBy}
              onChange={(value) => setSortBy(value as BoutiqueProductSortKey)}
            >
              <option value="catalog">Storefront Order</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="name">Name (A–Z)</option>
            </ToolbarSelect>
          </ToolbarShell>

          {filteredItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--cs-border)] bg-[var(--cs-surface-warm)]/60 px-6 py-10 text-center">
              <p className="text-sm font-semibold text-[var(--cs-text)]">
                No boutique SKUs matched your filters
              </p>
              <p className="mt-1 text-xs text-[var(--cs-text-muted)]">
                Clear the active category filter or search term to inspect all {items.length} canonical items.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                className="mt-3"
              >
                Show All {items.length} Products
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--cs-border-soft)]">
              <table className="w-full min-w-[740px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] text-[11px] font-semibold tracking-wider text-[var(--cs-text-muted)] uppercase">
                    <th className="px-4 py-3">Product & SKU</th>
                    <th className="px-3 py-3">Category</th>
                    <th className="px-3 py-3">Format / Volume</th>
                    <th className="px-3 py-3">Retail Price</th>
                    <th className="px-3 py-3">Inventory Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--cs-border-soft)] bg-[var(--cs-surface)]">
                  {filteredItems.map((item) => (
                    <tr
                      key={item.product.id}
                      className="transition-colors hover:bg-[var(--cs-surface-warm)]/50"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)]">
                            <Image
                              src={item.product.image}
                              alt={item.product.imageAlt}
                              fill
                              sizes="48px"
                              className="object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-semibold text-[var(--cs-text)]">
                                {item.product.name}
                              </span>
                              {item.product.badge ? (
                                <CrmStatusBadge variant="gold" label={item.product.badge} size="sm" />
                              ) : null}
                            </div>
                            <p className="truncate text-xs text-[var(--cs-text-muted)]">
                              {item.product.subtitle}
                            </p>
                            <p className="mt-0.5 font-mono text-[10px] text-[var(--cs-text-muted)]">
                              SKU: {item.product.id}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs font-medium text-[var(--cs-text-secondary)]">
                        <div>{item.categoryLabel}</div>
                        <div className="mt-0.5 text-[11px] capitalize text-[var(--cs-text-muted)]">
                          {item.skuKind} SKU
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-[var(--cs-text-secondary)]">
                        {item.product.sizeOrVolume}
                      </td>
                      <td className="px-3 py-3 font-semibold text-[var(--cs-text)]">
                        {item.product.priceLabel}
                      </td>
                      <td className="px-3 py-3">
                        <CrmStatusBadge
                          variant={item.product.isGiftCertificate ? "info" : "neutral"}
                          label={item.stockTrackingLabel}
                          size="sm"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setInspectedItemId(item.product.id)}
                        >
                          <Eye className="size-3.5" aria-hidden="true" />
                          <span>Inspect</span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </WorkspaceSection>

      <Dialog
        open={Boolean(inspectedItem)}
        onOpenChange={(open) => {
          if (!open) setInspectedItemId(null);
        }}
      >
        <DialogContent className="sm:max-w-xl">
          {inspectedItem ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  <span>{inspectedItem.product.name}</span>
                  {inspectedItem.product.badge ? (
                    <CrmStatusBadge variant="gold" label={inspectedItem.product.badge} size="sm" />
                  ) : null}
                </DialogTitle>
                <DialogDescription>
                  Canonical SKU ID: <code className="font-mono">{inspectedItem.product.id}</code> ·{" "}
                  {inspectedItem.categoryLabel}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
                <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] sm:aspect-square">
                  <Image
                    src={inspectedItem.product.image}
                    alt={inspectedItem.product.imageAlt}
                    fill
                    sizes="180px"
                    className="object-cover"
                  />
                </div>
                <div className="space-y-3 text-xs text-[var(--cs-text-secondary)]">
                  <div>
                    <p className="font-semibold text-[var(--cs-text)]">
                      {inspectedItem.product.subtitle}
                    </p>
                    <p className="mt-1 leading-relaxed">{inspectedItem.product.description}</p>
                  </div>
                  <dl className="grid grid-cols-2 gap-2 rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)]/60 p-3">
                    <div>
                      <dt className="text-[10px] uppercase tracking-wider text-[var(--cs-text-muted)]">
                        Retail Price
                      </dt>
                      <dd className="mt-0.5 text-sm font-semibold text-[var(--cs-text)]">
                        {inspectedItem.product.priceLabel}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-wider text-[var(--cs-text-muted)]">
                        Volume / Format
                      </dt>
                      <dd className="mt-0.5 font-medium text-[var(--cs-text)]">
                        {inspectedItem.product.sizeOrVolume}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-wider text-[var(--cs-text-muted)]">
                        Concierge Flow
                      </dt>
                      <dd className="mt-0.5 font-medium">{inspectedItem.fulfillmentLabel}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-wider text-[var(--cs-text-muted)]">
                        Stock Ledger
                      </dt>
                      <dd className="mt-0.5 font-medium">{inspectedItem.stockTrackingLabel}</dd>
                    </div>
                  </dl>
                  {inspectedItem.matchedCollections.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Sparkles className="size-3.5 text-[var(--cs-sand-dark)]" aria-hidden="true" />
                      <span>Collections:</span>
                      {inspectedItem.matchedCollections.map((collection) => (
                        <CrmStatusBadge
                          key={collection.id}
                          variant="neutral"
                          label={collection.title}
                          size="sm"
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <WorkspaceNotice tone="info" title="Mutation controls await authorization">
                <p className="m-0 text-xs">
                  Editing retail prices, archiving SKUs, or adjusting branch inventory from CRM is
                  disabled until boutique persistence and owner approval workflows are authorized.
                </p>
              </WorkspaceNotice>

              <DialogFooter className="gap-2 sm:justify-between">
                <Link
                  href={inspectedItem.publicHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-xs font-medium text-[var(--cs-text)] hover:bg-[var(--cs-surface-warm)]"
                >
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                  <span>Open Storefront Filter</span>
                </Link>
                <div className="flex flex-wrap items-center gap-2">
                  <PendingActionButton
                    label="Edit Price / Details"
                    reason="Catalog mutations are locked pending database schema & owner approval."
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => setInspectedItemId(null)}>
                    Close
                  </Button>
                </div>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
