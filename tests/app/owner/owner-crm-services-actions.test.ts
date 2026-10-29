import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  isDevAuthBypassEnabled: vi.fn(() => false),
  revalidatePath: vi.fn(),
  invalidateTag: vi.fn(),
  invalidateCrmWorkspace: vi.fn(),
  invalidateManagerWorkspace: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/dev-bypass", () => ({
  isDevAuthBypassEnabled: mocks.isDevAuthBypassEnabled,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/cache/cache-tags", () => ({
  invalidateTag: mocks.invalidateTag,
  invalidateCrmWorkspace: mocks.invalidateCrmWorkspace,
  invalidateManagerWorkspace: mocks.invalidateManagerWorkspace,
  cacheTags: {
    serviceCatalog: "service-catalog",
    branchServices: (id: string) => `branch-services:${id}`,
    branchAssignableServices: (id: string) => `branch-assignable-services:${id}`,
  },
}));

import {
  saveOwnerServiceCatalogAction,
  setBranchServiceAction,
} from "@/app/(dashboard)/owner/services/actions";

const OWNER_USER_ID = "00000000-0000-4000-8000-000000000001";
const CRM_MAIN_USER_ID = "00000000-0000-4000-8000-000000000002";
const CRM_SM_USER_ID = "00000000-0000-4000-8000-000000000003";
const DRIVER_USER_ID = "00000000-0000-4000-8000-000000000004";

const BRANCH_MAIN = "11111111-1111-4111-8111-111111111111";
const BRANCH_SM = "22222222-2222-4222-8222-222222222222";
const CATEGORY_ID = "33333333-3333-4333-8333-333333333333";
const SERVICE_ID = "44444444-4444-4444-8444-444444444444";

type QueryResult = { data: unknown; error: unknown };

function createQueryChain(result: QueryResult) {
  const chain: Record<string, unknown> = {};
  for (const m of ["eq", "neq", "not", "is", "limit", "order", "in"]) {
    chain[m] = vi.fn(() => chain);
  }
  chain.select = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  chain.delete = vi.fn(() => chain);
  chain.upsert = vi.fn(async () => result);
  chain.single = vi.fn(async () => result);
  chain.maybeSingle = vi.fn(async () => result);
  chain.then = (onFulfilled: (val: QueryResult) => unknown, onRejected?: (err: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled, onRejected);
  return chain;
}

describe("saveOwnerServiceCatalogAction — CRM Services Authorization & Scoping", () => {
  let rpcMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isDevAuthBypassEnabled.mockReturnValue(false);
    rpcMock = vi.fn().mockResolvedValue({ data: "created-or-updated-service-id", error: null });
  });

  function setupClient({
    userId = OWNER_USER_ID,
    systemRole = "owner",
    branchId = null as string | null,
    existingOfferings = [] as { branch_id: string; is_active: boolean }[],
  }) {
    mocks.createClient.mockReturnValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: userId ? { id: userId } : null },
          error: null,
        })),
      },
      from: vi.fn((table: string) => {
        if (table === "staff") {
          return createQueryChain({
            data: { system_role: systemRole, branch_id: branchId },
            error: null,
          });
        }
        if (table === "service_categories") {
          return createQueryChain({
            data: { id: CATEGORY_ID },
            error: null,
          });
        }
        if (table === "branches") {
          return createQueryChain({
            data: [
              { id: BRANCH_MAIN, name: "Main Spa" },
              { id: BRANCH_SM, name: "SM Branch" },
            ],
            error: null,
          });
        }
        if (table === "services") {
          return createQueryChain({
            data: {
              image_url: null,
              buffer_before: 0,
              buffer_after: 0,
            },
            error: null,
          });
        }
        if (table === "branch_services") {
          return createQueryChain({
            data: existingOfferings,
            error: null,
          });
        }
        return createQueryChain({ data: null, error: null });
      }),
      rpc: rpcMock,
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn(async () => ({ data: { path: "test.webp" }, error: null })),
          remove: vi.fn(async () => ({ data: null, error: null })),
          getPublicUrl: vi.fn(() => ({ data: { publicUrl: "https://example.com/test.webp" } })),
        })),
      },
    });
  }

  it("rejects unauthorized staff roles (e.g., driver, routine csr, csr_staff)", async () => {
    for (const role of ["driver", "csr", "csr_staff", "utility", "staff"]) {
      setupClient({
        userId: DRIVER_USER_ID,
        systemRole: role,
        branchId: BRANCH_MAIN,
      });

      const formData = new FormData();
      formData.set(
        "catalog",
        JSON.stringify({
          categoryId: CATEGORY_ID,
          name: "Swedish Massage",
          description: "Relaxation",
          durationMinutes: 60,
          price: 800,
          isActive: true,
          isPublicVisible: true,
          durationPolicy: "fixed",
          extensionIncrementMinutes: null,
          extensionPrice: null,
          maximumDurationMinutes: null,
          imageAlt: "",
          allBranches: true,
          branchIds: [],
        })
      );

      const result = await saveOwnerServiceCatalogAction(formData);
      expect(result).toEqual({ success: false, error: "Unauthorized" });
      expect(rpcMock).not.toHaveBeenCalled();
    }
  });

  it("rejects unauthenticated requests", async () => {
    setupClient({ userId: "" as never });

    const formData = new FormData();
    formData.set(
      "catalog",
      JSON.stringify({
        categoryId: CATEGORY_ID,
        name: "Swedish Massage",
        description: "Relaxation",
        durationMinutes: 60,
        price: 800,
        isActive: true,
        isPublicVisible: true,
        durationPolicy: "fixed",
        extensionIncrementMinutes: null,
        extensionPrice: null,
        maximumDurationMinutes: null,
        imageAlt: "",
        allBranches: true,
        branchIds: [],
      })
    );

    const result = await saveOwnerServiceCatalogAction(formData);
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("allows owner to save with allBranches=true", async () => {
    setupClient({
      userId: OWNER_USER_ID,
      systemRole: "owner",
      branchId: null,
    });

    const formData = new FormData();
    formData.set(
      "catalog",
      JSON.stringify({
        categoryId: CATEGORY_ID,
        name: "Swedish Massage",
        description: "Relaxation",
        durationMinutes: 60,
        price: 800,
        isActive: true,
        isPublicVisible: true,
        durationPolicy: "fixed",
        extensionIncrementMinutes: null,
        extensionPrice: null,
        maximumDurationMinutes: null,
        imageAlt: "",
        allBranches: true,
        branchIds: [],
      })
    );

    const result = await saveOwnerServiceCatalogAction(formData);
    expect(result).toEqual({ success: true, serviceId: "created-or-updated-service-id" });
    expect(rpcMock).toHaveBeenCalledWith("save_owner_service_catalog", {
      p_service_id: null,
      p_catalog: expect.objectContaining({ name: "Swedish Massage", price: 800 }),
      p_all_branches: true,
      p_branch_ids: [],
    });
  });

  it("scopes CRM staff at Main Spa creating a new service to Main Spa only", async () => {
    setupClient({
      userId: CRM_MAIN_USER_ID,
      systemRole: "crm",
      branchId: BRANCH_MAIN,
    });

    const formData = new FormData();
    formData.set(
      "catalog",
      JSON.stringify({
        categoryId: CATEGORY_ID,
        name: "Deep Tissue Massage",
        description: "Therapeutic massage",
        durationMinutes: 60,
        price: 900,
        isActive: true,
        isPublicVisible: true,
        durationPolicy: "fixed",
        extensionIncrementMinutes: null,
        extensionPrice: null,
        maximumDurationMinutes: null,
        imageAlt: "",
        allBranches: true, // CRM cannot publish to all branches even if submitted
        branchIds: [BRANCH_MAIN, BRANCH_SM],
      })
    );

    const result = await saveOwnerServiceCatalogAction(formData);
    expect(result).toEqual({ success: true, serviceId: "created-or-updated-service-id" });
    expect(rpcMock).toHaveBeenCalledWith("save_owner_service_catalog", {
      p_service_id: null,
      p_catalog: expect.objectContaining({ name: "Deep Tissue Massage" }),
      p_all_branches: false,
      p_branch_ids: [BRANCH_MAIN],
    });
  });

  it("scopes CRM staff at SM Branch creating a new service to SM Branch only", async () => {
    setupClient({
      userId: CRM_SM_USER_ID,
      systemRole: "csr_head",
      branchId: BRANCH_SM,
    });

    const formData = new FormData();
    formData.set(
      "catalog",
      JSON.stringify({
        categoryId: CATEGORY_ID,
        name: "Express Foot Massage",
        description: "Quick recovery",
        durationMinutes: 30,
        price: 450,
        isActive: true,
        isPublicVisible: true,
        durationPolicy: "fixed",
        extensionIncrementMinutes: null,
        extensionPrice: null,
        maximumDurationMinutes: null,
        imageAlt: "",
        allBranches: false,
        branchIds: [BRANCH_SM],
      })
    );

    const result = await saveOwnerServiceCatalogAction(formData);
    expect(result).toEqual({ success: true, serviceId: "created-or-updated-service-id" });
    expect(rpcMock).toHaveBeenCalledWith("save_owner_service_catalog", {
      p_service_id: null,
      p_catalog: expect.objectContaining({ name: "Express Foot Massage" }),
      p_all_branches: false,
      p_branch_ids: [BRANCH_SM],
    });
  });

  it("preserves other branch offerings when CRM staff edits an existing service", async () => {
    setupClient({
      userId: CRM_SM_USER_ID,
      systemRole: "crm",
      branchId: BRANCH_SM,
      existingOfferings: [
        { branch_id: BRANCH_MAIN, is_active: true },
        { branch_id: BRANCH_SM, is_active: false },
      ],
    });

    const formData = new FormData();
    formData.set(
      "catalog",
      JSON.stringify({
        serviceId: SERVICE_ID,
        categoryId: CATEGORY_ID,
        name: "Swedish Massage",
        description: "Updated description",
        durationMinutes: 60,
        price: 850,
        isActive: true,
        isPublicVisible: true,
        durationPolicy: "fixed",
        extensionIncrementMinutes: null,
        extensionPrice: null,
        maximumDurationMinutes: null,
        imageAlt: "",
        allBranches: false,
        branchIds: [BRANCH_SM], // CRM enables it for SM Branch while Main Spa already has it
      })
    );

    const result = await saveOwnerServiceCatalogAction(formData);
    expect(result).toEqual({ success: true, serviceId: "created-or-updated-service-id" });
    // Both Main Spa (preserved) and SM Branch (added) are present
    expect(rpcMock).toHaveBeenCalledWith("save_owner_service_catalog", {
      p_service_id: SERVICE_ID,
      p_catalog: expect.objectContaining({ name: "Swedish Massage", price: 850 }),
      p_all_branches: false,
      p_branch_ids: expect.arrayContaining([BRANCH_MAIN, BRANCH_SM]),
    });
  });

  it("preserves other branch offerings when CRM staff de-selects their own branch", async () => {
    setupClient({
      userId: CRM_SM_USER_ID,
      systemRole: "crm",
      branchId: BRANCH_SM,
      existingOfferings: [
        { branch_id: BRANCH_MAIN, is_active: true },
        { branch_id: BRANCH_SM, is_active: true },
      ],
    });

    const formData = new FormData();
    formData.set(
      "catalog",
      JSON.stringify({
        serviceId: SERVICE_ID,
        categoryId: CATEGORY_ID,
        name: "Swedish Massage",
        description: "Updated description",
        durationMinutes: 60,
        price: 850,
        isActive: true,
        isPublicVisible: true,
        durationPolicy: "fixed",
        extensionIncrementMinutes: null,
        extensionPrice: null,
        maximumDurationMinutes: null,
        imageAlt: "",
        allBranches: false,
        branchIds: [BRANCH_MAIN], // SM Branch staff de-selects SM Branch, leaving Main Spa checked
      })
    );

    const result = await saveOwnerServiceCatalogAction(formData);
    expect(result).toEqual({ success: true, serviceId: "created-or-updated-service-id" });
    // Main Spa is preserved, SM Branch is not in the list
    expect(rpcMock).toHaveBeenCalledWith("save_owner_service_catalog", {
      p_service_id: SERVICE_ID,
      p_catalog: expect.objectContaining({ name: "Swedish Massage" }),
      p_all_branches: false,
      p_branch_ids: [BRANCH_MAIN],
    });
  });

  it("rejects non-owner whose branchId is not in active branches", async () => {
    setupClient({
      userId: CRM_MAIN_USER_ID,
      systemRole: "crm",
      branchId: "99999999-9999-4999-8999-999999999999", // Inactive/non-existent branch
    });

    const formData = new FormData();
    formData.set(
      "catalog",
      JSON.stringify({
        categoryId: CATEGORY_ID,
        name: "Swedish Massage",
        description: "Relaxation",
        durationMinutes: 60,
        price: 800,
        isActive: true,
        isPublicVisible: true,
        durationPolicy: "fixed",
        extensionIncrementMinutes: null,
        extensionPrice: null,
        maximumDurationMinutes: null,
        imageAlt: "",
        allBranches: false,
        branchIds: [BRANCH_MAIN],
      })
    );

    const result = await saveOwnerServiceCatalogAction(formData);
    expect(result).toEqual({ success: false, error: "Your branch is not an active branch." });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("handles underlying RPC errors gracefully without claiming success", async () => {
    setupClient({
      userId: CRM_MAIN_USER_ID,
      systemRole: "crm",
      branchId: BRANCH_MAIN,
    });
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "Database constraint violation" },
    });

    const formData = new FormData();
    formData.set(
      "catalog",
      JSON.stringify({
        categoryId: CATEGORY_ID,
        name: "Swedish Massage",
        description: "Relaxation",
        durationMinutes: 60,
        price: 800,
        isActive: true,
        isPublicVisible: true,
        durationPolicy: "fixed",
        extensionIncrementMinutes: null,
        extensionPrice: null,
        maximumDurationMinutes: null,
        imageAlt: "",
        allBranches: false,
        branchIds: [BRANCH_MAIN],
      })
    );

    const result = await saveOwnerServiceCatalogAction(formData);
    expect(result).toEqual({ success: false, error: "Database constraint violation" });
  });

  it("enforces branch isolation in setBranchServiceAction (rejects modifying other branches)", async () => {
    setupClient({
      userId: CRM_SM_USER_ID,
      systemRole: "crm",
      branchId: BRANCH_SM,
    });

    const result = await setBranchServiceAction({
      branchId: BRANCH_MAIN, // Attempting to configure Main Spa while assigned to SM Branch
      serviceId: SERVICE_ID,
      isActive: true,
    });

    expect(result).toEqual({
      success: false,
      error: "You can only configure services for your own branch.",
    });
  });

  it("allows branch service configuration for caller's own branch", async () => {
    setupClient({
      userId: CRM_SM_USER_ID,
      systemRole: "crm",
      branchId: BRANCH_SM,
    });

    const result = await setBranchServiceAction({
      branchId: BRANCH_SM,
      serviceId: SERVICE_ID,
      customPrice: 750,
      isActive: true,
    });

    expect(result).toEqual({ success: true });
  });
});
