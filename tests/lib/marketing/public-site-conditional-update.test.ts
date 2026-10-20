import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/dev-bypass", () => ({ isDevAuthBypassEnabled: () => true }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

let currentClient: unknown;
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => currentClient }));

import { updatePublicSiteSection } from "@/lib/queries/public-site";

describe("Website Images conditional section publication", () => {
  const baseline = "2026-10-19T01:00:00.000Z";
  const section = { sectionKey: "hero", imageUrl: "/images/new-hero.jpg", metadata: {} };

  beforeEach(() => {
    currentClient = null;
  });

  it("uses section key and updated timestamp as atomic update conditions", async () => {
    const query = {
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const update = vi.fn().mockReturnValue(query);
    currentClient = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner" } } }) },
      from: vi.fn().mockReturnValue({ update }),
    };

    const result = await updatePublicSiteSection(section, { expectedUpdatedAt: baseline });

    expect(update).toHaveBeenCalledOnce();
    expect(query.eq).toHaveBeenCalledWith("section_key", "hero");
    expect(query.eq).toHaveBeenCalledWith("updated_at", baseline);
    expect(result).toEqual({
      success: false,
      error: "The live section changed before publishing. Review the latest section.",
    });
  });

  it("uses a unique insert when the draft began without a published row", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { code: "23505" } }),
    };
    const insert = vi.fn().mockReturnValue(query);
    currentClient = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner" } } }) },
      from: vi.fn().mockReturnValue({ insert }),
    };

    const result = await updatePublicSiteSection(section, { expectedUpdatedAt: null });

    expect(insert).toHaveBeenCalledOnce();
    expect(result.success).toBe(false);
    expect(result).toHaveProperty("error", expect.stringMatching(/live section changed/i));
  });
});
