"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { ExternalLink, Eye, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
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
  WorkspaceSection,
} from "@/components/features/crm/shared/crm-workspace-primitives";
import {
  BOUTIQUE_CATEGORIES,
  formatPhp,
  type BoutiqueCategoryId,
} from "@/lib/public/boutique-catalog";
import {
  filterAndSortBoutiqueCatalog,
  type BoutiqueCatalogItemView,
  type BoutiqueProductSortKey,
} from "@/lib/boutique/crm-boutique-model";

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

  const [dbOverrides, setDbOverrides] = useState<Record<string, {
    name: string;
    subtitle: string | null;
    category?: string | null;
    retail_price: number;
    format_volume: string | null;
    badge: string | null;
    track_inventory: boolean;
    is_active?: boolean;
  }>>({});
  const [hiddenSkus, setHiddenSkus] = useState<Record<string, boolean>>({});
  const [deletingSku, setDeletingSku] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSku, setEditingSku] = useState<string | null>(null);
  const [formSku, setFormSku] = useState("");
  const [formName, setFormName] = useState("");
  const [formSubtitle, setFormSubtitle] = useState("");
  const [formCategory, setFormCategory] = useState("Oils");
  const [formFormat, setFormFormat] = useState("100 ml Bottle");
  const [formPrice, setFormPrice] = useState("300");
  const [formBadge, setFormBadge] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const loadDbProducts = async () => {
    const { data } = await supabase.from("boutique_products").select("*");
    if (data) {
      const map: typeof dbOverrides = {};
      const hidden: Record<string, boolean> = {};
      for (const row of data) {
        if (row.is_active === false) {
          hidden[row.sku] = true;
          continue;
        }
        map[row.sku] = {
          name: row.name,
          subtitle: row.subtitle,
          category: row.category,
          retail_price: Number(row.retail_price),
          format_volume: row.format_volume,
          badge: row.badge,
          track_inventory: Boolean(row.track_inventory),
          is_active: row.is_active !== false,
        };
      }
      setDbOverrides(map);
      setHiddenSkus(hidden);
    }
  };

  useEffect(() => {
    loadDbProducts();
  }, []);

  const mergedItems = useMemo(() => {
    const baseIds = new Set(items.map((i) => i.product.id));
    const updatedBase = items
      .filter((item) => !hiddenSkus[item.product.id])
      .map((item) => {
        const override = dbOverrides[item.product.id];
        if (!override) return item;
        return {
          ...item,
          stockTrackingLabel: item.product.isGiftCertificate
            ? "Voucher (Serialized Ledger)"
            : override.track_inventory
              ? "Tracked in Branch Ledger"
              : item.stockTrackingLabel,
          product: {
            ...item.product,
            name: override.name || item.product.name,
            subtitle: override.subtitle ?? item.product.subtitle,
            sizeOrVolume: override.format_volume ?? item.product.sizeOrVolume,
            price: override.retail_price,
            priceLabel: item.product.isGiftCertificate
              ? `From ${formatPhp(override.retail_price)}`
              : formatPhp(override.retail_price),
            badge: override.badge ?? item.product.badge,
          },
        };
      });

    // Include custom SKUs created in public.boutique_products
    const templateItem = items[0];
    const customDbItems: BoutiqueCatalogItemView[] = [];
    if (templateItem) {
      for (const [sku, override] of Object.entries(dbOverrides)) {
        if (baseIds.has(sku) || hiddenSkus[sku]) continue;
        const catLabel = override.category || "Oils";
        const catId =
          catLabel.toLowerCase().includes("spray")
            ? "sprays"
            : catLabel.toLowerCase().includes("gift")
              ? "gift-cards"
              : catLabel.toLowerCase().includes("kit")
                ? "wellness-kits"
                : "oils";
        customDbItems.push({
          ...templateItem,
          categoryLabel: catLabel,
          skuKind:
            sku === "gift-certificate"
              ? "voucher"
              : catId === "wellness-kits"
                ? "kit"
                : "retail",
          stockTrackingLabel: override.track_inventory
            ? "Tracked in Branch Ledger"
            : "Voucher (Serialized Ledger)",
          product: {
            ...templateItem.product,
            id: sku,
            name: override.name,
            subtitle: override.subtitle || "Boutique Retail SKU",
            category: catId,
            sizeOrVolume: override.format_volume || "Standard Format",
            price: override.retail_price,
            priceLabel: formatPhp(override.retail_price),
            badge: override.badge || undefined,
            isGiftCertificate: sku === "gift-certificate",
          },
        });
      }
    }

    return [...updatedBase, ...customDbItems];
  }, [items, dbOverrides, hiddenSkus]);

  const filteredItems = useMemo(
    () =>
      filterAndSortBoutiqueCatalog(mergedItems, {
        category: selectedCategory,
        search: searchQuery,
        sort: sortBy,
      }),
    [mergedItems, selectedCategory, searchQuery, sortBy]
  );

  const inspectedItem = useMemo(
    () => mergedItems.find((item) => item.product.id === inspectedItemId) ?? null,
    [mergedItems, inspectedItemId]
  );

  const openCreateModal = () => {
    setEditingSku(null);
    setFormSku("");
    setFormName("");
    setFormSubtitle("");
    setFormCategory("Oils");
    setFormFormat("100 ml Bottle");
    setFormPrice("300");
    setFormBadge("");
    setFeedback(null);
    setEditorOpen(true);
  };

  const openEditModal = (item: BoutiqueCatalogItemView) => {
    setEditingSku(item.product.id);
    setFormSku(item.product.id);
    setFormName(item.product.name);
    setFormSubtitle(item.product.subtitle);
    setFormCategory(item.categoryLabel);
    setFormFormat(item.product.sizeOrVolume);
    setFormPrice(String(item.product.price));
    setFormBadge(item.product.badge ?? "");
    setFeedback(null);
    setEditorOpen(true);
  };

  const handleSaveProduct = async () => {
    if (!formSku.trim() || !formName.trim()) {
      setFeedback("SKU and Product Name are required.");
      return;
    }
    setSaving(true);
    setFeedback(null);
    const cleanSku = formSku.trim().toLowerCase().replace(/\s+/g, "-");
    const priceNum = Number(formPrice) || 0;

    const { error } = await supabase.from("boutique_products").upsert(
      {
        sku: cleanSku,
        name: formName.trim(),
        subtitle: formSubtitle.trim() || null,
        category: formCategory,
        sku_type: cleanSku === "gift-certificate" ? "voucher" : "retail",
        format_volume: formFormat.trim() || null,
        retail_price: priceNum,
        badge: formBadge.trim() || null,
        is_active: true,
        track_inventory: cleanSku !== "gift-certificate",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "sku" }
    );

    setSaving(false);
    if (error) {
      setFeedback(`Error saving SKU: ${error.message}`);
      return;
    }
    await loadDbProducts();
    setEditorOpen(false);
  };

  const handleDeleteProduct = async (item: BoutiqueCatalogItemView) => {
    const sku = item.product.id;
    const confirmed = window.confirm(
      `Are you sure you want to delete "${item.product.name}" (SKU: ${sku})? This will remove it from the Boutique catalogue.`
    );
    if (!confirmed) return;

    setDeletingSku(sku);
    try {
      const isCanonical = items.some((base) => base.product.id === sku);

      // Clear any child stock rows referencing this SKU if applicable
      await supabase.from("boutique_branch_stock").delete().eq("sku", sku);

      if (isCanonical) {
        // For canonical static items, mark is_active = false in DB so they stay hidden across reloads
        const { error } = await supabase.from("boutique_products").upsert(
          {
            sku,
            name: item.product.name,
            subtitle: item.product.subtitle || null,
            category: item.categoryLabel,
            sku_type: item.product.isGiftCertificate ? "voucher" : "retail",
            format_volume: item.product.sizeOrVolume || null,
            retail_price: item.product.price,
            badge: item.product.badge || null,
            is_active: false,
            track_inventory: !item.product.isGiftCertificate,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "sku" }
        );
        if (error) throw error;
      } else {
        // For custom SKUs, hard delete from public.boutique_products
        const { error } = await supabase
          .from("boutique_products")
          .delete()
          .eq("sku", sku);
        if (error) throw error;
      }

      setHiddenSkus((prev) => ({ ...prev, [sku]: true }));
      setDbOverrides((prev) => {
        const next = { ...prev };
        delete next[sku];
        return next;
      });
      if (inspectedItemId === sku) setInspectedItemId(null);
      if (editingSku === sku) setEditorOpen(false);
    } catch (err: any) {
      window.alert(`Failed to delete SKU "${sku}": ${err?.message || "Unknown error"}`);
    } finally {
      setDeletingSku(null);
    }
  };

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
        description="Live operational directory synced with public.boutique_products and the /products storefront."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/products"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-2.5 text-xs font-medium text-[var(--cs-text)] hover:bg-[var(--cs-surface-warm)]"
            >
              <ExternalLink className="size-3.5" aria-hidden="true" />
              <span>View /products</span>
            </Link>
            <Button type="button" size="sm" onClick={openCreateModal}>
              <Plus className="size-3.5" aria-hidden="true" />
              <span>Add Product SKU</span>
            </Button>
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
                        variant={item.product.isGiftCertificate ? "info" : "active"}
                        label={item.stockTrackingLabel}
                        size="sm"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEditModal(item)}
                        >
                          <Pencil className="size-3.5" aria-hidden="true" />
                          <span>Edit</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setInspectedItemId(item.product.id)}
                        >
                          <Eye className="size-3.5" aria-hidden="true" />
                          <span>Inspect</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={deletingSku === item.product.id}
                          onClick={() => handleDeleteProduct(item)}
                          className="border-red-200 bg-red-50/60 text-red-700 hover:bg-red-100 hover:text-red-800"
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                          <span>{deletingSku === item.product.id ? "Deleting..." : "Delete"}</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      const current = inspectedItem;
                      setInspectedItemId(null);
                      openEditModal(current);
                    }}
                  >
                    <Pencil className="size-3.5" aria-hidden="true" />
                    <span>Edit Price / Details</span>
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setInspectedItemId(null)}>
                    Close
                  </Button>
                </div>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSku ? `Edit SKU: ${editingSku}` : "Add New Boutique SKU"}</DialogTitle>
            <DialogDescription>
              Saves directly to <code>public.boutique_products</code>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-[var(--cs-text)]">SKU ID</label>
              <input
                type="text"
                disabled={Boolean(editingSku)}
                value={formSku}
                onChange={(e) => setFormSku(e.target.value)}
                placeholder="e.g. lavender-mist"
                className="mt-1 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block font-semibold text-[var(--cs-text)]">Product Name</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block font-semibold text-[var(--cs-text)]">Subtitle / Notes</label>
              <input
                type="text"
                value={formSubtitle}
                onChange={(e) => setFormSubtitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold text-[var(--cs-text)]">Retail Price (₱)</label>
                <input
                  type="number"
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block font-semibold text-[var(--cs-text)]">Format / Volume</label>
                <input
                  type="text"
                  value={formFormat}
                  onChange={(e) => setFormFormat(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold text-[var(--cs-text)]">Category</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-sm"
                >
                  <option value="Oils">Oils</option>
                  <option value="Sprays">Sprays</option>
                  <option value="Wellness Kits">Wellness Kits</option>
                  <option value="Gift Cards">Gift Cards</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-[var(--cs-text)]">Badge (Optional)</label>
                <input
                  type="text"
                  value={formBadge}
                  onChange={(e) => setFormBadge(e.target.value)}
                  placeholder="Bestseller, New..."
                  className="mt-1 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-sm"
                />
              </div>
            </div>
            {feedback ? <p className="text-xs font-medium text-red-600">{feedback}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" disabled={saving} onClick={handleSaveProduct}>
              {saving ? "Saving..." : "Save SKU"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
