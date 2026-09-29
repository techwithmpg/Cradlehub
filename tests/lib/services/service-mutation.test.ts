import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/cache/cache-tags", () => ({
  cacheTags: { serviceCatalog: "service-catalog" },
  invalidateTag: vi.fn(),
  invalidateCrmWorkspace: vi.fn(),
  invalidateManagerWorkspace: vi.fn(),
}));

import { updateCanonicalService } from "@/lib/services/service-mutation";

const serviceId = "33333333-3333-4333-8333-333333333333";

function serviceClient(options: { noUpdatedRow?: boolean } = {}) {
  let payload: Record<string, unknown> | undefined;
  const client = {
    from: vi.fn((table: string) => {
      if (table === "branch_services") {
        return { select: () => ({ eq: async () => ({ data: [], error: null }) }) };
      }
      if (table !== "services") throw new Error(`Unexpected table: ${table}`);
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({
            data: { metadata: { internal_code: "KEEP", public_short_description: "Old" } },
            error: null,
          }) }),
        }),
        update: (value: Record<string, unknown>) => {
          payload = value;
          return { eq: () => ({ select: () => ({ maybeSingle: async () => ({
            data: options.noUpdatedRow ? null : { id: serviceId },
            error: null,
          }) }) }) };
        },
      };
    }),
  };
  return { client, getPayload: () => payload };
}

describe("canonical service mutation", () => {
  it("updates presentation and image fields on the existing ID while preserving unrelated metadata", async () => {
    const { client, getPayload } = serviceClient();
    const result = await updateCanonicalService(client as never, {
      serviceId,
      description: "Revised treatment",
      imageUrl: "https://example.com/service.webp",
      imageAlt: "Therapist at work",
      shortDescription: "Revised",
      badges: ["Popular"],
      inclusions: ["Towels"],
    });

    expect(result.success).toBe(true);
    expect(getPayload()).toEqual({
      description: "Revised treatment",
      image_url: "https://example.com/service.webp",
      image_alt: "Therapist at work",
      metadata: {
        internal_code: "KEEP",
        public_short_description: "Revised",
        service_badges: ["Popular"],
        inclusions: ["Towels"],
      },
    });
    expect(client.from).toHaveBeenCalledWith("services");
  });

  it("updates Owner catalog fields without replacing presentation metadata", async () => {
    const { client, getPayload } = serviceClient();
    const result = await updateCanonicalService(client as never, {
      serviceId,
      name: "Revised service",
      durationMinutes: 60,
      price: 850,
    });
    expect(result.success).toBe(true);
    expect(getPayload()).toEqual({ name: "Revised service", duration_minutes: 60, price: 850 });
  });

  it("reports an update rejected by RLS or a missing row as a failure", async () => {
    const { client } = serviceClient({ noUpdatedRow: true });
    expect(await updateCanonicalService(client as never, { serviceId, description: "New" }))
      .toEqual({ success: false, error: "Service update was not permitted." });
  });

  it("rejects invalid IDs before touching the database", async () => {
    const { client } = serviceClient();
    const result = await updateCanonicalService(client as never, { serviceId: "not-an-id" });
    expect(result.success).toBe(false);
    expect(client.from).not.toHaveBeenCalled();
  });
});
