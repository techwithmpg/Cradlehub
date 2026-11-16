/** @vitest-environment jsdom */

import type { ImgHTMLAttributes } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BOUTIQUE_GIFT_CARD_OPTIONS, BOUTIQUE_PRODUCTS } from "@/lib/public/boutique-catalog";
import { BOUTIQUE_OPERATIONAL_CAPABILITIES } from "@/lib/auth/crm-permissions";
import {
  buildBoutiqueCapabilityMatrix,
  buildBoutiqueCatalogViews,
  buildBoutiqueCategorySummaries,
  buildBoutiqueCollectionSummaries,
  buildBoutiqueGiftCardOverview,
  buildBoutiqueStockMatrix,
  type CrmBoutiqueBranchRecord,
  type CrmBoutiqueWorkspaceData,
} from "@/lib/boutique/crm-boutique-model";
import { CrmBoutiqueWorkspace } from "@/components/features/crm/boutique/crm-boutique-workspace";

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    className,
  }: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={typeof src === "string" ? src : ""} alt={alt ?? ""} className={className} />
  ),
}));

afterEach(() => {
  cleanup();
});

const SAMPLE_BRANCHES: CrmBoutiqueBranchRecord[] = [
  {
    id: "branch-lacson",
    name: "Main Spa · Lacson",
    address: "3rd Floor, La Luz Building, Lacson St, Bacolod",
    phone: "0917 300 9173",
    email: "lacson@cradlewellness.ph",
    openingHours: "10:00 AM - 10:30 PM",
    isActive: true,
    isCurrentScope: true,
    pickupConciergeStatus: "In-Spa Concierge Ready (Front Desk Handoff)",
  },
  {
    id: "branch-sm",
    name: "SM City Bacolod",
    address: "3rd Floor, North Wing, SM City Bacolod",
    phone: "0917 300 9174",
    email: "sm@cradlewellness.ph",
    openingHours: "10:00 AM - 9:00 PM",
    isActive: true,
    isCurrentScope: false,
    pickupConciergeStatus: "In-Spa Concierge Ready (Front Desk Handoff)",
  },
];

function makeWorkspaceData(role: "crm" | "owner" = "crm"): CrmBoutiqueWorkspaceData {
  return {
    actorRole: role,
    currentBranchId: "branch-lacson",
    currentBranchName: "Main Spa · Lacson",
    canApproveCatalogChanges: role === "owner",
    operationalCapabilities: BOUTIQUE_OPERATIONAL_CAPABILITIES,
    catalog: buildBoutiqueCatalogViews(),
    categories: buildBoutiqueCategorySummaries(),
    collections: buildBoutiqueCollectionSummaries(),
    giftCards: buildBoutiqueGiftCardOverview(),
    branches: SAMPLE_BRANCHES,
    stockMatrix: buildBoutiqueStockMatrix(SAMPLE_BRANCHES),
    capabilityMatrix: buildBoutiqueCapabilityMatrix(role),
    governance: {
      publicRoute: "/products",
      catalogSourcePath: "src/lib/public/boutique-catalog.ts",
      heroImageUrl: "/images/boutique/boutique-hero.webp",
      publicSectionCount: 8,
      enabledSectionCount: 7,
      brandSettingCount: 5,
      publishedBrandSettingCount: 5,
      conciergeStorageKey: "cradle_boutique_cart_v1",
      wishlistStorageKey: "cradle_boutique_wishlist_v1",
      ownerMarketingHref: "/owner/marketing",
      marketingStudioHref: "/marketing",
    },
    overview: {
      totalSkus: BOUTIQUE_PRODUCTS.length,
      physicalSkus: BOUTIQUE_PRODUCTS.filter((p) => !p.isGiftCertificate).length,
      giftOptionsCount: 4,
      activeCategoriesCount: 4,
      activeBranchesCount: SAMPLE_BRANCHES.length,
    },
    notices: {
      branchLoadError: null,
      marketingLoadError: null,
    },
  };
}

describe("CrmBoutiqueWorkspace (7-screen CRM Boutique module)", () => {
  it("renders all 7 navigation tabs, filters products, and opens detail inspector dialog", () => {
    render(<CrmBoutiqueWorkspace data={makeWorkspaceData("crm")} initialTab="products" />);

    const tablist = screen.getByRole("tablist", { name: "Boutique Management sections" });
    expect(within(tablist).getAllByRole("tab")).toHaveLength(7);

    const firstOil = BOUTIQUE_PRODUCTS.find((p) => p.category === "oils")!;
    const secondOil = BOUTIQUE_PRODUCTS.filter((p) => p.category === "oils")[1] ?? BOUTIQUE_PRODUCTS[1]!;
    const sprayProduct = BOUTIQUE_PRODUCTS.find((p) => p.category === "sprays")!;

    const productsPanel = document.getElementById("boutique-panel-products")!;
    expect(productsPanel.hidden).toBe(false);

    // Canonical catalog items present in Products panel
    expect(within(productsPanel).getByText(firstOil.name)).toBeTruthy();
    expect(within(productsPanel).getByText(secondOil.name)).toBeTruthy();

    // Filter via search box for spray item & ensure firstOil drops out of Products panel
    const searchInput = within(productsPanel).getByLabelText("Search Products");
    fireEvent.change(searchInput, { target: { value: sprayProduct.id } });
    expect(within(productsPanel).getByText(sprayProduct.name)).toBeTruthy();
    expect(within(productsPanel).queryByText(firstOil.name)).toBeNull();

    // Open Inspect modal & confirm write actions remain disabled
    fireEvent.click(within(productsPanel).getByRole("button", { name: /Inspect/i }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(sprayProduct.id)).toBeTruthy();
    const lockedEdit = within(dialog).getByRole("button", {
      name: /Edit Price \/ Details/i,
    }) as HTMLButtonElement;
    expect(lockedEdit.disabled).toBe(true);
  });

  it("drills down from Categories tab into filtered Products view", () => {
    const firstOil = BOUTIQUE_PRODUCTS.find((p) => p.category === "oils")!;
    const sprayProduct = BOUTIQUE_PRODUCTS.find((p) => p.category === "sprays")!;

    render(<CrmBoutiqueWorkspace data={makeWorkspaceData("crm")} initialTab="categories" />);

    const categoriesPanel = document.getElementById("boutique-panel-categories")!;
    expect(categoriesPanel.hidden).toBe(false);
    expect(within(categoriesPanel).getByText("Boutique Category Taxonomy")).toBeTruthy();
    const filterButtons = within(categoriesPanel).getAllByRole("button", {
      name: /Filter Products/i,
    });
    expect(filterButtons.length).toBeGreaterThanOrEqual(4);

    // Filter to Oils (index 1: All Products, Oils, ...)
    fireEvent.click(filterButtons[1]!);
    const productsPanel = document.getElementById("boutique-panel-products")!;
    expect(productsPanel.hidden).toBe(false);
    expect(within(productsPanel).getByText(firstOil.name)).toBeTruthy();
    expect(within(productsPanel).queryByText(sprayProduct.name)).toBeNull();
  });

  it("renders Gift Certificates, Orders, Stock, and Branch Assignment screens with unapproved actions disabled", () => {
    render(<CrmBoutiqueWorkspace data={makeWorkspaceData("crm")} initialTab="gift-cards" />);

    const giftsPanel = document.getElementById("boutique-panel-gift-cards")!;
    expect(giftsPanel.hidden).toBe(false);
    expect(within(giftsPanel).getByText(BOUTIQUE_GIFT_CARD_OPTIONS[0]!.label)).toBeTruthy();
    expect(
      within(giftsPanel).getByText(
        BOUTIQUE_GIFT_CARD_OPTIONS[BOUTIQUE_GIFT_CARD_OPTIONS.length - 1]!.label
      )
    ).toBeTruthy();
    expect(
      (within(giftsPanel).getByRole("button", { name: /Issue Voucher/i }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
    expect(
      (within(giftsPanel).getByRole("button", { name: /Redeem Code/i }) as HTMLButtonElement)
        .disabled
    ).toBe(true);

    // Switch to Orders
    fireEvent.click(screen.getByRole("tab", { name: /Orders/i }));
    const ordersPanel = document.getElementById("boutique-panel-orders")!;
    expect(ordersPanel.hidden).toBe(false);
    expect(within(ordersPanel).getByText("0 persisted boutique orders in database")).toBeTruthy();
    expect(within(ordersPanel).getByText("cradle_boutique_cart_v1")).toBeTruthy();
    expect(
      (
        within(ordersPanel).getByRole("button", {
          name: /Create Boutique Order/i,
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);

    // Switch to Stock
    fireEvent.click(screen.getByRole("tab", { name: /Stock/i }));
    const stockPanel = document.getElementById("boutique-panel-stock")!;
    expect(stockPanel.hidden).toBe(false);
    expect(
      within(stockPanel).getAllByText("Not Tracked (Manual Shelf Check)").length
    ).toBeGreaterThan(0);
    expect(
      within(stockPanel).getAllByText("Voucher SKU (No Physical Stock)").length
    ).toBeGreaterThan(0);
    expect(
      (within(stockPanel).getByRole("button", { name: /Adjust Stock/i }) as HTMLButtonElement)
        .disabled
    ).toBe(true);

    // Switch to Branch Assignment
    fireEvent.click(screen.getByRole("tab", { name: /Branch Assignment/i }));
    const branchesPanel = document.getElementById("boutique-panel-branches")!;
    expect(branchesPanel.hidden).toBe(false);
    expect(within(branchesPanel).getAllByText("Main Spa · Lacson").length).toBeGreaterThan(0);
    expect(within(branchesPanel).getByText("SM City Bacolod")).toBeTruthy();
    expect(within(branchesPanel).getByText("Current Branch Scope")).toBeTruthy();
    expect(
      (
        within(branchesPanel).getByRole("button", {
          name: /Assign Branch SKUs/i,
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
  });

  it("renders Owner-only Marketing governance link for owner while hiding it for standard CRM role", () => {
    const { rerender } = render(
      <CrmBoutiqueWorkspace data={makeWorkspaceData("crm")} initialTab="settings" />
    );

    expect(screen.getByText("Owner Role Only")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Open Owner Marketing Governance/i })).toBeNull();

    rerender(<CrmBoutiqueWorkspace data={makeWorkspaceData("owner")} initialTab="settings" />);
    const ownerLink = screen.getByRole("link", { name: /Open Owner Marketing Governance/i });
    expect(ownerLink.getAttribute("href")).toBe("/owner/marketing");
  });
});
