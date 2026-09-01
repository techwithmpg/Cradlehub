/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

vi.mock("server-only", () => ({}));
vi.mock("next/image", () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string; [key: string]: unknown }) => (
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
import {
  DEFAULT_BRAND_SETTINGS,
  type MarketingBrandSettingRow,
} from "@/lib/queries/marketing-brand";
import { BrandStudioView } from "@/components/features/marketing/brand/brand-studio-view";
import { BranchesStudioView } from "@/components/features/marketing/branches/branches-studio-view";
import { ServicesStudioView } from "@/components/features/marketing/services/services-studio-view";
import { MarketingWorkspaceShell } from "@/components/features/marketing/marketing-workspace-shell";
import { analyzeMediaAssetUsage } from "@/lib/marketing/media-usage-analyzer";
import type { PublicCatalogService } from "@/lib/queries/services";
import type { MarketingMediaAssetRow } from "@/lib/queries/marketing-media";
import type { Database } from "@/types/supabase";

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];

// Mock dependencies
vi.mock("next/navigation", () => ({
  usePathname: () => "/marketing",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/app/(dashboard)/marketing/actions", () => ({
  saveMarketingDraftAction: vi.fn().mockResolvedValue({ success: true }),
  submitMarketingDraftAction: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/app/(dashboard)/owner/marketing/actions", () => ({
  approveMarketingDraftAction: vi.fn().mockResolvedValue({ success: true }),
  requestMarketingDraftChangesAction: vi.fn().mockResolvedValue({ success: true }),
  scheduleMarketingDraftAction: vi.fn().mockResolvedValue({ success: true }),
  publishMarketingDraftAction: vi.fn().mockResolvedValue({ success: true }),
  archiveMarketingDraftAction: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/app/(dashboard)/marketing/brand-actions", () => ({
  updateBrandSettingAction: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/app/(dashboard)/marketing/branch-actions", () => ({
  updateBranchPresentationAction: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/app/(dashboard)/marketing/service-actions", () => ({
  updateServicePresentationAction: vi.fn().mockResolvedValue({ success: true }),
}));

const mockBrandSettings: MarketingBrandSettingRow[] = [
  {
    id: "brand-1",
    setting_key: "header_logo",
    label: "Header Logo",
    value: { url: "/images/brand/custom-header.png", alt: "Cradle Custom Header", variant: "dark" },
    status: "published",
    updated_at: new Date().toISOString(),
  },
  {
    id: "brand-2",
    setting_key: "footer_logo",
    label: "Footer Logo",
    value: { url: "/images/brand/custom-footer.png", alt: "Cradle Custom Footer", variant: "dark" },
    status: "published",
    updated_at: new Date().toISOString(),
  },
  {
    id: "brand-3",
    setting_key: "brand_mark",
    label: "Brand Mark",
    value: { url: "/images/brand/custom-mark.png", alt: "Cradle Custom Mark", variant: "dark" },
    status: "published",
    updated_at: new Date().toISOString(),
  },
  {
    id: "brand-4",
    setting_key: "site_icon",
    label: "Site Icon",
    value: { url: "/favicon.ico", alt: "Cradle Favicon" },
    status: "published",
    updated_at: new Date().toISOString(),
  },
  {
    id: "brand-5",
    setting_key: "brand_tagline",
    label: "Brand Tagline",
    value: { text: "A sanctuary of calm in Bacolod.", subtext: "Holistic Wellness" },
    status: "published",
    updated_at: new Date().toISOString(),
  },
];

const mockBranches: BranchRow[] = [
  {
    id: "branch-lacson",
    name: "Cradle Main Spa (Lacson)",
    address: "Lacson Street, Bacolod City",
    phone: "0917-123-4567",
    secondary_phone: "(034) 433-1234",
    email: "lacson@cradlemassage.ph",
    fb_page: "https://facebook.com/cradlelacson",
    messenger_link: "https://m.me/cradlelacson",
    opening_hours: "10:00 AM - 10:00 PM Daily",
    maps_embed_url: "https://maps.google.com/embed/lacson",
    location_metadata: { image_url: "/images/spa/lacson-photo.webp" },
    is_active: true,
    sort_order: 1,
    barangay: "Mandalagan",
    city: "Bacolod",
    latitude: 10.68,
    longitude: 122.95,
    place_id: "place_lacson",
    home_service_free_km: 5,
    home_service_extra_km_fee: 50,
    slot_interval_minutes: 30,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "branch-sm",
    name: "Cradle SM City Bacolod",
    address: "SM City Bacolod, North Wing",
    phone: "0918-987-6543",
    secondary_phone: "(034) 435-5678",
    email: "sm@cradlemassage.ph",
    fb_page: "https://facebook.com/cradlesm",
    messenger_link: "https://m.me/cradlesm",
    opening_hours: "10:00 AM - 9:00 PM Mall Hours",
    maps_embed_url: "https://maps.google.com/embed/sm",
    location_metadata: { image_url: "/images/spa/sm-photo.webp" },
    is_active: true,
    sort_order: 2,
    barangay: "Reclamation Area",
    city: "Bacolod",
    latitude: 10.67,
    longitude: 122.94,
    place_id: "place_sm",
    home_service_free_km: 5,
    home_service_extra_km_fee: 50,
    slot_interval_minutes: 30,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const mockServices: PublicCatalogService[] = [
  {
    id: "service-1",
    name: "Swedish Signature Massage",
    categoryName: "Signature Massages",
    categoryOrder: 1,
    subcategory: "Massage",
    description: "Classic full-body relaxation massage using gentle strokes.",
    durationMinutes: 60,
    durationText: "60 min",
    price: 850,
    priceLabel: "₱850",
    shortDescription: "Gentle relaxation massage for full body relief.",
    packagePax: null,
    packageDurationText: null,
    requiresConsultation: false,
    badges: ["Bestseller", "Popular"],
    inclusions: ["Aromatherapy oil", "Hot towel finish"],
    isPublicBookable: true,
    isCsrOnly: false,
    isVip: false,
    isCatalogOnly: false,
    availableInSpa: true,
    availableHomeService: true,
    imageUrl: "/images/services/swedish.webp",
    imageAlt: "Swedish Massage therapy",
  },
  {
    id: "service-2",
    name: "VIP Executive Retreat",
    categoryName: "Spa Packages",
    categoryOrder: 2,
    subcategory: "Packages",
    description: "Private suite massage and scrub experience.",
    durationMinutes: 120,
    durationText: "120 min",
    price: 2500,
    priceLabel: "₱2,500",
    shortDescription: "Exclusive 2-hour luxury spa retreat.",
    packagePax: 1,
    packageDurationText: "2 hours",
    requiresConsultation: false,
    badges: ["VIP Exclusive"],
    inclusions: ["Private jacuzzi", "Herbal tea"],
    isPublicBookable: false,
    isCsrOnly: false,
    isVip: true,
    isCatalogOnly: false,
    availableInSpa: true,
    availableHomeService: false,
    imageUrl: "/images/services/vip.webp",
    imageAlt: "VIP Executive Retreat",
  },
];

describe("C5.4 Brand Studio", () => {
  it("verifies default brand setting manifest keys", () => {
    expect(DEFAULT_BRAND_SETTINGS).toHaveProperty("header_logo");
    expect(DEFAULT_BRAND_SETTINGS).toHaveProperty("footer_logo");
    expect(DEFAULT_BRAND_SETTINGS).toHaveProperty("brand_mark");
    expect(DEFAULT_BRAND_SETTINGS).toHaveProperty("site_icon");
    expect(DEFAULT_BRAND_SETTINGS).toHaveProperty("brand_tagline");
  });

  it("renders BrandStudioView for Digital Marketer with draft controls", () => {
    render(
      <BrandStudioView role="digital_marketer" brandSettings={mockBrandSettings} drafts={[]} />
    );

    expect(screen.getByText("Brand Identity & Assets")).toBeDefined();
    expect(screen.getByText("Save Draft")).toBeDefined();
    // Direct owner publish should not be available for marketer
    expect(screen.queryByText("Publish Live Settings")).toBeNull();
  });

  it("renders BrandStudioView for Owner with live publish controls", () => {
    render(<BrandStudioView role="owner" brandSettings={mockBrandSettings} drafts={[]} />);

    expect(screen.getByText("Publish Live Settings")).toBeDefined();
  });

  it("allows switching preview sub-tabs (Header, Footer, Mark, Favicon)", () => {
    render(
      <BrandStudioView role="digital_marketer" brandSettings={mockBrandSettings} drafts={[]} />
    );

    const footerTab = screen.getByText("Footer");
    fireEvent.click(footerTab);
    expect(screen.getByText("Previewing Footer Logo and brand mission statement")).toBeDefined();

    const markTab = screen.getByText("Brand Mark");
    fireEvent.click(markTab);
    expect(screen.getByText("Used for mobile icons, avatars, and watermarks")).toBeDefined();

    const faviconTab = screen.getByText("Browser Tab / Icon");
    fireEvent.click(faviconTab);
    expect(screen.getByText("Next.js Static Favicon Architecture Note:")).toBeDefined();
  });
});

describe("C5.4 Branches Studio", () => {
  it("renders BranchesStudioView and distinguishes Main Spa and SM branches", () => {
    render(<BranchesStudioView role="digital_marketer" branches={mockBranches} drafts={[]} />);

    expect(screen.getAllByText("Cradle Main Spa (Lacson)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cradle SM City Bacolod").length).toBeGreaterThan(0);
    expect(screen.getByText("Flagship")).toBeDefined();
  });

  it("allows switching branches and displays corresponding contact channels", () => {
    render(<BranchesStudioView role="owner" branches={mockBranches} drafts={[]} />);

    const smButtons = screen.getAllByRole("button", { name: /Cradle SM City Bacolod/i });
    expect(smButtons.length).toBeGreaterThan(0);
    fireEvent.click(smButtons[0]!);

    expect(screen.getAllByDisplayValue("Cradle SM City Bacolod").length).toBeGreaterThan(0);
    expect(screen.getAllByDisplayValue("0918-987-6543").length).toBeGreaterThan(0);
    expect(screen.getByText("Update Live Branch")).toBeDefined();
  });
});

describe("C5.4 Services Studio", () => {
  it("renders ServicesStudioView with category tabs and service listing", () => {
    render(<ServicesStudioView role="digital_marketer" services={mockServices} drafts={[]} />);

    expect(screen.getByText("Catalog Services (2)")).toBeDefined();
    expect(screen.getAllByText("Swedish Signature Massage").length).toBeGreaterThan(0);
    expect(screen.getAllByText("VIP Executive Retreat").length).toBeGreaterThan(0);
  });

  it("filters services by category and search query", () => {
    render(<ServicesStudioView role="digital_marketer" services={mockServices} drafts={[]} />);

    const searchInput = screen.getByPlaceholderText("Search service name...");
    fireEvent.change(searchInput, { target: { value: "Swedish" } });

    expect(screen.getByText("Catalog Services (1)")).toBeDefined();
    expect(screen.queryByText("VIP Executive Retreat")).toBeNull();
  });

  it("correctly indicates mobile eligibility invariants", () => {
    render(<ServicesStudioView role="digital_marketer" services={mockServices} drafts={[]} />);

    // Swedish is public bookable -> eligible for mobile home
    expect(screen.getByText("Eligible for Mobile Home")).toBeDefined();

    // Select VIP service
    const vipButton = screen.getByRole("button", { name: /VIP Executive Retreat/i });
    fireEvent.click(vipButton);

    expect(screen.getByText("Filtered from Mobile Home")).toBeDefined();
  });

  it("allows digital marketer to save draft but not update directly", () => {
    render(<ServicesStudioView role="digital_marketer" services={mockServices} drafts={[]} />);
    expect(screen.getByText("Catalog Services (2)")).toBeDefined();
    expect(screen.getAllByText("Swedish Signature Massage").length).toBeGreaterThan(0);
    expect(screen.getByText("Save Draft")).toBeDefined();
    expect(screen.queryByText("Update Live Service")).toBeNull();
  });

  it("allows owner to update service directly", () => {
    render(<ServicesStudioView role="owner" services={mockServices} drafts={[]} />);

    expect(screen.getByText("Update Live Service")).toBeDefined();
    expect(screen.getByText("Save Draft")).toBeDefined();
  });
});

describe("C5.4 Media Usage Analyzer & Safe Cleanup", () => {
  it("detects live media usage across brand, branch, and service stores", () => {
    const asset: MarketingMediaAssetRow = {
      id: "asset-123",
      bucket_path: "spa/lacson-photo.webp",
      public_url: "/images/spa/lacson-photo.webp",
      title: "Lacson Photo",
      alt_text: "Lacson Spa exterior",
      section_key: "branches",
      content_key: "branch_lacson",
      status: "published",
      metadata: {},
      created_by: null,
      updated_by: null,
      reviewed_by: null,
      reviewed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const usage = analyzeMediaAssetUsage(asset, {
      branches: [
        {
          id: "branch-lacson",
          name: "Cradle Main Spa (Lacson)",
          location_metadata: { image_url: "/images/spa/lacson-photo.webp" },
          is_active: true,
        },
      ],
      brandSettings: [],
      services: [],
      sections: [],
      publicAssets: [],
      drafts: [],
    });

    expect(usage.canSafelyArchive).toBe(false);
    expect(usage.totalLiveUsages).toBe(1);
    expect(usage.usages[0]?.consumerType).toBe("branch");
    expect(usage.blockingReasons.length).toBeGreaterThan(0);
  });
});

describe("C5.4 Marketing Workspace Shell", () => {
  it("renders all 5 workspace tabs and allows switching between studios", () => {
    render(
      <MarketingWorkspaceShell
        role="digital_marketer"
        sectionDefaults={[]}
        publishedSections={[]}
        drafts={[]}
        revisions={[]}
        mediaAssets={[]}
        brandSettings={mockBrandSettings}
        branches={mockBranches}
        services={mockServices}
      />
    );

    expect(screen.getByRole("tab", { name: /Website Studio/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /Brand Studio/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /Branches Studio/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /Services Studio/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /Media Library/i })).toBeDefined();

    // Switch to Brand Studio
    fireEvent.click(screen.getByRole("tab", { name: /Brand Studio/i }));
    expect(screen.getByText("Brand Identity & Assets")).toBeDefined();

    // Switch to Branches Studio
    fireEvent.click(screen.getByRole("tab", { name: /Branches Studio/i }));
    expect(screen.getAllByText("Cradle Main Spa (Lacson)").length).toBeGreaterThan(0);

    // Switch to Services Studio
    fireEvent.click(screen.getByRole("tab", { name: /Services Studio/i }));
    expect(screen.getAllByText("Swedish Signature Massage").length).toBeGreaterThan(0);
  });
});
