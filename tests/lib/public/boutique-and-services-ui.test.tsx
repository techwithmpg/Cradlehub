/** @vitest-environment jsdom */

import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BoutiqueCartProvider } from "@/components/public/boutique-cart-context";
import { BoutiqueClient } from "@/components/public/boutique-client";
import { ServiceCatalogClient } from "@/components/public/service-catalog-client";
import type { PublicCatalogService } from "@/lib/queries/services";
import type { PublicBranch } from "@/lib/public/public-site-data";

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; preload?: boolean; priority?: boolean }) => {
    const { fill: _fill, preload: _preload, priority: _priority, ...rest } = props;
    return <img {...rest} alt={props.alt || ""} />;
  },
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/public/service-image", () => ({
  ServiceImage: ({ alt }: { alt: string }) => <span aria-label={alt} />,
}));

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => {
      store.set(key, val);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  });
  if (typeof HTMLDialogElement !== "undefined") {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute("open");
    };
  }
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("BoutiqueClient + BoutiqueCartProvider", () => {
  it("filters by category, increments quantity, adds to cart, and opens honest Gift Certificate options", () => {
    render(
      <BoutiqueCartProvider>
        <BoutiqueClient />
      </BoutiqueCartProvider>,
    );

    // Initially displays featured boutique items in product grid
    expect(screen.getByRole("heading", { name: "Ginger Oil" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Linen Spray" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Gift Certificate" })).toBeTruthy();

    // Filter to Oils tab
    fireEvent.click(screen.getByRole("tab", { name: /Oils/i }));
    expect(screen.getByRole("heading", { name: "Ginger Oil" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Linen Spray" })).toBeNull();

    // Increase Ginger Oil quantity to 2 and add to cart
    fireEvent.click(screen.getByRole("button", { name: "Increase Ginger Oil quantity" }));
    const gingerCard = screen
      .getByRole("heading", { name: "Ginger Oil" })
      .closest("article") as HTMLElement;
    fireEvent.click(within(gingerCard).getByRole("button", { name: /Add to Cart/i }));

    // Cart counter & subtotal in cart drawer update (2 × ₱300 = ₱600)
    expect(screen.getByText("Cart (2)")).toBeTruthy();
    expect(screen.getAllByText("₱600").length).toBeGreaterThan(0);

    // Switch to Gift Cards and open honest Gift Certificate Options dialog
    fireEvent.click(screen.getByRole("tab", { name: /Gift Cards/i }));
    fireEvent.click(screen.getByRole("button", { name: /Select Options/i }));
    expect(screen.getByText("Gift Certificate Options")).toBeTruthy();
    expect(screen.getByText(/front desk coordinates voucher preparation/i)).toBeTruthy();
  });
});

describe("ServiceCatalogClient", () => {
  const branches: PublicBranch[] = [
    {
      id: "branch-main",
      name: "Main Spa — Lacson",
      area: "Bacolod",
      address: "Lacson St., Bacolod City",
      phone: "0917 707 7070",
      opening_hours: "10:00 AM – 10:00 PM",
      imageUrl: "/images/spa/contact.jpg",
    },
    {
      id: "branch-sm",
      name: "SM City Bacolod",
      area: "Bacolod",
      address: "SM City Bacolod, North Wing",
      phone: "0909 008 7815",
      opening_hours: "10:00 AM – 10:00 PM",
      imageUrl: "/images/spa/booking.jpg",
    },
  ];

  const services: PublicCatalogService[] = [
    {
      id: "svc-sig",
      name: "Cradle Signature Massage",
      categoryName: "Massage Services",
      categoryOrder: 1,
      subcategory: "Signature",
      description: "Restorative full-body blend using warm oil and deep release strokes.",
      durationMinutes: 60,
      durationText: "60 min",
      price: 1200,
      priceLabel: "₱1,200",
      shortDescription: "Full-body restorative massage.",
      packagePax: null,
      packageDurationText: null,
      requiresConsultation: false,
      badges: ["Popular"],
      inclusions: ["Warm ginger tea", "Private suite"],
      isPublicBookable: true,
      isCsrOnly: false,
      isVip: false,
      isCatalogOnly: false,
      availableInSpa: true,
      availableHomeService: false,
      imageUrl: "/images/spa/service-swedish.jpg",
      imageAlt: "Cradle Signature Massage",
    },
    {
      id: "svc-aroma",
      name: "Aromatherapy Escape",
      categoryName: "Massage Services",
      categoryOrder: 2,
      subcategory: "Aromatherapy",
      description: "Calming essential oil ritual tailored for deep relaxation.",
      durationMinutes: 90,
      durationText: "90 min",
      price: 1500,
      priceLabel: "₱1,500",
      shortDescription: "Botanical oil massage.",
      packagePax: null,
      packageDurationText: null,
      requiresConsultation: false,
      badges: [],
      inclusions: [],
      isPublicBookable: true,
      isCsrOnly: false,
      isVip: false,
      isCatalogOnly: false,
      availableInSpa: true,
      availableHomeService: true,
      imageUrl: "/images/spa/service-aromatherapy.jpg",
      imageAlt: "Aromatherapy Escape",
    },
  ];

  it("constructs /book deep-links with branchId and opens View Details dialog", () => {
    render(<ServiceCatalogClient services={services} branches={branches} />);

    // Select a branch in sidebar
    const branchSelect = document.getElementById(
      "catalog-branch-select",
    ) as HTMLSelectElement;
    fireEvent.change(branchSelect, {
      target: { value: "branch-sm" },
    });

    // Check /book link includes both serviceId and branchId
    const aromaCard = screen
      .getByRole("heading", { name: "Aromatherapy Escape" })
      .closest("article") as HTMLElement;
    const bookLink = within(aromaCard).getByRole("link", { name: /Book Now/i });
    expect(bookLink.getAttribute("href")).toBe("/book?serviceId=svc-aroma&branchId=branch-sm");

    // Open View Details dialog
    fireEvent.click(within(aromaCard).getByRole("button", { name: "View Details" }));
    const detailDialog = screen.getByRole("dialog", { name: /Aromatherapy Escape details/i });
    expect(detailDialog).toBeTruthy();
    expect(within(detailDialog).getByText(/Calming essential oil ritual/i)).toBeTruthy();
    fireEvent.click(within(detailDialog).getByRole("button", { name: /Close service details/i }));

    // Filter search input keeps matched service and hides unmatched grid card
    fireEvent.change(screen.getByPlaceholderText(/Search services/i), {
      target: { value: "Aromatherapy" },
    });
    expect(screen.getAllByRole("heading", { name: "Aromatherapy Escape" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("heading", { name: "Cradle Signature Massage" })).toBeNull();
  });
});
