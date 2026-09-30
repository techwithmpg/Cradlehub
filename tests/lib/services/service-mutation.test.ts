import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: async () => ({ data: [{ branch_id: "branch-1" }] }),
      }),
    }),
  }),
}));

import { revalidatePath, revalidateTag } from "next/cache";
import { parseServicePrice, writeCanonicalService } from "@/lib/services/service-mutation";

describe("canonical service mutation", () => {
  it("publishes price, image and copy while preserving operational metadata and expiring booking caches", async () => {
    let payload: Record<string, unknown> | null = null;
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({ single: async () => ({ data: { metadata: { booking_rule: "keep", price_label: "₱900" } }, error: null }) }),
        }),
        update: (value: Record<string, unknown>) => {
          payload = value;
          return { eq: () => ({ select: () => ({ maybeSingle: async () => ({ data: { id: "service-1" }, error: null }) }) }) };
        },
      }),
    };
    const result = await writeCanonicalService(supabase as never, "service-1", { price: 1200 }, {
      description: "New description",
      imageUrl: "/service.webp",
      imageAlt: "Therapist providing treatment",
      shortDescription: "New summary",
      badges: ["Popular"],
      inclusions: ["Oil"],
    });
    expect(result.success).toBe(true);
    expect(payload).toEqual({
      price: 1200,
      description: "New description",
      image_url: "/service.webp",
      image_alt: "Therapist providing treatment",
      metadata: {
        booking_rule: "keep",
        public_short_description: "New summary",
        service_badges: ["Popular"],
        inclusions: ["Oil"],
      },
    });
    expect(revalidateTag).toHaveBeenCalledWith("branch-services:branch-1", { expire: 0 });
    expect(revalidateTag).toHaveBeenCalledWith("service-catalog", { expire: 0 });
    expect(revalidatePath).toHaveBeenCalledWith("/services");
    expect(revalidatePath).toHaveBeenCalledWith("/book");
  });

  it("rejects invalid price inputs", () => {
    expect(parseServicePrice("1200.50")).toBe(1200.5);
    expect(parseServicePrice("1200.999")).toBeNull();
    expect(parseServicePrice("-1")).toBeNull();
    expect(parseServicePrice("")).toBeNull();
  });
});
