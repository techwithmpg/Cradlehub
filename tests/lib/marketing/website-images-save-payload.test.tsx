/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { PublicSiteSectionRow } from "@/lib/queries/public-site";
import type { MarketingContentDraftRow } from "@/lib/queries/marketing-content";

const { saveDraft } = vi.hoisted(() => ({ saveDraft: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));
vi.mock("@/app/(dashboard)/marketing/actions", () => ({
  saveMarketingDraftAction: async (_state: unknown, formData: FormData) => {
    saveDraft(formData);
    return { success: true, message: "Saved" };
  },
  submitMarketingDraftAction: async () => ({ success: false, error: "Submission denied" }),
}));
vi.mock("@/app/(dashboard)/owner/marketing/actions", () => ({
  approveMarketingDraftAction: vi.fn(),
  archiveMarketingDraftAction: vi.fn(),
  publishMarketingDraftAction: vi.fn(),
}));
vi.mock("@/components/features/marketing/media/universal-media-picker", () => ({
  UniversalMediaPicker: ({ onSelect }: { onSelect: (value: object) => void }) => (
    <button
      type="button"
      onClick={() =>
        onSelect({
          publicUrl: "/images/replacement.webp",
          altText: "Replacement image",
          title: "Replacement",
        })
      }
    >
      Select replacement
    </button>
  ),
}));

import { WebsiteImagesView } from "@/components/features/marketing/website/website-images-view";

function publishedSection(
  sectionKey: string,
  overrides: Partial<PublicSiteSectionRow> = {}
): PublicSiteSectionRow {
  return {
    id: `published-${sectionKey}`,
    section_key: sectionKey,
    title: "Published title",
    subtitle: "Published subtitle",
    body: "",
    cta_label: "",
    cta_href: "",
    image_url: "/images/desktop.webp",
    secondary_image_url: "/images/portrait.webp",
    sort_order: 10,
    is_enabled: true,
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as PublicSiteSectionRow;
}

async function selectAndSave(search: string) {
  fireEvent.change(screen.getByPlaceholderText("Search by placement, label, page, or slot ID..."), {
    target: { value: search },
  });
  fireEvent.click(screen.getByRole("button", { name: "Change Picture" }));
  fireEvent.click(screen.getByRole("button", { name: "Select replacement" }));
  fireEvent.click(screen.getByRole("button", { name: "Save Draft" }));
  await waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(1));
  return saveDraft.mock.calls[0]![0] as FormData;
}

describe("Website Images draft payload", () => {
  beforeEach(() => saveDraft.mockClear());
  afterEach(cleanup);

  it("saves the mobile hero in metadata without replacing the portrait image", async () => {
    const hero = publishedSection("hero");
    render(<WebsiteImagesView role="owner" publishedSections={[hero]} drafts={[]} />);

    const formData = await selectAndSave("Hero Mobile Slide 1");
    const metadata = JSON.parse(String(formData.get("metadataJson")));

    expect(formData.get("imageUrl")).toBe("/images/desktop.webp");
    expect(formData.get("secondaryImageUrl")).toBe("/images/portrait.webp");
    expect(metadata.mobileImageUrl).toBe("/images/replacement.webp");
    expect(metadata.mobileImageAltText).toBe("Replacement image");
    expect(metadata.websiteImagesBaseUpdatedAt).toBe(hero.updated_at);
  });

  it("starts a new managed-slot draft without copying live or closed-draft slots", async () => {
    const closedDraft = {
      id: "77777777-7777-4777-8777-777777777777",
      content_type: "section",
      content_key: "site_images",
      status: "published",
      metadata: { slots: { home_hero_mobile_slide_2: "/images/old.webp" } },
    } as unknown as MarketingContentDraftRow;
    render(
      <WebsiteImagesView
        role="digital_marketer"
        publishedSections={[
          publishedSection("site_images", {
            metadata: { slots: { home_setting_home_service: "/images/live.webp" } },
          }),
        ]}
        drafts={[closedDraft]}
      />
    );

    const formData = await selectAndSave("Hero Mobile Slide 2");
    const metadata = JSON.parse(String(formData.get("metadataJson")));

    expect(formData.get("id")).toBe("");
    expect(metadata.slots).toEqual({
      home_hero_mobile_slide_2: "/images/replacement.webp",
    });
  });

  it("preserves untouched legacy hero images in a new mobile draft", async () => {
    render(
      <WebsiteImagesView
        role="owner"
        publishedSections={[
          publishedSection("hero", {
            image_url: "https://cdn.example.com/old-desktop.jpg",
            secondary_image_url: "https://cdn.example.com/old-portrait.jpg",
            metadata: { mobileImageUrl: "https://cdn.example.com/old-mobile.jpg" },
          }),
        ]}
        drafts={[]}
      />
    );

    const formData = await selectAndSave("Hero Mobile Slide 1");
    expect(formData.get("imageUrl")).toBe("https://cdn.example.com/old-desktop.jpg");
    expect(formData.get("secondaryImageUrl")).toBe("https://cdn.example.com/old-portrait.jpg");
    expect(JSON.parse(String(formData.get("metadataJson"))).mobileImageUrl).toBe(
      "/images/replacement.webp"
    );
  });

  it("preserves untouched category entries when saving another cover", async () => {
    render(
      <WebsiteImagesView
        role="owner"
        publishedSections={[
          publishedSection("signature_services", {
            metadata: {
              categoryImages: {
                "Massage Services": "/images/current-massage.jpg",
                "Salon Services": "https://cdn.example.com/old-salon.jpg",
                "Unknown Category": "/images/unknown.jpg",
              },
            },
          }),
        ]}
        drafts={[]}
      />
    );

    const formData = await selectAndSave("Category Cover: Skin Care Services");
    expect(JSON.parse(String(formData.get("metadataJson"))).categoryImages).toEqual({
      "Massage Services": "/images/current-massage.jpg",
      "Salon Services": "https://cdn.example.com/old-salon.jpg",
      "Unknown Category": "/images/unknown.jpg",
      "Skin Care Services": "/images/replacement.webp",
    });
  });

  it("does not convert an existing Website Studio section draft into an image snapshot", () => {
    const draft = {
      id: "77777777-7777-4777-8777-777777777777",
      content_type: "section",
      content_key: "hero",
      status: "draft",
      metadata: {},
    } as unknown as MarketingContentDraftRow;
    render(
      <WebsiteImagesView
        role="owner"
        publishedSections={[publishedSection("hero")]}
        drafts={[draft]}
      />
    );

    fireEvent.change(
      screen.getByPlaceholderText("Search by placement, label, page, or slot ID..."),
      {
        target: { value: "Hero Mobile Slide 1" },
      }
    );
    fireEvent.click(screen.getByRole("button", { name: "Change Picture" }));
    fireEvent.click(screen.getByRole("button", { name: "Select replacement" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Draft" }));

    expect(screen.getByText(/already has a draft from Website Studio/i)).toBeDefined();
    expect(saveDraft).not.toHaveBeenCalled();
  });

  it("shows a later submission error instead of the earlier save success", async () => {
    const draft = {
      id: "77777777-7777-4777-8777-777777777777",
      content_type: "section",
      content_key: "site_images",
      status: "draft",
      metadata: { slots: { home_setting_in_spa: "/images/spa/current.webp" } },
    } as unknown as MarketingContentDraftRow;
    render(<WebsiteImagesView role="digital_marketer" publishedSections={[]} drafts={[draft]} />);

    await selectAndSave("Setting Card: In-Spa Experience");
    await waitFor(() => expect(screen.getByRole("button", { name: "Submit" })).toBeDefined());
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(screen.getByText("Submission denied")).toBeDefined());
    expect(screen.queryByText("Saved")).toBeNull();
  });
});
