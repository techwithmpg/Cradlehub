"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ExternalLink, Layers, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CrmStatusBadge } from "@/components/features/crm/premium/crm-status-badge";
import { WorkspaceSection } from "@/components/features/crm/shared/crm-workspace-primitives";
import type { BoutiqueCategoryId } from "@/lib/public/boutique-catalog";
import type {
  BoutiqueCategorySummary,
  BoutiqueCollectionSummary,
} from "@/lib/boutique/crm-boutique-model";
import { PendingActionButton } from "./pending-authorization-control";

export function BoutiqueCategoriesCollectionsTab({
  categories,
  collections,
  onDrillDownCategory,
}: {
  categories: readonly BoutiqueCategorySummary[];
  collections: readonly BoutiqueCollectionSummary[];
  onDrillDownCategory: (categoryId: BoutiqueCategoryId) => void;
}) {
  return (
    <div className="space-y-5">
      <WorkspaceSection
        title="Boutique Category Taxonomy"
        description="Canonical filter categories shared directly between /products and this CRM Boutique console."
        actions={
          <PendingActionButton
            label="Manage Categories"
            reason="Category taxonomy editing awaits CMS/catalog mutation authorization."
          />
        }
      >
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <div
              key={category.id}
              className="flex flex-col justify-between rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-4 shadow-[var(--cs-shadow-xs)]"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--cs-surface-warm)] text-[#1F4E33]">
                      <Layers className="size-4" aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--cs-text)]">
                        {category.label}
                      </h3>
                      <p className="font-mono text-[10px] text-[var(--cs-text-muted)]">
                        key: {category.id}
                      </p>
                    </div>
                  </div>
                  <CrmStatusBadge
                    variant={category.productCount > 0 ? "active" : "neutral"}
                    label={`${category.productCount} SKU${category.productCount === 1 ? "" : "s"}`}
                    size="sm"
                  />
                </div>

                <dl className="mt-3 space-y-1.5 text-xs text-[var(--cs-text-secondary)]">
                  <div className="flex items-center justify-between">
                    <dt className="text-[var(--cs-text-muted)]">Price Spread</dt>
                    <dd className="font-semibold text-[var(--cs-text)]">
                      {category.priceRangeLabel}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-[var(--cs-text-muted)]">Collections</dt>
                    <dd className="truncate font-medium">
                      {category.linkedCollections.length > 0
                        ? category.linkedCollections.map((c) => c.title).join(", ")
                        : "Standalone category"}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--cs-border-soft)] pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onDrillDownCategory(category.id)}
                >
                  <span>Filter Products</span>
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Button>
                <Link
                  href={category.publicHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#1F4E33] hover:underline"
                >
                  <span>Storefront</span>
                  <ExternalLink className="size-3" aria-hidden="true" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </WorkspaceSection>

      <WorkspaceSection
        title="Featured Wellness Collections"
        description="Curated storefront showcase bands rendered on /products beneath the main product grid."
        actions={
          <PendingActionButton
            label="Edit Collections"
            reason="Storefront collection ordering is governed separately under Marketing & CMS authorization."
          />
        }
      >
        <div className="grid gap-3 p-4 md:grid-cols-3">
          {collections.map((entry) => (
            <div
              key={entry.collection.id}
              className="flex flex-col justify-between overflow-hidden rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-4"
            >
              <div>
                <div className="flex items-start gap-3">
                  <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)]">
                    <Image
                      src={entry.collection.image}
                      alt={entry.collection.imageAlt}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--cs-sand-dark)]">
                      <Sparkles className="size-3" aria-hidden="true" />
                      <span>{entry.categoryLabel}</span>
                    </div>
                    <h3 className="mt-0.5 text-sm font-semibold text-[var(--cs-text)]">
                      {entry.collection.title}
                    </h3>
                    <p className="mt-1 text-xs text-[var(--cs-text-muted)]">
                      {entry.collection.subtitle}
                    </p>
                  </div>
                </div>

                <div className="mt-3 rounded-lg bg-[var(--cs-surface-warm)]/70 px-3 py-2 text-xs text-[var(--cs-text-secondary)]">
                  <span className="font-medium text-[var(--cs-text)]">
                    {entry.matchingProductCount} linked SKU
                    {entry.matchingProductCount === 1 ? "" : "s"}:
                  </span>{" "}
                  {entry.matchingProductNames.join(", ")}
                </div>
              </div>

              <div className="mt-3 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onDrillDownCategory(entry.collection.category)}
                >
                  <span>Inspect in Products</span>
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </WorkspaceSection>
    </div>
  );
}
