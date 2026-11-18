"use client";

import { useCallback, useMemo, useState } from "react";
import { CrmStatCard } from "@/components/features/crm/shared/crm-cards";
import { CrmModuleTabs } from "@/components/features/crm/shared/crm-module-tabs";
import {
  CrmTabPanel,
  WorkspaceNotice,
} from "@/components/features/crm/shared/crm-workspace-primitives";
import type { BoutiqueCategoryId } from "@/lib/public/boutique-catalog";
import {
  CRM_BOUTIQUE_TABS,
  type CrmBoutiqueTabId,
  type CrmBoutiqueWorkspaceData,
} from "@/lib/boutique/crm-boutique-model";
import { BoutiqueBranchAssignmentTab } from "./boutique-branch-assignment-tab";
import { BoutiqueCategoriesCollectionsTab } from "./boutique-categories-collections-tab";
import { BoutiqueGiftCardsTab } from "./boutique-gift-cards-tab";
import { BoutiqueOrdersTab } from "./boutique-orders-tab";
import { BoutiqueProductsTab } from "./boutique-products-tab";
import { BoutiqueSettingsTab } from "./boutique-settings-tab";
import { BoutiqueStockTab } from "./boutique-stock-tab";

export function CrmBoutiqueWorkspace({
  data,
  initialTab = "products",
}: {
  data: CrmBoutiqueWorkspaceData;
  initialTab?: CrmBoutiqueTabId;
}) {
  const [activeTab, setActiveTab] = useState<CrmBoutiqueTabId>(initialTab);
  const [selectedCategory, setSelectedCategory] = useState<BoutiqueCategoryId>("all");

  const syncTabUrl = useCallback((nextTab: CrmBoutiqueTabId) => {
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", nextTab);
      window.history.replaceState(null, "", url.toString());
    } catch {
      // Ignore synthetic location errors in non-browser tests
    }
  }, []);

  const handleTabChange = useCallback(
    (nextKey: string) => {
      const matched = CRM_BOUTIQUE_TABS.find((tab) => tab.key === nextKey);
      if (!matched) return;
      setActiveTab(matched.key);
      syncTabUrl(matched.key);
    },
    [syncTabUrl]
  );

  const handleDrillDownCategory = useCallback(
    (categoryId: BoutiqueCategoryId) => {
      setSelectedCategory(categoryId);
      setActiveTab("products");
      syncTabUrl("products");
    },
    [syncTabUrl]
  );

  const moduleTabs = useMemo(
    () =>
      CRM_BOUTIQUE_TABS.map((tab) => {
        let count: number | undefined;
        if (tab.key === "products") count = data.overview.totalSkus;
        else if (tab.key === "categories") count = data.categories.length;
        else if (tab.key === "gift-cards") count = data.overview.giftOptionsCount;
        else if (tab.key === "orders") count = 0;
        else if (tab.key === "branches") count = data.branches.length;

        return {
          key: tab.key,
          label: tab.label,
          count,
          id: `boutique-tab-${tab.key}`,
          controls: `boutique-panel-${tab.key}`,
        };
      }),
    [data.branches.length, data.categories.length, data.overview.giftOptionsCount, data.overview.totalSkus]
  );

  const activeTabMeta =
    CRM_BOUTIQUE_TABS.find((tab) => tab.key === activeTab) ?? CRM_BOUTIQUE_TABS[0]!;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <CrmStatCard
          compact
          title="Catalog SKUs"
          value={data.overview.totalSkus}
          tone="success"
        />
        <CrmStatCard
          compact
          title="Retail & Kit SKUs"
          value={data.overview.physicalSkus}
          tone="neutral"
        />
        <CrmStatCard
          compact
          title="Gift Denominations"
          value={data.overview.giftOptionsCount}
          tone="info"
        />
        <CrmStatCard
          compact
          title="Pickup Branches"
          value={data.overview.activeBranchesCount}
          tone="success"
        />
        <CrmStatCard
          compact
          title="Write Operations"
          value="Locked"
          tone="warning"
        />
      </div>

      {data.notices.branchLoadError ? (
        <WorkspaceNotice tone="warning" title="Live branch directory unavailable">
          <p className="m-0 text-xs">{data.notices.branchLoadError}</p>
        </WorkspaceNotice>
      ) : null}

      <CrmModuleTabs
        tabs={moduleTabs}
        activeKey={activeTab}
        onChange={handleTabChange}
        ariaLabel="Boutique Management sections"
      />

      <CrmTabPanel
        id="boutique-panel-products"
        labelledBy="boutique-tab-products"
        active={activeTab === "products"}
      >
        <BoutiqueProductsTab
          items={data.catalog}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
        />
      </CrmTabPanel>

      <CrmTabPanel
        id="boutique-panel-categories"
        labelledBy="boutique-tab-categories"
        active={activeTab === "categories"}
      >
        <BoutiqueCategoriesCollectionsTab
          categories={data.categories}
          collections={data.collections}
          onDrillDownCategory={handleDrillDownCategory}
        />
      </CrmTabPanel>

      <CrmTabPanel
        id="boutique-panel-gift-cards"
        labelledBy="boutique-tab-gift-cards"
        active={activeTab === "gift-cards"}
      >
        <BoutiqueGiftCardsTab overview={data.giftCards} />
      </CrmTabPanel>

      <CrmTabPanel
        id="boutique-panel-orders"
        labelledBy="boutique-tab-orders"
        active={activeTab === "orders"}
      >
        <BoutiqueOrdersTab
          branches={data.branches}
          conciergeStorageKey={data.governance.conciergeStorageKey}
        />
      </CrmTabPanel>

      <CrmTabPanel
        id="boutique-panel-stock"
        labelledBy="boutique-tab-stock"
        active={activeTab === "stock"}
      >
        <BoutiqueStockTab rows={data.stockMatrix} />
      </CrmTabPanel>

      <CrmTabPanel
        id="boutique-panel-branches"
        labelledBy="boutique-tab-branches"
        active={activeTab === "branches"}
      >
        <BoutiqueBranchAssignmentTab
          branches={data.branches}
          currentBranchName={data.currentBranchName}
          totalSkus={data.overview.totalSkus}
        />
      </CrmTabPanel>

      <CrmTabPanel
        id="boutique-panel-settings"
        labelledBy="boutique-tab-settings"
        active={activeTab === "settings"}
      >
        <BoutiqueSettingsTab data={data} />
      </CrmTabPanel>
    </div>
  );
}
