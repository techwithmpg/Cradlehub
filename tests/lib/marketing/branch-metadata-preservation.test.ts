import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockUpdateBranchAction = vi.fn();
vi.mock("@/app/(dashboard)/owner/branches/actions", () => ({
  updateBranchAction: (...args: unknown[]) => mockUpdateBranchAction(...args),
}));

const mockGetMarketingAccessContext = vi.fn();
vi.mock("@/lib/queries/marketing-content", () => ({
  getMarketingAccessContext: () => mockGetMarketingAccessContext(),
}));

import { updateBranchPresentationAction } from "@/app/(dashboard)/marketing/branch-actions";

describe("Branch Metadata Preservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves existing unknown and operational keys in location_metadata when updating image", async () => {
    const existingMetadata = {
      operational_key: "OP_BRANCH_101",
      coordinates: { lat: 10.6765, lng: 122.951 },
      custom_notes: "Near north wing elevator",
      image_url: "https://example.com/old-image.jpg",
    };

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { location_metadata: existingMetadata },
          error: null,
        }),
      }),
    });

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: mockSelect,
      }),
    };

    mockGetMarketingAccessContext.mockResolvedValue({
      role: "owner",
      staffId: "owner-1",
      supabase: mockSupabase,
    });

    mockUpdateBranchAction.mockResolvedValue({ success: true });

    const formData = new FormData();
    formData.append("branchId", "branch-uuid-1");
    formData.append("name", "Bacolod Flagship");
    formData.append("address", "Lacson St");
    formData.append("imageUrl", "https://example.com/new-image.jpg");

    const result = await updateBranchPresentationAction({ success: true }, formData);

    expect(result.success).toBe(true);
    expect(mockUpdateBranchAction).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId: "branch-uuid-1",
        name: "Bacolod Flagship",
        locationMetadata: {
          operational_key: "OP_BRANCH_101",
          coordinates: { lat: 10.6765, lng: 122.951 },
          custom_notes: "Near north wing elevator",
          image_url: "https://example.com/new-image.jpg",
        },
      })
    );
  });

  it("rejects non-owner direct updates", async () => {
    mockGetMarketingAccessContext.mockResolvedValue({
      role: "digital_marketer",
      staffId: "marketer-1",
    });

    const formData = new FormData();
    formData.append("branchId", "branch-uuid-1");
    formData.append("imageUrl", "https://example.com/new-image.jpg");

    const result = await updateBranchPresentationAction({ success: true }, formData);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Only owners can publish live branch updates directly");
    expect(mockUpdateBranchAction).not.toHaveBeenCalled();
  });

  it("fails closed when existing branch metadata cannot be read and performs zero updates", async () => {
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Database read timeout or connection failed" },
        }),
      }),
    });

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: mockSelect,
      }),
    };

    mockGetMarketingAccessContext.mockResolvedValue({
      role: "owner",
      staffId: "owner-1",
      supabase: mockSupabase,
    });

    const formData = new FormData();
    formData.append("branchId", "branch-uuid-fail");
    formData.append("name", "Bacolod Flagship");
    formData.append("imageUrl", "https://example.com/new-image.jpg");

    const result = await updateBranchPresentationAction({ success: true }, formData);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Failed to read existing branch metadata");
    expect(mockUpdateBranchAction).not.toHaveBeenCalled();
  });
});
