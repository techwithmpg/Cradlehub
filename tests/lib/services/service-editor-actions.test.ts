import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => {
  const updateCanonicalService = vi.fn();
  const getMarketingAccessContext = vi.fn();
  const getUser = vi.fn();
  const getStaff = vi.fn();
  const client = {
    auth: { getUser },
    from: vi.fn(() => ({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: getStaff }) }) }),
    })),
  };
  return { updateCanonicalService, getMarketingAccessContext, getUser, getStaff, client };
});
const { updateCanonicalService, getMarketingAccessContext, getUser, getStaff, client } = mocks;

vi.mock("@/lib/services/service-mutation", () => ({ updateCanonicalService: mocks.updateCanonicalService }));
vi.mock("@/lib/queries/marketing-content", () => ({ getMarketingAccessContext: mocks.getMarketingAccessContext }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => mocks.client }));
vi.mock("@/lib/dev-bypass", () => ({ isDevAuthBypassEnabled: () => false }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

import { updateServiceAction } from "@/app/(dashboard)/owner/services/actions";
import { updateServicePresentationAction } from "@/app/(dashboard)/marketing/service-actions";

const serviceId = "33333333-3333-4333-8333-333333333333";
const categoryId = "44444444-4444-4444-8444-444444444444";

beforeEach(() => {
  vi.clearAllMocks();
  updateCanonicalService.mockResolvedValue({ success: true });
  getUser.mockResolvedValue({ data: { user: { id: "owner-user" } } });
  getStaff.mockResolvedValue({ data: { system_role: "owner" } });
  getMarketingAccessContext.mockResolvedValue({ role: "owner", supabase: client });
});

describe("service editor actions", () => {
  it("sends Owner catalog and image changes to the canonical mutation", async () => {
    expect(await updateServiceAction({
      serviceId, categoryId, name: "Swedish Massage", description: "Updated",
      durationMinutes: 60, price: 900, imageUrl: "https://example.com/new.webp",
      imageAlt: "Massage room",
    })).toEqual({ success: true });
    expect(updateCanonicalService).toHaveBeenCalledWith(client, expect.objectContaining({
      serviceId, description: "Updated", imageUrl: "https://example.com/new.webp",
      imageAlt: "Massage room",
    }));
  });

  it("sends Marketing live edits to the same canonical mutation", async () => {
    const form = new FormData();
    form.set("serviceId", serviceId);
    form.set("description", "Updated in Marketing");
    form.set("imageUrl", "https://example.com/new.webp");
    form.set("imageAlt", "Massage room");
    form.set("badges", '["Popular"]');
    form.set("inclusions", "[]");
    expect((await updateServicePresentationAction({ success: false }, form)).success).toBe(true);
    expect(updateCanonicalService).toHaveBeenCalledWith(client, expect.objectContaining({
      serviceId, description: "Updated in Marketing", imageUrl: "https://example.com/new.webp",
      badges: ["Popular"],
    }));
  });

  it("rejects non-owners in both editors", async () => {
    getStaff.mockResolvedValue({ data: { system_role: "manager" } });
    getMarketingAccessContext.mockResolvedValue({ role: "digital_marketer", supabase: client });
    const form = new FormData();
    form.set("serviceId", serviceId);
    expect((await updateServiceAction({ serviceId, description: "No" })).success).toBe(false);
    expect((await updateServicePresentationAction({ success: false }, form)).success).toBe(false);
    expect(updateCanonicalService).not.toHaveBeenCalled();
  });
});
