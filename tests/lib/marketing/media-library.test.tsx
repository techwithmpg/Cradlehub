/**
 * @vitest-environment jsdom
 */

import { describe, expect, it, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

vi.mock("server-only", () => ({}));
vi.mock("@/app/(dashboard)/marketing/media/actions", () => ({
  uploadMediaFileAction: vi.fn().mockResolvedValue({ success: true }),
  saveMediaMetadataAction: vi.fn().mockResolvedValue({ success: true }),
  submitMediaForReviewAction: vi.fn().mockResolvedValue({ success: true }),
  approveMediaAssetAction: vi.fn().mockResolvedValue({ success: true }),
  publishMediaAssetAction: vi.fn().mockResolvedValue({ success: true }),
  archiveMediaAssetAction: vi.fn().mockResolvedValue({ success: true }),
}));

import {
  marketingMediaAssetInputSchema,
  marketingMediaStatusUpdateSchema,
  marketingMediaArchiveSchema,
} from "@/lib/validations/marketing";
import { UniversalMediaPicker } from "@/components/features/marketing/media/universal-media-picker";
import { MediaLibraryView } from "@/components/features/marketing/media/media-library-view";
import type { MarketingMediaAssetRow } from "@/lib/queries/marketing-media";
import type { MediaAssetUsageSummary } from "@/lib/marketing/media-usage-analyzer";

// Mock next/image for clean DOM testing
vi.mock("next/image", () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string; [key: string]: unknown }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...props} />
  ),
}));

const mockAssets: MarketingMediaAssetRow[] = [
  {
    id: "e4b6c310-8b1e-450f-90bf-c94d2fa8e711",
    bucket_path: "media/1725170000-hero-spa.jpg",
    public_url: "https://example.com/media/1725170000-hero-spa.jpg",
    title: "Cradle Sanctuary Hero",
    alt_text: "Serene spa environment with warm lighting",
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
  {
    id: "f5c7d420-9c2f-4610-a1cf-d05e3ab9f822",
    bucket_path: "media/1725170001-facial-treatment.jpg",
    public_url: "https://example.com/media/1725170001-facial-treatment.jpg",
    title: "Facial Treatment Ritual",
    alt_text: "Client receiving rejuvenating facial therapy",
    section_key: "about",
    content_key: null,
    status: "draft",
    metadata: { sizeBytes: 320000, mimeType: "image/jpeg" },
    created_by: "staff-2",
    updated_by: "staff-2",
    reviewed_by: null,
    reviewed_at: null,
    created_at: "2026-09-01T01:00:00Z",
    updated_at: "2026-09-01T01:00:00Z",
  },
  {
    id: "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
    bucket_path: "media/1725170002-old-promo.jpg",
    public_url: "https://example.com/media/1725170002-old-promo.jpg",
    title: "Old Promotional Banner",
    alt_text: "Historical promotion asset",
    section_key: "hero",
    content_key: null,
    status: "archived",
    metadata: { sizeBytes: 150000, mimeType: "image/jpeg" },
    created_by: "staff-1",
    updated_by: "staff-1",
    reviewed_by: "owner-1",
    reviewed_at: "2026-09-01T00:00:00Z",
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
  },
];

describe("marketing media validation schemas", () => {
  it("enforces alt text minimum 3 characters and valid bucket path", () => {
    const valid = marketingMediaAssetInputSchema.safeParse({
      bucketPath: "media/123-valid-path.jpg",
      publicUrl: "https://example.com/test.jpg",
      altText: "Valid descriptive alt text",
      title: "Valid Title",
      metadata: {},
    });
    expect(valid.success).toBe(true);

    const tooShortAlt = marketingMediaAssetInputSchema.safeParse({
      bucketPath: "media/123-valid-path.jpg",
      altText: "ab", // Less than 3 chars
    });
    expect(tooShortAlt.success).toBe(false);
    expect(tooShortAlt.error?.issues[0]?.message).toContain("at least 3 characters");

    const invalidPath = marketingMediaAssetInputSchema.safeParse({
      bucketPath: "INVALID PATH WITH SPACES!",
      altText: "Valid alt text",
    });
    expect(invalidPath.success).toBe(false);
  });

  it("validates canonical media lifecycle statuses", () => {
    const validStatuses = ["draft", "submitted", "approved", "published", "archived"];
    for (const status of validStatuses) {
      const parsed = marketingMediaStatusUpdateSchema.safeParse({
        id: "e4b6c310-8b1e-450f-90bf-c94d2fa8e711",
        status,
      });
      expect(parsed.success).toBe(true);
    }

    const invalid = marketingMediaStatusUpdateSchema.safeParse({
      id: "e4b6c310-8b1e-450f-90bf-c94d2fa8e711",
      status: "invented_active_status",
    });
    expect(invalid.success).toBe(false);
  });

  it("validates media archive schema with UUID", () => {
    const valid = marketingMediaArchiveSchema.safeParse({
      id: "e4b6c310-8b1e-450f-90bf-c94d2fa8e711",
      reviewNote: "Superseded by 2026 autumn hero asset",
    });
    expect(valid.success).toBe(true);
  });
});

describe("UniversalMediaPicker component", () => {
  it("renders when isOpen is true and displays active media assets with alt text", () => {
    const handleClose = vi.fn();
    const handleSelect = vi.fn();

    render(
      <UniversalMediaPicker
        isOpen={true}
        onClose={handleClose}
        onSelect={handleSelect}
        availableAssets={mockAssets}
      />
    );

    expect(screen.getByText("Select Media Asset")).toBeDefined();
    expect(screen.getAllByText("Cradle Sanctuary Hero").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Facial Treatment Ritual").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Serene spa environment with warm lighting")).toBeDefined();
  });

  it("allows selecting an active asset and confirming selection", () => {
    const handleClose = vi.fn();
    const handleSelect = vi.fn();

    render(
      <UniversalMediaPicker
        isOpen={true}
        onClose={handleClose}
        onSelect={handleSelect}
        availableAssets={mockAssets}
      />
    );

    // Click first asset
    const firstAsset = screen.getAllByText("Cradle Sanctuary Hero")[0];
    if (firstAsset) {
      fireEvent.click(firstAsset);
    }

    // Confirm selection
    const selectButton = screen.getByRole("button", { name: "Select Image" });
    expect(selectButton).toBeDefined();
    fireEvent.click(selectButton);

    const asset0 = mockAssets[0]!;
    expect(handleSelect).toHaveBeenCalledWith({
      id: asset0.id,
      publicUrl: asset0.public_url,
      altText: asset0.alt_text,
      title: asset0.title,
    });
    expect(handleClose).toHaveBeenCalled();
  });

  it("blocks selection of archived assets", () => {
    const handleClose = vi.fn();
    const handleSelect = vi.fn();

    render(
      <UniversalMediaPicker
        isOpen={true}
        onClose={handleClose}
        onSelect={handleSelect}
        availableAssets={mockAssets}
      />
    );

    // Archived asset button should be disabled
    const archivedCards = screen.getAllByTitle("Archived asset cannot be selected");
    expect(archivedCards.length).toBeGreaterThanOrEqual(1);
    expect(archivedCards[0]?.getAttribute("disabled")).not.toBeNull();

    // Confirm button should remain disabled
    const selectButton = screen.getByRole("button", { name: "Select Image" });
    expect(selectButton.getAttribute("disabled")).not.toBeNull();

    fireEvent.click(selectButton);
    expect(handleSelect).not.toHaveBeenCalled();
  });

  it("closes on cancel without calling onSelect", () => {
    const handleClose = vi.fn();
    const handleSelect = vi.fn();

    render(
      <UniversalMediaPicker
        isOpen={true}
        onClose={handleClose}
        onSelect={handleSelect}
        availableAssets={mockAssets}
      />
    );

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelButton);

    expect(handleClose).toHaveBeenCalled();
    expect(handleSelect).not.toHaveBeenCalled();
  });

  it("closes on Escape key press", () => {
    const handleClose = vi.fn();

    render(
      <UniversalMediaPicker
        isOpen={true}
        onClose={handleClose}
        onSelect={vi.fn()}
        availableAssets={mockAssets}
      />
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalled();
  });

  it("filters assets by search keyword", () => {
    render(
      <UniversalMediaPicker
        isOpen={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        availableAssets={mockAssets}
      />
    );

    const searchInput = screen.getByPlaceholderText("Search by title, alt text, path...");
    fireEvent.change(searchInput, { target: { value: "Facial" } });

    expect(screen.getAllByText("Facial Treatment Ritual").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Cradle Sanctuary Hero")).toBeNull();
  });

  it("contains NO delete or hard-removal controls", () => {
    render(
      <UniversalMediaPicker
        isOpen={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        availableAssets={mockAssets}
      />
    );

    expect(screen.queryByText(/delete/i)).toBeNull();
    expect(screen.queryByText(/destroy/i)).toBeNull();
    expect(screen.queryByText(/hard remove/i)).toBeNull();
  });
});

describe("MediaLibraryView component", () => {
  it("renders asset grid with canonical status pills and live use count", () => {
    const asset0 = mockAssets[0]!;
    const usageMap: Record<string, MediaAssetUsageSummary> = {
      [asset0.id]: {
        assetId: asset0.id,
        publicUrl: asset0.public_url,
        bucketPath: asset0.bucket_path,
        usages: [
          {
            consumerType: "public_section",
            entityId: "sec-hero",
            entityKey: "hero",
            field: "image_url",
            label: "Section: Hero",
            isLive: true,
          },
        ],
        totalLiveUsages: 1,
        totalDraftUsages: 0,
        canSafelyArchive: false,
        blockingReasons: ["Referenced by 1 live consumer"],
        usageUnknown: false,
      },
    };

    render(
      <MediaLibraryView initialAssets={mockAssets} initialUsageMap={usageMap} userRole="owner" />
    );

    expect(screen.getAllByText("Cradle Sanctuary Hero").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Facial Treatment Ritual").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("published").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("draft").length).toBeGreaterThanOrEqual(1);
  });

  it("opens asset inspector on card click with details and usage", () => {
    const asset0 = mockAssets[0]!;
    const usageMap: Record<string, MediaAssetUsageSummary> = {
      [asset0.id]: {
        assetId: asset0.id,
        publicUrl: asset0.public_url,
        bucketPath: asset0.bucket_path,
        usages: [
          {
            consumerType: "public_section",
            entityId: "sec-hero",
            entityKey: "hero",
            field: "image_url",
            label: "Section: Hero",
            context: "Primary Image",
            isLive: true,
          },
        ],
        totalLiveUsages: 1,
        totalDraftUsages: 0,
        canSafelyArchive: false,
        blockingReasons: ["Referenced by 1 live consumer"],
        usageUnknown: false,
      },
    };

    render(
      <MediaLibraryView initialAssets={mockAssets} initialUsageMap={usageMap} userRole="owner" />
    );

    const firstCard = screen.getAllByText("Cradle Sanctuary Hero")[0];
    if (firstCard) {
      fireEvent.click(firstCard);
    }

    expect(screen.getByText("Asset Inspector")).toBeDefined();
    expect(screen.getByText("Section: Hero")).toBeDefined();
    expect(screen.getByText("Live")).toBeDefined();
    expect(screen.getByText(/Cannot archive: referenced by 1 live consumer/)).toBeDefined();
  });

  it("displays explicit 'Usage incomplete / archive cannot be finalized' when usage coverage is unknown", () => {
    const asset0 = mockAssets[0]!;
    const usageMap: Record<string, MediaAssetUsageSummary> = {
      [asset0.id]: {
        assetId: asset0.id,
        publicUrl: asset0.public_url,
        bucketPath: asset0.bucket_path,
        usages: [],
        totalLiveUsages: 0,
        totalDraftUsages: 0,
        canSafelyArchive: false,
        blockingReasons: ["Usage coverage incomplete: unable to verify marketing_brand_settings"],
        usageUnknown: true,
      },
    };

    render(
      <MediaLibraryView initialAssets={mockAssets} initialUsageMap={usageMap} userRole="owner" />
    );

    const firstCard = screen.getAllByText("Cradle Sanctuary Hero")[0];
    if (firstCard) {
      fireEvent.click(firstCard);
    }

    expect(
      screen.getAllByText("Usage incomplete / archive cannot be finalized").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("contains ZERO hard delete controls anywhere in the view or inspector", () => {
    render(<MediaLibraryView initialAssets={mockAssets} initialUsageMap={{}} userRole="owner" />);

    expect(screen.queryByText(/delete/i)).toBeNull();
    expect(screen.queryByText(/destroy/i)).toBeNull();
    expect(screen.queryByText(/hard remove/i)).toBeNull();
  });
});
