import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  cookieValue: null as string | null,
  setCookie: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }),
  context: { role: "owner", userId: "owner-1" },
  branches: [
    { id: "main", name: "Main Spa" },
    { id: "sm", name: "SM Branch" },
  ],
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => mocks.cookieValue ? { value: mocks.cookieValue } : undefined,
    set: mocks.setCookie,
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ order: async () => ({ data: mocks.branches, error: null }) }),
      }),
    }),
  }),
}));
vi.mock("@/lib/queries/crm-context", () => ({
  getFrontDeskContext: async () => mocks.context,
}));

import { resolveOwnerFrontDeskBranch } from "@/lib/queries/front-desk-branch";
import { openOwnerFrontDeskBranch } from "@/app/(dashboard)/select-workspace/actions";

beforeEach(() => {
  mocks.cookieValue = null;
  mocks.context = { role: "owner", userId: "owner-1" };
  mocks.setCookie.mockClear();
  mocks.revalidatePath.mockClear();
  mocks.redirect.mockClear();
});

describe("Owner Front Desk branch preference", () => {
  it("uses the selected active branch and keeps another user's preference isolated", async () => {
    mocks.cookieValue = "owner-1:sm";
    expect(await resolveOwnerFrontDeskBranch("owner-1", "main")).toEqual({ id: "sm", name: "SM Branch" });
    expect(await resolveOwnerFrontDeskBranch("owner-2", "main")).toEqual({ id: "main", name: "Main Spa" });
  });

  it("falls back to the assigned branch when the saved branch is inactive", async () => {
    mocks.cookieValue = "owner-1:retired";
    expect(await resolveOwnerFrontDeskBranch("owner-1", "main")).toEqual({ id: "main", name: "Main Spa" });
  });

  it("persists only an active branch for an authenticated Owner", async () => {
    const formData = new FormData();
    formData.set("branchId", "sm");
    await expect(openOwnerFrontDeskBranch(formData)).rejects.toThrow("redirect:/crm/today");
    expect(mocks.setCookie).toHaveBeenCalledWith(
      "owner_front_desk_branch",
      "owner-1:sm",
      expect.objectContaining({ httpOnly: true, path: "/", sameSite: "lax" })
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/crm", "layout");
    expect(mocks.redirect).toHaveBeenCalledWith("/crm/today");
  });

  it("rejects branch changes from non-Owners and unknown branches", async () => {
    const formData = new FormData();
    formData.set("branchId", "sm");
    mocks.context = { role: "crm", userId: "staff-1" };
    await expect(openOwnerFrontDeskBranch(formData)).rejects.toThrow("Only an Owner");
    mocks.context = { role: "owner", userId: "owner-1" };
    formData.set("branchId", "inactive");
    await expect(openOwnerFrontDeskBranch(formData)).rejects.toThrow("active Front Desk branch");
    expect(mocks.setCookie).not.toHaveBeenCalled();
  });
});
