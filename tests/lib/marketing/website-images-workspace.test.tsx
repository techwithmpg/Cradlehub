/**
 * @vitest-environment jsdom
 */

import { describe, expect, it, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

vi.mock("server-only", () => ({}));
vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    ...props
  }: {
    src: string;
    alt: string;
    [key: string]: unknown;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...props} />
  ),
}));

class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
});
Object.defineProperty(global, "IntersectionObserver", {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
});

import { WebsiteImagesView } from "@/components/features/marketing/website/website-images-view";
import { WebsiteStudioView } from "@/components/features/marketing/website/website-studio-view";
import {
  PUBLIC_IMAGE_SLOTS,
  buildDynamicPublicImageSlots,
  resolveSlotState,
} from "@/lib/marketing/website-images-inventory";
import { resolvePublicSiteSections } from "@/lib/public/normalized-sections";
import type { PublicSiteSectionRow } from "@/lib/queries/public-site";
import type { MarketingContentDraftRow } from "@/lib/queries/marketing-content";
import type { MarketingBrandSettingRow } from "@/lib/queries/marketing-brand";
import type { PublicCatalogService } from "@/lib/queries/services";
import type { Database } from "@/types/supabase";

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];

function createMockDraft(overrides: Partial<MarketingContentDraftRow>): MarketingContentDraftRow {
  return {
    id: "draft-1",
    content_type: "section",
    content_key: "hero",
    title: "Draft Title",
    subtitle: "Draft Subtitle",
    body: "",
    cta_label: "Book",
    cta_href: "/book",
    image_url: "",
    secondary_image_url: "",
    alt_text: "",
    link_href: "",
    sort_order: 1,
    is_enabled: true,
    metadata: {},
    status: "draft",
    created_by: "staff-1",
    updated_by: "staff-1",
    reviewed_by: null,
    reviewed_at: null,
    review_note: null,
    scheduled_for: null,
    published_at: null,
    source_section_id: null,
    source_asset_id: null,
    approved_by: null,
    approved_at: null,
    rejected_by: null,
    rejected_at: null,
    rejection_reason: null,
    archived_at: null,
    archived_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as unknown as MarketingContentDraftRow;
}

const MOCK_BRANCHES: BranchRow[] = [
  {
    id: "branch-sm",
    name: "SM City Bacolod",
    address: "3rd Floor, North Wing, SM City Bacolod",
    city: "Bacolod City",
    phone: "+63 917 707 7070",
    email: "sm@cradlewellnessliving.com",
    is_active: true,
    opening_hours: "10:00 AM - 9:00 PM",
    sort_order: 1,
    location_metadata: {
      image_url: "https://cdn.example.com/sm-branch-live.jpg",
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "branch-laluz",
    name: "La Luz Branch",
    address: "3rd Floor, La Luz Building, Lacson National Highway",
    city: "Bacolod City",
    phone: "+63 909 008 7815",
    email: "laluz@cradlewellnessliving.com",
    is_active: true,
    opening_hours: "10:00 AM - 9:00 PM",
    sort_order: 2,
    location_metadata: {
      image_url: "https://cdn.example.com/laluz-branch-live.jpg",
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
] as unknown as BranchRow[];

const MOCK_SERVICES: PublicCatalogService[] = [
  {
    id: "srv-signature",
    name: "Cradle Signature Massage",
    description: "Our signature restorative combination therapy",
    durationMinutes: 90,
    price: 1500,
    categoryName: "Massage Therapy",
    image_url: "https://cdn.example.com/signature-massage-live.jpg",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "srv-swedish",
    name: "Classic Swedish Massage",
    description: "Gentle flowing strokes for total muscular release",
    durationMinutes: 60,
    price: 900,
    categoryName: "Massage Therapy",
    image_url: "https://cdn.example.com/swedish-live.jpg",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
] as unknown as PublicCatalogService[];

const MOCK_BRAND_SETTINGS: MarketingBrandSettingRow[] = [
  {
    id: "brand-1",
    setting_key: "header_logo",
    label: "Header Logo",
    value: { url: "https://cdn.example.com/custom-header-logo.png", alt: "Cradle Logo" },
    status: "published",
    updated_at: new Date().toISOString(),
  },
  {
    id: "brand-2",
    setting_key: "footer_logo",
    label: "Footer Logo",
    value: { url: "https://cdn.example.com/custom-footer-logo.png", alt: "Cradle Footer" },
    status: "published",
    updated_at: new Date().toISOString(),
  },
  {
    id: "brand-3",
    setting_key: "brand_mark",
    label: "Brand Mark",
    value: { url: "https://cdn.example.com/custom-brand-mark.png", alt: "Cradle Mark" },
    status: "published",
    updated_at: new Date().toISOString(),
  },
  {
    id: "brand-4",
    setting_key: "site_icon",
    label: "Favicon / Site Icon",
    value: { url: "https://cdn.example.com/custom-favicon.ico", alt: "Favicon" },
    status: "published",
    updated_at: new Date().toISOString(),
  },
];

describe("Website Images Inventory & Public Parity", () => {
  it("inventories all 32 static public website image placements", () => {
    expect(PUBLIC_IMAGE_SLOTS.length).toBe(32);

    const pages = new Set(PUBLIC_IMAGE_SLOTS.map((s) => s.page));
    expect(pages.has("Homepage")).toBe(true);
    expect(pages.has("About Page")).toBe(true);
    expect(pages.has("Services & Menu")).toBe(true);
    expect(pages.has("Branches")).toBe(true);
    expect(pages.has("Landing Pages & Booking")).toBe(true);
    expect(pages.has("Brand & Identity")).toBe(true);
  });

  it("builds dynamic branch and service slots without mutating static inventory", () => {
    const dynamicSlots = buildDynamicPublicImageSlots({
      branches: MOCK_BRANCHES,
      services: MOCK_SERVICES,
    });

    expect(dynamicSlots.length).toBe(4); // 2 branches + 2 services
    expect(PUBLIC_IMAGE_SLOTS.length).toBe(32); // static array intact

    const smBranchSlot = dynamicSlots.find((s) => s.id === "branch_photo_branch-sm");
    expect(smBranchSlot).toBeDefined();
    expect(smBranchSlot?.canonicalOwner).toBe("branches");
    expect(smBranchSlot?.targetTab).toBe("branches");

    const srvSlot = dynamicSlots.find((s) => s.id === "service_photo_srv-signature");
    expect(srvSlot).toBeDefined();
    expect(srvSlot?.canonicalOwner).toBe("services");
    expect(srvSlot?.targetTab).toBe("services");
  });

  it("verifies the 5 homepage category covers remain independently editable", () => {
    const categorySlots = PUBLIC_IMAGE_SLOTS.filter(
      (s) => s.targetSectionKey === "signature_services" && s.fieldKey === "categoryImage"
    );

    expect(categorySlots.length).toBe(5);
    const categoryNames = categorySlots.map((s) => s.categoryName);
    expect(categoryNames).toContain("Massage Services");
    expect(categoryNames).toContain("Salon Services");
    expect(categoryNames).toContain("Skin Care Services");
    expect(categoryNames).toContain("Divine Renewal Packages");
    expect(categoryNames).toContain("Spa Party Packages");
  });

  it("verifies hero desktop and mobile images are independent slots", () => {
    const heroDesktop = PUBLIC_IMAGE_SLOTS.find((s) => s.id === "hero_desktop");
    const heroMobile = PUBLIC_IMAGE_SLOTS.find((s) => s.id === "hero_mobile");

    expect(heroDesktop).toBeDefined();
    expect(heroMobile).toBeDefined();
    expect(heroDesktop?.fieldKey).toBe("imageUrl");
    expect(heroMobile?.fieldKey).toBe("mobileImageUrl");
    expect(heroDesktop?.deviceUsage).toBe("desktop");
    expect(heroMobile?.deviceUsage).toBe("mobile");
  });

  it("resolves published overrides and draft states correctly with resolveSlotState", () => {
    const publishedSections: PublicSiteSectionRow[] = [
      {
        id: "sec-hero",
        section_key: "hero",
        title: "Welcome",
        subtitle: "Luxury Spa",
        body: "",
        cta_label: "Book",
        cta_href: "/book",
        image_url: "https://cdn.example.com/custom-hero-desktop.jpg",
        secondary_image_url: "https://cdn.example.com/custom-hero-portrait.jpg",
        sort_order: 1,
        is_enabled: true,
        metadata: {
          mobileImageUrl: "https://cdn.example.com/custom-hero-mobile.jpg",
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const drafts: MarketingContentDraftRow[] = [
      createMockDraft({
        id: "draft-hero",
        content_type: "section",
        content_key: "hero",
        title: "Welcome Draft",
        subtitle: "Draft subtitle",
        body: "",
        cta_label: "Book",
        cta_href: "/book",
        image_url: "https://cdn.example.com/staged-draft-desktop.jpg",
        secondary_image_url: "https://cdn.example.com/custom-hero-mobile.jpg",
        alt_text: "Hero Draft",
        sort_order: 1,
        is_enabled: true,
        status: "approved",
        metadata: {},
      }),
    ];

    const heroDesktopSlot = PUBLIC_IMAGE_SLOTS.find((s) => s.id === "hero_desktop")!;
    const heroMobileSlot = PUBLIC_IMAGE_SLOTS.find((s) => s.id === "hero_mobile")!;

    // Desktop has an approved draft
    const desktopRes = resolveSlotState({
      slot: heroDesktopSlot,
      publishedSections,
      drafts,
    });
    expect(desktopRes.effectiveUrl).toBe("https://cdn.example.com/staged-draft-desktop.jpg");
    expect(desktopRes.status).toBe("approved");
    expect(desktopRes.publishedUrl).toBe("https://cdn.example.com/custom-hero-desktop.jpg");

    // Mobile has no draft (only published override)
    const mobileRes = resolveSlotState({
      slot: heroMobileSlot,
      publishedSections,
      drafts,
    });
    expect(mobileRes.effectiveUrl).toBe("https://cdn.example.com/custom-hero-mobile.jpg");
    expect(mobileRes.status).toBe("published_custom");
  });

  it("extracts and normalizes managed slot images into NormalizedPublicSiteSections", () => {
    const publishedSections: PublicSiteSectionRow[] = [
      {
        id: "sec-site-images",
        section_key: "site_images",
        title: "Website Managed Images",
        subtitle: "",
        body: "",
        cta_label: "",
        cta_href: "",
        image_url: "",
        secondary_image_url: "",
        sort_order: 99,
        is_enabled: true,
        metadata: {
          slots: {
            home_setting_in_spa: "https://cdn.example.com/new-inspa-setting.jpg",
            mobile_ritual_glow: "https://cdn.example.com/glow-ritual.jpg",
            landing_spa_banner: "https://cdn.example.com/landing-banner.jpg",
          },
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const normalized = resolvePublicSiteSections(publishedSections);
    expect(normalized.siteImages.home_setting_in_spa).toBe(
      "https://cdn.example.com/new-inspa-setting.jpg"
    );
    expect(normalized.siteImages.mobile_ritual_glow).toBe(
      "https://cdn.example.com/glow-ritual.jpg"
    );
    expect(normalized.siteImages.landing_spa_banner).toBe(
      "https://cdn.example.com/landing-banner.jpg"
    );
    // Unset slot returns undefined and falls back safely in component
    expect(normalized.siteImages.mobile_ritual_recovery).toBeUndefined();
  });
});

describe("WebsiteImagesView Component", () => {
  it("renders the KPI summary bar with placement statistics", () => {
    render(
      <WebsiteImagesView
        role="owner"
        publishedSections={[]}
        drafts={[]}
        branches={MOCK_BRANCHES}
        services={MOCK_SERVICES}
        brandSettings={MOCK_BRAND_SETTINGS}
      />
    );

    expect(screen.getByText("Total Visual Placements")).toBeDefined();
    expect(screen.getByText("Direct Website Images")).toBeDefined();
    expect(screen.getByText("Studio Integrated")).toBeDefined();
    expect(screen.getAllByText("Active Drafts").length).toBeGreaterThan(0);
  });

  it("allows searching for placements by label", () => {
    render(
      <WebsiteImagesView
        role="owner"
        publishedSections={[]}
        drafts={[]}
        branches={MOCK_BRANCHES}
        services={MOCK_SERVICES}
        brandSettings={MOCK_BRAND_SETTINGS}
      />
    );

    const searchInput = screen.getByPlaceholderText(
      "Search by placement, label, page, or slot ID..."
    );
    fireEvent.change(searchInput, { target: { value: "Skin Care" } });

    expect(screen.getByText("Category Cover: Skin Care Services")).toBeDefined();
    expect(screen.queryByText("Hero Desktop Background")).toBeNull();
  });

  it("filters placements by page", () => {
    render(
      <WebsiteImagesView
        role="owner"
        publishedSections={[]}
        drafts={[]}
        branches={MOCK_BRANCHES}
        services={MOCK_SERVICES}
        brandSettings={MOCK_BRAND_SETTINGS}
      />
    );

    const selectElements = screen.getAllByRole("combobox");
    const pageSelect = selectElements[0]!;

    fireEvent.change(pageSelect, { target: { value: "About Page" } });

    expect(screen.getByText("About Page: Our Story Interior")).toBeDefined();
    expect(screen.getByText("About Page: The Cradle Experience")).toBeDefined();
    expect(screen.queryByText("Hero Desktop Background")).toBeNull();
  });

  it("offers direct canonical studio navigation for externally owned images", () => {
    const handleNavigate = vi.fn();
    render(
      <WebsiteImagesView
        role="owner"
        publishedSections={[]}
        drafts={[]}
        branches={MOCK_BRANCHES}
        services={MOCK_SERVICES}
        brandSettings={MOCK_BRAND_SETTINGS}
        onNavigateTab={handleNavigate}
      />
    );

    // Search for header logo (owned by brand studio)
    const searchInput = screen.getByPlaceholderText(
      "Search by placement, label, page, or slot ID..."
    );
    fireEvent.change(searchInput, { target: { value: "Header Primary Logo" } });

    const editBtn = screen.getByRole("button", { name: /Edit in Brand Studio/i });
    expect(editBtn).toBeDefined();

    fireEvent.click(editBtn);
    expect(handleNavigate).toHaveBeenCalledWith("brand");
  });

  it("opens UniversalMediaPicker when Change Picture is clicked on a website slot", () => {
    render(
      <WebsiteImagesView
        role="owner"
        publishedSections={[]}
        drafts={[]}
        branches={MOCK_BRANCHES}
        services={MOCK_SERVICES}
        brandSettings={MOCK_BRAND_SETTINGS}
      />
    );

    const searchInput = screen.getByPlaceholderText(
      "Search by placement, label, page, or slot ID..."
    );
    fireEvent.change(searchInput, { target: { value: "Hero Desktop" } });

    const changeBtn = screen.getAllByRole("button", { name: /Change Picture/i })[0]!;
    fireEvent.click(changeBtn);

    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText(/Select Image for: Hero Desktop Background/i)).toBeDefined();
  });

  it("opens Placement Preview modal with Desktop and Mobile toggle", () => {
    render(
      <WebsiteImagesView
        role="owner"
        publishedSections={[]}
        drafts={[]}
        branches={MOCK_BRANCHES}
        services={MOCK_SERVICES}
        brandSettings={MOCK_BRAND_SETTINGS}
      />
    );

    const previewButtons = screen.getAllByTitle("Preview in Context");
    expect(previewButtons.length).toBeGreaterThan(0);

    fireEvent.click(previewButtons[0]!);

    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByRole("button", { name: /Desktop/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Mobile/i })).toBeDefined();
    expect(screen.getByText("Live Published Asset:")).toBeDefined();
    expect(screen.getByText("Draft / Selected Staged Asset:")).toBeDefined();
  });

  it("hides publish button from digital marketer role", () => {
    const draft = createMockDraft({
      id: "draft-site-images",
      content_type: "section",
      content_key: "site_images",
      title: "Website Managed Images",
      status: "approved",
      metadata: {
        slots: {
          home_setting_in_spa: "https://cdn.example.com/test-draft.jpg",
        },
      },
    });

    render(
      <WebsiteImagesView
        role="digital_marketer"
        publishedSections={[]}
        drafts={[draft]}
        branches={[]}
        services={[]}
        brandSettings={[]}
      />
    );

    // Digital marketer should NOT see Publish button
    expect(screen.queryByRole("button", { name: /^Publish$/i })).toBeNull();
  });

  it("shows approve and publish buttons for owner role on active draft", () => {
    const draft = createMockDraft({
      id: "draft-site-images",
      content_type: "section",
      content_key: "site_images",
      title: "Website Managed Images",
      status: "draft",
      metadata: {
        slots: {
          home_setting_in_spa: "https://cdn.example.com/test-draft.jpg",
        },
      },
    });

    render(
      <WebsiteImagesView
        role="owner"
        publishedSections={[]}
        drafts={[draft]}
        branches={[]}
        services={[]}
        brandSettings={[]}
      />
    );

    // Owner should see Approve and Publish buttons for the draft slot
    const searchInput = screen.getByPlaceholderText(
      "Search by placement, label, page, or slot ID..."
    );
    fireEvent.change(searchInput, { target: { value: "In-Spa" } });

    expect(screen.getByRole("button", { name: /Approve/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Publish/i })).toBeDefined();
  });
});

describe("WebsiteStudioView Integration", () => {
  it("switches to Website Images mode via header mode toggle", () => {
    render(
      <WebsiteStudioView
        role="owner"
        sectionDefaults={[]}
        publishedSections={[]}
        drafts={[]}
        branches={MOCK_BRANCHES}
        services={MOCK_SERVICES}
        brandSettings={MOCK_BRAND_SETTINGS}
      />
    );

    // Initially in Sections Editor
    expect(screen.getByText("Sections Editor")).toBeDefined();
    expect(screen.getByText("Homepage Sections")).toBeDefined();

    // Click Website Images button from header mode toggle
    const imagesTabButtons = screen.getAllByRole("button", { name: /Website Images/i });
    fireEvent.click(imagesTabButtons[0]!);

    // Now Website Images workspace is active
    expect(screen.getByText("Total Visual Placements")).toBeDefined();
    expect(
      screen.getByPlaceholderText("Search by placement, label, page, or slot ID...")
    ).toBeDefined();
  });

  it("switches to Website Images mode via left sidebar banner", () => {
    render(
      <WebsiteStudioView
        role="owner"
        sectionDefaults={[]}
        publishedSections={[]}
        drafts={[]}
        branches={MOCK_BRANCHES}
        services={MOCK_SERVICES}
        brandSettings={MOCK_BRAND_SETTINGS}
      />
    );

    const openImagesBtn = screen.getByRole("button", { name: /Open Website Images/i });
    fireEvent.click(openImagesBtn);

    expect(screen.getByText("Total Visual Placements")).toBeDefined();
  });
});
