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
  default: ({ src, alt, ...props }: { src: string; alt: string; [key: string]: unknown }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...props} />
  ),
}));

import { WebsiteStudioView } from "@/components/features/marketing/website/website-studio-view";
import {
  LinkPicker,
  isValidExternalUrl,
} from "@/components/features/marketing/website/link-picker";
import { PUBLIC_SITE_SECTION_DEFAULTS } from "@/lib/marketing/public-section-defaults";
import type { MarketingContentDraftRow } from "@/lib/queries/marketing-content";
import type { PublicSiteSectionRow } from "@/lib/queries/public-site";

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
      expect(screen.getByText("The Cradle Experience")).toBeDefined();
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

      // Verify that the High-Fidelity Preview rail reflects the in-memory update
      const previewHeading = screen.getByRole("heading", { name: "Live In-Memory Edited Hero" });
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
      expect(screen.getByRole("heading", { name: "Published Hero Title" })).toBeDefined();
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

      // Verify Mobile hero renders the updated draft headline
      expect(
        screen.getAllByText(/Draft Hero Headline - Unsaved State Check/i).length
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
      const dialogConfirmBtn = screen.getAllByRole("button", { name: /Revert to Live/i })[1]!;
      fireEvent.click(dialogConfirmBtn);

      // Verify form state was reset to published values
      const titleInput = screen.getByLabelText(/Main Title \/ Headline/i) as HTMLInputElement;
      expect(titleInput.value).toBe("Published Hero Title");
    });
  });
});
