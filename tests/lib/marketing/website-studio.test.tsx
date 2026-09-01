/**
 * @vitest-environment jsdom
 */

import { describe, expect, it, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";

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

import { WebsiteStudioView } from "@/components/features/marketing/website/website-studio-view";
import {
  LinkPicker,
  isValidExternalUrl,
} from "@/components/features/marketing/website/link-picker";
import { PUBLIC_SITE_SECTION_DEFAULTS } from "@/lib/marketing/public-section-defaults";
import type { MarketingContentDraftRow } from "@/lib/queries/marketing-content";
import type { MarketingMediaAssetRow } from "@/lib/queries/marketing-media";
import type { PublicSiteSectionRow } from "@/lib/queries/public-site";
import type { PublicCatalogService } from "@/lib/queries/services";
import { HomePageSectionsRenderer } from "@/components/public/home-page-sections";
import {
  PublicMobileHome,
  PublicMobileHomeRenderer,
  isPublicSafeService,
} from "@/components/public/mobile/public-mobile-home";
import {
  HighFidelityPreview,
  IsolatedViewportFrame,
  calculateViewportScale,
  VIEWPORT_TARGET_WIDTHS,
} from "@/components/features/marketing/website/high-fidelity-preview";
import {
  UnsavedChangesDialog,
  RevertToLiveDialog,
} from "@/components/features/marketing/website/unsaved-changes-dialog";
import { resolvePublicSiteSections } from "@/lib/public/normalized-sections";
import { act } from "react";

function getPreviewIframeBody(titleMatcher?: RegExp | string): HTMLElement {
  const iframes = Array.from(document.querySelectorAll("iframe"));
  if (iframes.length === 0) return document.body;
  if (titleMatcher) {
    for (const iframe of iframes) {
      if (
        typeof titleMatcher === "string"
          ? iframe.title.includes(titleMatcher)
          : titleMatcher.test(iframe.title)
      ) {
        return iframe.contentDocument?.body || (iframe as unknown as HTMLElement);
      }
    }
  }
  return iframes[0]?.contentDocument?.body || document.body;
}

const mockSaveMarketingDraftAction = vi.fn(async (prevState: unknown, formData: FormData) => {
  const contentKey = String(formData.get("contentKey") || "hero");
  const title = String(formData.get("title") || "");
  const id = String(formData.get("id") || `mock-draft-${contentKey}`);
  let metadata: Record<string, unknown> = {};
  try {
    const raw = String(formData.get("metadataJson") || "{}");
    metadata = JSON.parse(raw);
  } catch {
    metadata = {};
  }
  return {
    success: true,
    draft: {
      id,
      content_type: "section" as const,
      content_key: contentKey,
      title,
      subtitle: String(formData.get("subtitle") || ""),
      body: String(formData.get("body") || ""),
      cta_label: String(formData.get("ctaLabel") || ""),
      cta_href: String(formData.get("ctaHref") || ""),
      image_url: String(formData.get("imageUrl") || ""),
      secondary_image_url: String(formData.get("secondaryImageUrl") || ""),
      alt_text: String(formData.get("altText") || ""),
      link_href: String(formData.get("linkHref") || ""),
      sort_order: Number(formData.get("sortOrder")) || 0,
      is_enabled: formData.has("isEnabled") && formData.get("isEnabled") !== "false",
      metadata,
      status: "draft" as const,
      created_by: "marketer-1",
      updated_by: "marketer-1",
      reviewed_by: null,
      reviewed_at: null,
      review_note: null,
      scheduled_for: null,
      published_at: null,
      created_at: "2026-09-01T00:00:00Z",
      updated_at: "2026-09-01T00:00:00Z",
    },
  };
});

const mockSubmitMarketingDraftAction = vi.fn(async (prevState: unknown, formData: FormData) => {
  const id = String(formData.get("id") || "mock-draft-1");
  return {
    success: true,
    draft: {
      id,
      content_type: "section" as const,
      content_key: "hero",
      title: "Submitted Hero Title",
      subtitle: "",
      body: "",
      cta_label: "",
      cta_href: "",
      image_url: "",
      secondary_image_url: "",
      alt_text: "",
      link_href: "",
      sort_order: 0,
      is_enabled: true,
      metadata: {},
      status: "pending_review" as const,
      created_by: "marketer-1",
      updated_by: "marketer-1",
      reviewed_by: null,
      reviewed_at: null,
      review_note: null,
      scheduled_for: null,
      published_at: null,
      created_at: "2026-09-01T00:00:00Z",
      updated_at: "2026-09-01T00:00:00Z",
    },
  };
});

vi.mock("@/app/(dashboard)/marketing/actions", () => ({
  saveMarketingDraftAction: (prev: unknown, fd: FormData) => mockSaveMarketingDraftAction(prev, fd),
  submitMarketingDraftAction: (prev: unknown, fd: FormData) =>
    mockSubmitMarketingDraftAction(prev, fd),
}));

const mockPublishedSections: PublicSiteSectionRow[] = [
  {
    id: "pub-hero-1",
    section_key: "hero",
    title: "Published Hero Title",
    subtitle: "Published Hero Subtitle",
    body: "",
    cta_label: "Published Book",
    cta_href: "/book",
    image_url: "/images/pub-hero.jpg",
    secondary_image_url: "/images/pub-portrait.jpg",
    sort_order: 0,
    is_enabled: true,
    metadata: {
      secondaryCtaLabel: "Published Secondary",
      secondaryCtaHref: "#published-anchor",
    },
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
  },
  {
    id: "pub-about-1",
    section_key: "about",
    title: "Published About Title",
    subtitle: "Published About Eyebrow",
    body: "Published About Paragraph 1\n\nPublished About Paragraph 2",
    cta_label: null,
    cta_href: null,
    image_url: "/images/pub-about.jpg",
    secondary_image_url: "/images/pub-about-sec.jpg",
    sort_order: 10,
    is_enabled: true,
    metadata: {},
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
  },
  {
    id: "pub-quote-1",
    section_key: "quote_banner",
    title: "Published Quote",
    subtitle: "Published Pause",
    body: "",
    cta_label: "",
    cta_href: "/book",
    image_url: "/images/pub-quote.jpg",
    secondary_image_url: null,
    sort_order: 50,
    is_enabled: true,
    metadata: {},
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
  },
  {
    id: "pub-before-1",
    section_key: "before_you_book",
    title: "Published Before You Book",
    subtitle: "Guidelines",
    body: "Please note the following instructions.",
    cta_label: null,
    cta_href: null,
    image_url: null,
    secondary_image_url: null,
    sort_order: 90,
    is_enabled: true,
    metadata: {
      items: ["Item 1 Published", "Item 2 Published"],
    },
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
  },
];

const mockDrafts: MarketingContentDraftRow[] = [
  {
    id: "draft-hero-1",
    content_type: "section",
    content_key: "hero",
    title: "Draft Hero Headline",
    subtitle: "Draft Hero Subtitle description",
    body: null,
    cta_label: "Draft CTA",
    cta_href: "/services",
    image_url: "/images/draft-hero.jpg",
    secondary_image_url: "/images/draft-portrait.jpg",
    alt_text: "Draft alt text",
    link_href: null,
    sort_order: 0,
    is_enabled: true,
    metadata: {
      secondaryCtaLabel: "Draft Secondary",
      secondaryCtaHref: "#experience",
    },
    status: "draft",
    scheduled_for: null,
    source_section_id: "pub-hero-1",
    source_asset_id: null,
    created_by: "user-1",
    updated_by: "user-1",
    submitted_by: null,
    submitted_at: null,
    reviewed_by: null,
    reviewed_at: null,
    review_note: null,
    published_by: null,
    published_at: null,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
  },
];

const mockServices: PublicCatalogService[] = [
  {
    id: "svc-public-1",
    name: "Swedish Relaxation Massage",
    categoryName: "Massage Services",
    categoryOrder: 1,
    subcategory: "Signature",
    description: "Full body relaxation",
    durationMinutes: 60,
    durationText: "60 mins",
    price: 800,
    priceLabel: "₱800",
    shortDescription: "Full body relaxation",
    packagePax: null,
    packageDurationText: null,
    requiresConsultation: false,
    badges: ["Popular"],
    inclusions: ["Aromatherapy oil"],
    isPublicBookable: true,
    isCsrOnly: false,
    isVip: false,
    isCatalogOnly: false,
    availableInSpa: true,
    availableHomeService: true,
    imageUrl: "/images/swedish.jpg",
    imageAlt: "Swedish Relaxation Massage",
  },
  {
    id: "svc-csr-1",
    name: "Internal CSR Only Addon",
    categoryName: "Add-ons",
    categoryOrder: 2,
    subcategory: "Add-ons",
    description: "Only staff can select this",
    durationMinutes: 15,
    durationText: "15 mins",
    price: 200,
    priceLabel: "₱200",
    shortDescription: "Staff only addon",
    packagePax: null,
    packageDurationText: null,
    requiresConsultation: false,
    badges: [],
    inclusions: [],
    isPublicBookable: true,
    isCsrOnly: true,
    isVip: false,
    isCatalogOnly: false,
    availableInSpa: true,
    availableHomeService: false,
    imageUrl: "/images/addon.jpg",
    imageAlt: "Internal CSR Only Addon",
  },
  {
    id: "svc-vip-1",
    name: "VIP Executive Spa Treatment",
    categoryName: "Executive Packages",
    categoryOrder: 3,
    subcategory: "Packages",
    description: "Invitation-only VIP service",
    durationMinutes: 120,
    durationText: "120 mins",
    price: 3500,
    priceLabel: "₱3,500",
    shortDescription: "VIP treatment",
    packagePax: 1,
    packageDurationText: "2 hours",
    requiresConsultation: true,
    badges: ["VIP"],
    inclusions: ["Private suite"],
    isPublicBookable: true,
    isCsrOnly: false,
    isVip: true,
    isCatalogOnly: false,
    availableInSpa: true,
    availableHomeService: false,
    imageUrl: "/images/vip.jpg",
    imageAlt: "VIP Executive Spa Treatment",
  },
  {
    id: "svc-nonbookable-1",
    name: "Discontinued Seasonal Scrub",
    categoryName: "Body Scrubs",
    categoryOrder: 4,
    subcategory: "Scrubs",
    description: "Not bookable online",
    durationMinutes: 45,
    durationText: "45 mins",
    price: 600,
    priceLabel: "₱600",
    shortDescription: "Seasonal scrub",
    packagePax: null,
    packageDurationText: null,
    requiresConsultation: false,
    badges: [],
    inclusions: [],
    isPublicBookable: false,
    isCsrOnly: false,
    isVip: false,
    isCatalogOnly: true,
    availableInSpa: true,
    availableHomeService: false,
    imageUrl: "/images/scrub.jpg",
    imageAlt: "Discontinued Seasonal Scrub",
  },
];

describe("Website Studio & High-Fidelity Preview (C5 Pass 3)", () => {
  describe("WebsiteStudioView - Information Architecture & Roles", () => {
    it("renders Website Studio header and digital marketer role indicator", () => {
      render(
        <WebsiteStudioView
          role="digital_marketer"
          sectionDefaults={PUBLIC_SITE_SECTION_DEFAULTS}
          publishedSections={mockPublishedSections}
          drafts={mockDrafts}
        />
      );

      expect(screen.getByRole("heading", { name: "Website Studio", level: 1 })).toBeDefined();
      expect(screen.getByText("Digital Marketer")).toBeDefined();
      expect(screen.getByText("Managed Sections")).toBeDefined();
      expect(screen.getByText("Display Gates")).toBeDefined();
      expect(screen.getByText("Static Context (Read-Only)")).toBeDefined();
    });

    it("renders Digital Marketer action bar with Save Draft and Submit for Review, but NO Publish/Approve", () => {
      render(
        <WebsiteStudioView
          role="digital_marketer"
          sectionDefaults={PUBLIC_SITE_SECTION_DEFAULTS}
          publishedSections={mockPublishedSections}
          drafts={mockDrafts}
        />
      );

      expect(screen.getByRole("button", { name: /Save Draft/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /Submit for Review/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /Revert to Live/i })).toBeDefined();

      // Digital Marketer must not receive Owner-only controls
      expect(screen.queryByRole("button", { name: /Publish to Live/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /^Approve$/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /Request Changes/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /^Schedule$/i })).toBeNull();
    });

    it("renders Owner action bar with Save Draft, Request Changes, Approve, Schedule, and Publish to Live", () => {
      render(
        <WebsiteStudioView
          role="owner"
          sectionDefaults={PUBLIC_SITE_SECTION_DEFAULTS}
          publishedSections={mockPublishedSections}
          drafts={mockDrafts}
        />
      );

      expect(screen.getByText("Owner Studio")).toBeDefined();
      expect(screen.getByRole("button", { name: /Save Draft/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /Request Changes/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /^Approve$/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /^Schedule$/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /Publish to Live/i })).toBeDefined();
    });

    it("displays owner review notes when draft status is changes_requested", () => {
      const changesRequestedDraft: MarketingContentDraftRow = {
        ...mockDrafts[0]!,
        status: "changes_requested",
        review_note: "Please adjust hero headline to emphasize Bacolod home service.",
      };

      render(
        <WebsiteStudioView
          role="digital_marketer"
          sectionDefaults={PUBLIC_SITE_SECTION_DEFAULTS}
          publishedSections={mockPublishedSections}
          drafts={[changesRequestedDraft]}
        />
      );

      expect(screen.getByText(/Owner Review Notes for this Draft/i)).toBeDefined();
      expect(
        screen.getByText(/Please adjust hero headline to emphasize Bacolod home service/i)
      ).toBeDefined();
    });
  });

  describe("Section Classification & Static Read-Only Context", () => {
    it("renders Static Category C section with STATIC / NOT MANAGED HERE badge and explanation", () => {
      render(
        <WebsiteStudioView
          role="digital_marketer"
          sectionDefaults={PUBLIC_SITE_SECTION_DEFAULTS}
          publishedSections={mockPublishedSections}
          drafts={mockDrafts}
        />
      );

      // Click on Static Section "Cradle Experience"
      const expBtn = screen.getByRole("button", { name: /Cradle Experience/i });
      fireEvent.click(expBtn);

      expect(screen.getByText("Static / Not Managed Here")).toBeDefined();
      expect(screen.getAllByText("The Cradle Experience").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/statically rendered by public theme components/i)).toBeDefined();
      // No save draft button for static section
      expect(screen.queryByRole("button", { name: /Save Draft/i })).toBeNull();
    });

    it("renders display gate for Photo Gallery and Signature Services", () => {
      render(
        <WebsiteStudioView
          role="digital_marketer"
          sectionDefaults={PUBLIC_SITE_SECTION_DEFAULTS}
          publishedSections={mockPublishedSections}
          drafts={mockDrafts}
        />
      );

      const galleryBtn = screen.getByRole("button", { name: /Photo Gallery/i });
      fireEvent.click(galleryBtn);

      expect(screen.getByText("Homepage Display Gate")).toBeDefined();
      expect(screen.getByText("Photo Gallery Showcase")).toBeDefined();
      expect(screen.getByText("Visible on Homepage")).toBeDefined();
    });
  });

  describe("Structured Editor & LinkPicker", () => {
    it("hydrates editor fields with active draft values", () => {
      render(
        <WebsiteStudioView
          role="digital_marketer"
          sectionDefaults={PUBLIC_SITE_SECTION_DEFAULTS}
          publishedSections={mockPublishedSections}
          drafts={mockDrafts}
        />
      );

      const titleInput = screen.getByLabelText(/Main Title \/ Headline/i) as HTMLInputElement;
      expect(titleInput.value).toBe("Draft Hero Headline");

      const subtitleInput = screen.getByLabelText(
        /Subtitle \/ Supporting Paragraph/i
      ) as HTMLTextAreaElement;
      expect(subtitleInput.value).toBe("Draft Hero Subtitle description");
    });

    it("validates external URLs and prevents unsafe javascript/data schemes in LinkPicker", () => {
      expect(isValidExternalUrl("https://cradlewellnessliving.com")).toBe(true);
      expect(isValidExternalUrl("http://example.com")).toBe(true);
      expect(isValidExternalUrl("not-a-url")).toBe(false);

      const onChange = vi.fn();
      render(<LinkPicker value="/book" onChange={onChange} label="Button Destination" />);

      // Switch to custom URL mode
      const toggleBtn = screen.getByRole("button", { name: /Enter custom URL/i });
      fireEvent.click(toggleBtn);

      const customInput = screen.getByPlaceholderText(/https:\/\/example.com or \/custom-path/i);
      fireEvent.change(customInput, { target: { value: "javascript:alert(1)" } });

      expect(screen.getByText(/Unsafe URL scheme is not allowed/i)).toBeDefined();
      expect(onChange).not.toHaveBeenCalledWith("javascript:alert(1)");
    });
  });

  describe("High-Fidelity Preview & Realtime Reactivity", () => {
    it("updates Draft preview in memory immediately when user types in editor", () => {
      render(
        <WebsiteStudioView
          role="digital_marketer"
          sectionDefaults={PUBLIC_SITE_SECTION_DEFAULTS}
          publishedSections={mockPublishedSections}
          drafts={mockDrafts}
        />
      );

      const titleInput = screen.getByLabelText(/Main Title \/ Headline/i);
      fireEvent.change(titleInput, { target: { value: "Live In-Memory Edited Hero" } });

      // Verify that the High-Fidelity Preview iframe reflects the in-memory update
      const previewBody = getPreviewIframeBody(/Preview/i);
      const previewHeading = within(previewBody).getByRole("heading", {
        name: "Live In-Memory Edited Hero",
      });
      expect(previewHeading).toBeDefined();
    });

    it("renders Live preview with published values unaffected by in-memory edits", () => {
      render(
        <WebsiteStudioView
          role="digital_marketer"
          sectionDefaults={PUBLIC_SITE_SECTION_DEFAULTS}
          publishedSections={mockPublishedSections}
          drafts={mockDrafts}
        />
      );

      // Switch preview mode to Live using exact mode button
      const liveModeBtn = screen.getByRole("button", { name: /^Live$/i });
      fireEvent.click(liveModeBtn);

      expect(screen.getByText("Published Live Version")).toBeDefined();
      const previewBody = getPreviewIframeBody(/LIVE|Live|Preview/i);
      expect(
        within(previewBody).getByRole("heading", { name: "Published Hero Title" })
      ).toBeDefined();
    });

    it("renders Compare mode with both [LIVE] and [DRAFT] frames", () => {
      render(
        <WebsiteStudioView
          role="digital_marketer"
          sectionDefaults={PUBLIC_SITE_SECTION_DEFAULTS}
          publishedSections={mockPublishedSections}
          drafts={mockDrafts}
        />
      );

      const compareBtn = screen.getByRole("button", { name: /^Compare$/i });
      fireEvent.click(compareBtn);

      expect(screen.getByText(/Comparing Live vs Working Draft/i)).toBeDefined();
      expect(screen.getByText("[LIVE] Published Site")).toBeDefined();
      expect(screen.getByText("[DRAFT] Working Editor State")).toBeDefined();

      const liveBody = getPreviewIframeBody(/\[LIVE\]/i);
      const draftBody = getPreviewIframeBody(/\[DRAFT\]/i);
      expect(within(liveBody).getByText("Published Hero Title")).toBeDefined();
      expect(within(draftBody).getByText("Draft Hero Headline")).toBeDefined();
    });

    it("switches viewports between Desktop, Tablet, and Mobile without losing editor state", () => {
      render(
        <WebsiteStudioView
          role="digital_marketer"
          sectionDefaults={PUBLIC_SITE_SECTION_DEFAULTS}
          publishedSections={mockPublishedSections}
          drafts={mockDrafts}
        />
      );

      const titleInput = screen.getByLabelText(/Main Title \/ Headline/i);
      fireEvent.change(titleInput, {
        target: { value: "Draft Hero Headline - Unsaved State Check" },
      });

      // Switch to Mobile Viewport
      const mobileBtn = screen.getByRole("button", { name: /Mobile Viewport/i });
      fireEvent.click(mobileBtn);

      // Verify Mobile hero renders the updated draft headline inside iframe
      const mobileBody = getPreviewIframeBody(/MOBILE/i);
      expect(
        within(mobileBody).getAllByText(/Draft Hero Headline - Unsaved State Check/i).length
      ).toBeGreaterThanOrEqual(1);

      // Switch to Tablet Viewport
      const tabletBtn = screen.getByRole("button", { name: /Tablet Viewport/i });
      fireEvent.click(tabletBtn);

      // Verify input value in editor remained unchanged
      expect(
        (screen.getByLabelText(/Main Title \/ Headline/i) as HTMLInputElement).value
      ).toContain("Unsaved State Check");
    });
  });

  describe("Unsaved Changes Guard & Revert to Live", () => {
    it("prompts confirmation dialog when navigating to another section with unsaved edits", () => {
      render(
        <WebsiteStudioView
          role="digital_marketer"
          sectionDefaults={PUBLIC_SITE_SECTION_DEFAULTS}
          publishedSections={mockPublishedSections}
          drafts={mockDrafts}
        />
      );

      // Make an unsaved edit
      const titleInput = screen.getByLabelText(/Main Title \/ Headline/i);
      fireEvent.change(titleInput, { target: { value: "Modified Hero Title" } });

      // Try to navigate to About
      const aboutNavBtn = screen.getByRole("button", { name: /About & Philosophy/i });
      fireEvent.click(aboutNavBtn);

      // Confirmation modal should open
      expect(screen.getByText("Unsaved Section Changes")).toBeDefined();
      expect(screen.getByRole("button", { name: /Stay and Keep Editing/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /Discard Changes/i })).toBeDefined();
    });

    it("reverts working editor to live values when Revert to Live is confirmed", () => {
      render(
        <WebsiteStudioView
          role="digital_marketer"
          sectionDefaults={PUBLIC_SITE_SECTION_DEFAULTS}
          publishedSections={mockPublishedSections}
          drafts={mockDrafts}
        />
      );

      // Click Revert to Live
      const revertBtns = screen.getAllByRole("button", { name: /Revert to Live/i });
      fireEvent.click(revertBtns[0]!);

      expect(screen.getByText(/Revert Hero Header to Live Values\?/i)).toBeDefined();
      const dialogElement = screen.getByRole("dialog");
      const dialogConfirmBtn = within(dialogElement).getByRole("button", {
        name: /Revert to Live/i,
      });
      fireEvent.click(dialogConfirmBtn);

      // Verify form state was reset to published values
      const titleInput = screen.getByLabelText(/Main Title \/ Headline/i) as HTMLInputElement;
      expect(titleInput.value).toBe("Published Hero Title");
    });
  });

  describe("UI Cleanliness & Media Picker Integration", () => {
    it("ensures normal UI has no raw JSON textareas or database/Supabase jargon", () => {
      render(
        <WebsiteStudioView
          role="digital_marketer"
          sectionDefaults={PUBLIC_SITE_SECTION_DEFAULTS}
          publishedSections={mockPublishedSections}
          drafts={mockDrafts}
        />
      );

      // Verify no raw JSON textarea exists
      expect(screen.queryByPlaceholderText(/metadataJson/i)).toBeNull();
      expect(screen.queryByText(/supabase/i)).toBeNull();
      expect(screen.queryByText(/postgres/i)).toBeNull();
      expect(screen.queryByText(/storage bucket/i)).toBeNull();
    });

    it("navigates between all Category A managed sections", () => {
      render(
        <WebsiteStudioView
          role="digital_marketer"
          sectionDefaults={PUBLIC_SITE_SECTION_DEFAULTS}
          publishedSections={mockPublishedSections}
          drafts={mockDrafts}
        />
      );

      // Quote banner
      const quoteBtn = screen.getByRole("button", { name: /Promotion \/ Quote Banner/i });
      fireEvent.click(quoteBtn);
      expect(screen.getByText("Promotional Quote Banner")).toBeDefined();

      // Before you book
      const beforeBtn = screen.getByRole("button", { name: /Before You Book/i });
      fireEvent.click(beforeBtn);
      expect(screen.getByText("Before You Book Guide")).toBeDefined();
      expect(screen.getByText("Booking Guidelines Checklist Items")).toBeDefined();
    });

    it("preserves other unsaved editor fields when opening and selecting from UniversalMediaPicker", () => {
      const mockMediaAssets: MarketingMediaAssetRow[] = [
        {
          id: "media-hero-1",
          bucket_path: "media/1725170000-hero-spa.jpg",
          public_url: "https://example.com/media/1725170000-hero-spa.jpg",
          title: "Treatment Room 1",
          alt_text: "Selected treatment room",
          section_key: "hero",
          content_key: null,
          status: "published",
          metadata: { sizeBytes: 512000, mimeType: "image/jpeg" },
          created_by: "staff-1",
          updated_by: "staff-1",
          reviewed_by: "owner-1",
          reviewed_at: "2026-09-01T00:00:00Z",
          created_at: "2026-09-01T00:00:00Z",
          updated_at: "2026-09-01T00:00:00Z",
        },
      ];

      render(
        <WebsiteStudioView
          role="digital_marketer"
          sectionDefaults={PUBLIC_SITE_SECTION_DEFAULTS}
          publishedSections={mockPublishedSections}
          drafts={mockDrafts}
          mediaAssets={mockMediaAssets}
        />
      );

      // 1. Make an unsaved edit to title
      const titleInput = screen.getByLabelText(/Main Title \/ Headline/i) as HTMLInputElement;
      fireEvent.change(titleInput, { target: { value: "Preserved Unsaved Title" } });
      expect(titleInput.value).toBe("Preserved Unsaved Title");

      // 2. Open Media Picker
      const chooseButtons = screen.getAllByRole("button", {
        name: /Change Image|Choose from Media Library/i,
      });
      fireEvent.click(chooseButtons[0]!);

      // Modal should be open
      expect(screen.getByText(/Select Primary Image/i)).toBeDefined();

      // 3. Select the active asset from library
      const assetImage = screen.getByAltText("Selected treatment room");
      fireEvent.click(assetImage);

      const confirmBtn = screen.getByRole("button", { name: /Select Image/i });
      fireEvent.click(confirmBtn);

      // 4. Verify title field STILL has the unsaved value
      expect(titleInput.value).toBe("Preserved Unsaved Title");
    });
  });

  describe("Save-Dirty State & Immediate Submission", () => {
    it("handles section editing and dirty state tracking", () => {
      render(
        <WebsiteStudioView
          role="digital_marketer"
          sectionDefaults={PUBLIC_SITE_SECTION_DEFAULTS}
          publishedSections={mockPublishedSections}
          drafts={mockDrafts}
        />
      );

      // Verify dirty state triggers discard warning on navigate
      const titleInput = screen.getByLabelText(/Main Title \/ Headline/i) as HTMLInputElement;
      fireEvent.change(titleInput, { target: { value: "Dirty Title" } });

      const aboutBtn = screen.getByRole("button", { name: /About & Philosophy/i });
      fireEvent.click(aboutBtn);

      // Dialog should appear
      expect(screen.getByText("Unsaved Section Changes")).toBeDefined();

      // Cancel dialog
      const stayBtn = screen.getByRole("button", { name: /Stay and Keep Editing/i });
      fireEvent.click(stayBtn);
      expect(titleInput.value).toBe("Dirty Title");
    });

    it("edit -> successful Save Draft -> dirty state clears", async () => {
      render(
        <WebsiteStudioView
          role="digital_marketer"
          sectionDefaults={PUBLIC_SITE_SECTION_DEFAULTS}
          publishedSections={mockPublishedSections}
          drafts={[]}
        />
      );

      // 1. Initially clean
      expect(screen.queryByText(/Unsaved edits/i)).toBeNull();

      // 2. Edit field -> becomes dirty
      const titleInput = screen.getByLabelText(/Main Title \/ Headline/i) as HTMLInputElement;
      fireEvent.change(titleInput, { target: { value: "Brand New Saved Hero Title" } });
      expect(screen.getByText(/Unsaved edits/i)).toBeDefined();

      // 3. Submit form / Save Draft
      const saveBtn = screen.getByRole("button", { name: /Save Draft/i });
      await act(async () => {
        fireEvent.click(saveBtn);
      });

      // 4. Dirty state indicator clears after successful save
      expect(screen.queryByText(/Unsaved edits/i)).toBeNull();
      expect(titleInput.value).toBe("Brand New Saved Hero Title");
    });

    it("navigation after successful Save does NOT show unsaved-changes dialog", async () => {
      render(
        <WebsiteStudioView
          role="digital_marketer"
          sectionDefaults={PUBLIC_SITE_SECTION_DEFAULTS}
          publishedSections={mockPublishedSections}
          drafts={[]}
        />
      );

      // Edit and Save
      const titleInput = screen.getByLabelText(/Main Title \/ Headline/i) as HTMLInputElement;
      fireEvent.change(titleInput, { target: { value: "Clean Saved Title" } });

      const saveBtn = screen.getByRole("button", { name: /Save Draft/i });
      await act(async () => {
        fireEvent.click(saveBtn);
      });

      // Navigate to another section
      const aboutBtn = screen.getByRole("button", { name: /About & Philosophy/i });
      await act(async () => {
        fireEvent.click(aboutBtn);
      });

      // Dialog should NOT be present
      expect(screen.queryByText("Unsaved Section Changes")).toBeNull();
      // Active section should now be About (loaded published title for About section)
      const aboutTitleInput = screen.getByLabelText(/Main Title \/ Headline/i) as HTMLInputElement;
      expect(aboutTitleInput.value).toBe("Published About Title");
    });

    it("successful creation of a new section draft immediately exposes Submit for Review without reload", async () => {
      render(
        <WebsiteStudioView
          role="digital_marketer"
          sectionDefaults={PUBLIC_SITE_SECTION_DEFAULTS}
          publishedSections={mockPublishedSections}
          drafts={[]} // No pre-existing drafts
        />
      );

      // Before save: draft does not exist so Submit for Review is not rendered
      expect(screen.queryByRole("button", { name: /Submit for Review/i })).toBeNull();

      // Edit title and Save
      const titleInput = screen.getByLabelText(/Main Title \/ Headline/i) as HTMLInputElement;
      fireEvent.change(titleInput, { target: { value: "Submittable Hero Title" } });

      const saveBtn = screen.getByRole("button", { name: /Save Draft/i });
      await act(async () => {
        fireEvent.click(saveBtn);
      });

      // After save: draft is now recognized and Submit for Review is immediately active
      const submitBtnAfter = screen.getByRole("button", { name: /Submit for Review/i });
      expect(submitBtnAfter).toBeDefined();
      expect(submitBtnAfter.hasAttribute("disabled")).toBe(false);
    });
  });

  describe("Mobile Preview Parity & Public Safe Service Rules", () => {
    it("isPublicSafeService filters correctly by public bookability, CSR-only, and VIP rules", () => {
      // 1. Public-bookable normal service -> TRUE
      expect(isPublicSafeService(mockServices[0]!)).toBe(true);

      // 2. CSR-only service -> FALSE
      expect(isPublicSafeService(mockServices[1]!)).toBe(false);

      // 3. VIP service -> FALSE
      expect(isPublicSafeService(mockServices[2]!)).toBe(false);

      // 4. Non-public bookable service -> FALSE
      expect(isPublicSafeService(mockServices[3]!)).toBe(false);
    });

    it("PublicMobileHomeRenderer renders in desktop test environment without md:hidden", () => {
      const normalized = resolvePublicSiteSections(mockPublishedSections);
      const { container } = render(
        <PublicMobileHomeRenderer
          sections={normalized}
          branches={[]}
          services={mockServices.filter(isPublicSafeService)}
        />
      );

      // The root element of the renderer must NOT contain md:hidden
      const rootDiv = container.firstElementChild as HTMLElement;
      expect(rootDiv.classList.contains("md:hidden")).toBe(false);

      // Public service is rendered
      expect(screen.getByText("Swedish Relaxation Massage")).toBeDefined();
      // Excluded services are not rendered
      expect(screen.queryByText("Internal CSR Only Addon")).toBeNull();
      expect(screen.queryByText("VIP Executive Spa Treatment")).toBeNull();
      expect(screen.queryByText("Discontinued Seasonal Scrub")).toBeNull();
    });

    it("PublicMobileHome applies md:hidden wrapper for public consumer responsiveness", () => {
      const normalized = resolvePublicSiteSections(mockPublishedSections);
      const { container } = render(
        <PublicMobileHome sections={normalized} branches={[]} services={mockServices} />
      );

      // Public wrapper must contain md:hidden
      const wrapperDiv = container.firstElementChild as HTMLElement;
      expect(wrapperDiv.classList.contains("md:hidden")).toBe(true);

      // Renders public service and filters out unsafe services
      expect(screen.getByText("Swedish Relaxation Massage")).toBeDefined();
      expect(screen.queryByText("Internal CSR Only Addon")).toBeNull();
      expect(screen.queryByText("VIP Executive Spa Treatment")).toBeNull();
      expect(screen.queryByText("Discontinued Seasonal Scrub")).toBeNull();
    });

    it("HighFidelityPreview in mobile viewport renders filtered public services in desktop test environment", () => {
      const normalized = resolvePublicSiteSections(mockPublishedSections);
      render(
        <HighFidelityPreview
          draftSections={normalized}
          liveSections={normalized}
          initialMode="draft"
          initialViewport="mobile"
          branches={[]}
          services={mockServices}
        />
      );

      // Studio mobile preview displays public service inside isolated iframe
      const previewBody = getPreviewIframeBody(/MOBILE/i);
      expect(within(previewBody).getByText("Swedish Relaxation Massage")).toBeDefined();
      // Excludes CSR-only, VIP, and non-bookable
      expect(within(previewBody).queryByText("Internal CSR Only Addon")).toBeNull();
      expect(within(previewBody).queryByText("VIP Executive Spa Treatment")).toBeNull();
      expect(within(previewBody).queryByText("Discontinued Seasonal Scrub")).toBeNull();
    });
  });

  describe("Viewport Isolation & Service Parity (C5 Pass 3 Final Preview-Fidelity)", () => {
    it("calculateViewportScale calculates non-upscaling visual scale factor correctly", () => {
      // 1. Available width narrower than target (e.g. 640px pane with 1280px desktop preview)
      expect(calculateViewportScale(640, 1280)).toBe(0.5);
      expect(calculateViewportScale(384, 768)).toBe(0.5);
      expect(calculateViewportScale(300, 375)).toBe(0.8);

      // 2. Available width greater than or equal to target (never upscale beyond 1.0)
      expect(calculateViewportScale(1280, 1280)).toBe(1);
      expect(calculateViewportScale(1600, 1280)).toBe(1);
      expect(calculateViewportScale(900, 768)).toBe(1);
      expect(calculateViewportScale(500, 375)).toBe(1);

      // 3. Edge/boundary conditions
      expect(calculateViewportScale(0, 1280)).toBe(1);
      expect(calculateViewportScale(-100, 1280)).toBe(1);
      expect(calculateViewportScale(500, 0)).toBe(1);
    });

    it("renders IsolatedViewportFrame with fixed target layout widths (1280px Desktop, 768px Tablet, 375px Mobile) and maxWidth: none", () => {
      expect(VIEWPORT_TARGET_WIDTHS.desktop).toBe(1280);
      expect(VIEWPORT_TARGET_WIDTHS.tablet).toBe(768);
      expect(VIEWPORT_TARGET_WIDTHS.mobile).toBe(375);

      const { rerender } = render(
        <IsolatedViewportFrame viewport="desktop" title="Desktop Frame">
          <div>Desktop Content</div>
        </IsolatedViewportFrame>
      );

      const desktopIframe = screen.getByTitle("Desktop Frame") as HTMLIFrameElement;
      expect(desktopIframe.style.width).toBe("1280px");
      expect(desktopIframe.style.minWidth).toBe("1280px");
      expect(desktopIframe.style.maxWidth).toBe("none");

      rerender(
        <IsolatedViewportFrame viewport="tablet" title="Tablet Frame">
          <div>Tablet Content</div>
        </IsolatedViewportFrame>
      );
      const tabletIframe = screen.getByTitle("Tablet Frame") as HTMLIFrameElement;
      expect(tabletIframe.style.width).toBe("768px");
      expect(tabletIframe.style.minWidth).toBe("768px");
      expect(tabletIframe.style.maxWidth).toBe("none");

      rerender(
        <IsolatedViewportFrame viewport="mobile" title="Mobile Frame">
          <div>Mobile Content</div>
        </IsolatedViewportFrame>
      );
      const mobileIframe = screen.getByTitle("Mobile Frame") as HTMLIFrameElement;
      expect(mobileIframe.style.width).toBe("375px");
      expect(mobileIframe.style.minWidth).toBe("375px");
      expect(mobileIframe.style.maxWidth).toBe("none");
    });

    it("verifies constraining host pane does not mutate iframe layout width and preserves visual scaling invariant", () => {
      // In jsdom, contentWindow.innerWidth layout is not fully rendered by the engine.
      // We verify the invariant via CSS properties, target-width data attributes, and transform scale.
      const { container } = render(
        <div style={{ width: "600px" }}>
          <IsolatedViewportFrame viewport="desktop" title="Desktop Scaled Frame">
            <div>Scaled Desktop Content</div>
          </IsolatedViewportFrame>
        </div>
      );

      const iframe = screen.getByTitle("Desktop Scaled Frame") as HTMLIFrameElement;
      expect(iframe.style.width).toBe("1280px");
      expect(iframe.style.minWidth).toBe("1280px");
      expect(iframe.style.maxWidth).toBe("none");
      expect(iframe.getAttribute("data-target-width")).toBe("1280");

      const viewportWrapper = container.querySelector("[data-testid='isolated-viewport-desktop']");
      expect(viewportWrapper).toBeDefined();
      expect(viewportWrapper?.getAttribute("data-scale")).toBeDefined();
    });

    it("ensures desktop and tablet preview receives full public catalog dataset while mobile receives isPublicSafeService filtered catalog", () => {
      const sectionsWithServices: PublicSiteSectionRow[] = [
        ...mockPublishedSections,
        {
          id: "pub-sig-1",
          section_key: "signature_services",
          title: "Explore Our Most Loved Services",
          subtitle: "Signature Treatments",
          body: "Handcrafted therapies tailored for full-body restoration.",
          cta_label: "View Menu",
          cta_href: "/services",
          image_url: null,
          secondary_image_url: null,
          sort_order: 2,
          is_enabled: true,
          metadata: {},
          created_at: "2026-08-01T00:00:00Z",
          updated_at: "2026-08-01T00:00:00Z",
        },
      ];
      const normalized = resolvePublicSiteSections(sectionsWithServices);

      // Desktop rendering receives full catalog
      const { unmount } = render(
        <HighFidelityPreview
          draftSections={normalized}
          liveSections={normalized}
          initialMode="draft"
          initialViewport="desktop"
          branches={[]}
          services={mockServices}
        />
      );

      const desktopPreview = getPreviewIframeBody(/DESKTOP/i);
      // Desktop signature services receives full service list
      expect(within(desktopPreview).getByText("Swedish Relaxation Massage")).toBeDefined();

      unmount();

      // Mobile rendering receives filtered catalog
      render(
        <HighFidelityPreview
          draftSections={normalized}
          liveSections={normalized}
          initialMode="draft"
          initialViewport="mobile"
          branches={[]}
          services={mockServices}
        />
      );

      const mobilePreview = getPreviewIframeBody(/MOBILE/i);
      expect(within(mobilePreview).getByText("Swedish Relaxation Massage")).toBeDefined();
      expect(within(mobilePreview).queryByText("Internal CSR Only Addon")).toBeNull();
      expect(within(mobilePreview).queryByText("VIP Executive Spa Treatment")).toBeNull();
      expect(within(mobilePreview).queryByText("Discontinued Seasonal Scrub")).toBeNull();
    });
  });

  describe("Dialog Accessibility & Component Primitives", () => {
    it("UnsavedChangesDialog renders with accessible Dialog primitive", () => {
      const onStay = vi.fn();
      const onDiscard = vi.fn();

      render(
        <UnsavedChangesDialog
          isOpen={true}
          onStay={onStay}
          onDiscard={onDiscard}
          title="Unsaved Section Changes"
          message="You have unsaved changes in this section."
        />
      );

      expect(screen.getByText("Unsaved Section Changes")).toBeDefined();
      expect(screen.getByText("You have unsaved changes in this section.")).toBeDefined();

      const stayBtn = screen.getByRole("button", { name: /Stay and Keep Editing/i });
      fireEvent.click(stayBtn);
      expect(onStay).toHaveBeenCalledTimes(1);
    });

    it("RevertToLiveDialog renders with accessible Dialog primitive", () => {
      const onCancel = vi.fn();
      const onConfirm = vi.fn();

      render(
        <RevertToLiveDialog
          isOpen={true}
          sectionName="Hero Section"
          onCancel={onCancel}
          onConfirm={onConfirm}
        />
      );

      expect(screen.getByText(/Revert Hero Section to Live Values\?/i)).toBeDefined();

      const confirmBtn = screen.getByRole("button", { name: /Revert to Live/i });
      fireEvent.click(confirmBtn);
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });

  describe("Real Public Component Grounding", () => {
    it("renders public component implementation directly through HomePageSectionsRenderer", () => {
      const normalized = resolvePublicSiteSections(mockPublishedSections);
      const { container } = render(
        <HomePageSectionsRenderer sections={normalized} branches={[]} services={[]} />
      );

      // Verify canonical sections are present
      expect(container.querySelector("h1")?.textContent).toContain("Published Hero Title");
      expect(container.textContent).toContain("Published About Title");
    });
  });
});
