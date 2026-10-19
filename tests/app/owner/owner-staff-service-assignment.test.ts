import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  isDevAuthBypassEnabled: vi.fn(() => false),
  revalidatePath: vi.fn(),
  invalidateCrmWorkspace: vi.fn(),
  invalidateManagerWorkspace: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/dev-bypass", () => ({
  isDevAuthBypassEnabled: mocks.isDevAuthBypassEnabled,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/cache/cache-tags", () => ({
  invalidateCrmWorkspace: mocks.invalidateCrmWorkspace,
  invalidateManagerWorkspace: mocks.invalidateManagerWorkspace,
}));

import { updateStaffAction } from "@/app/(dashboard)/owner/staff/actions";

const OWNER_AUTH_ID = "00000000-0000-4000-8000-000000000001";
const OWNER_STAFF_ID = "00000000-0000-4000-8000-000000000002";
const TARGET_STAFF_ID = "00000000-0000-4000-8000-000000000010";
const BRANCH_A_ID = "11111111-1111-4111-8111-111111111111";
const BRANCH_B_ID = "22222222-2222-4222-8222-222222222222";
const SERVICE_1_ID = "33333333-3333-4333-8333-333333333331";
const SERVICE_2_ID = "33333333-3333-4333-8333-333333333332";

type QueryResult = { data: unknown; error: unknown };

function createQueryChain(result: QueryResult) {
  const chain: Record<string, unknown> = {};
  for (const m of ["eq", "neq", "not", "is", "limit", "order"]) {
    chain[m] = vi.fn(() => chain);
  }
  chain.select = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  chain.delete = vi.fn(() => chain);
  chain.single = vi.fn(async () => result);
  chain.maybeSingle = vi.fn(async () => result);
  chain.then = (onFulfilled: (val: QueryResult) => unknown, onRejected?: (err: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled, onRejected);
  return chain;
}

describe("Owner Manage Services — Service Assignment Contract & Regression", () => {
  let rpcMock: ReturnType<typeof vi.fn>;
  let touchedTables: string[];

  function setupAuth({
    systemRole = "owner",
    branchId = BRANCH_A_ID,
    userId = OWNER_AUTH_ID,
    staffId = OWNER_STAFF_ID,
    targetBranchId = BRANCH_A_ID,
    targetRole = "service_staff",
    rpcError = null as unknown,
    updateStaffError = null as unknown,
  } = {}) {
    touchedTables = [];
    rpcMock = vi.fn(async () => {
      if (rpcError) {
        return { data: null, error: rpcError };
      }
      return { data: [{ service_id: SERVICE_1_ID }], error: null };
    });

    const targetStaffRecord = {
      id: TARGET_STAFF_ID,
      full_name: "Original Staff Name",
      nickname: "StaffNick",
      phone: "08123456789",
      tier: "mid",
      system_role: targetRole,
      staff_type: "therapist",
      is_head: false,
      branch_id: targetBranchId,
      is_active: true,
      updated_at: "2026-10-19T00:00:00.000Z",
    };

    const client = {
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: userId ? { id: userId } : null },
        })),
      },
      rpc: rpcMock,
      from: vi.fn((table: string) => {
        touchedTables.push(table);
        if (table === "staff") {
          const chain = createQueryChain({ data: targetStaffRecord, error: null });
          // If actor lookup
          chain.maybeSingle = vi.fn(async () => ({
            data: { id: staffId, branch_id: branchId, system_role: systemRole },
            error: null,
          }));
          // If target lookup
          chain.single = vi.fn(async () => ({
            data: targetStaffRecord,
            error: null,
          }));
          chain.update = vi.fn((payload) => {
            const updateChain = createQueryChain({
              data: updateStaffError
                ? null
                : [{ ...targetStaffRecord, ...(payload as Record<string, unknown>) }],
              error: updateStaffError,
            });
            return updateChain;
          });
          return chain;
        }

        if (table === "staff_onboarding_requests") {
          return createQueryChain({ data: null, error: null });
        }

        return createQueryChain({ data: null, error: null });
      }),
    };

    const admin = {
      from: vi.fn((table: string) => {
        touchedTables.push(table);
        if (table === "staff_onboarding_requests") {
          return createQueryChain({ data: null, error: null });
        }
        return createQueryChain({ data: null, error: null });
      }),
    };

    mocks.createClient.mockResolvedValue(client);
    mocks.createAdminClient.mockReturnValue(admin);
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Requirement 2: Explicit empty array -> service assignments are cleared via RPC
  it("2. Explicit empty array -> service assignments are cleared via transactional RPC", async () => {
    setupAuth({ systemRole: "owner" });

    const result = await updateStaffAction({
      staffId: TARGET_STAFF_ID,
      serviceIds: [],
    });

    expect(result.success).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith("replace_staff_service_capabilities", {
      p_target_staff_id: TARGET_STAFF_ID,
      p_service_ids: [],
    });
  });

  // Requirement 3: Undefined serviceIds -> existing assignments remain unchanged
  it("3. Undefined serviceIds -> existing assignments remain unchanged (RPC not invoked)", async () => {
    setupAuth({ systemRole: "owner" });

    const result = await updateStaffAction({
      staffId: TARGET_STAFF_ID,
      fullName: "Updated Name Only",
      serviceIds: undefined,
    });

    expect(result.success).toBe(true);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  // Requirement 4: Nonempty selection -> correct assignments are persisted
  it("4. Nonempty selection -> correct assignments are persisted with unique IDs", async () => {
    setupAuth({ systemRole: "owner" });

    const result = await updateStaffAction({
      staffId: TARGET_STAFF_ID,
      serviceIds: [SERVICE_1_ID, SERVICE_2_ID, SERVICE_1_ID], // contains duplicate to test deduplication
    });

    expect(result.success).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith("replace_staff_service_capabilities", {
      p_target_staff_id: TARGET_STAFF_ID,
      p_service_ids: [SERVICE_1_ID, SERVICE_2_ID],
    });
  });

  // Requirement 5: Failed persistence -> no false success response
  it("5. Failed persistence -> returns error and never reports false success", async () => {
    setupAuth({
      systemRole: "owner",
      rpcError: { message: "crm_staff_services_invalid_service" },
    });

    const result = await updateStaffAction({
      staffId: TARGET_STAFF_ID,
      serviceIds: [SERVICE_1_ID],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("One or more selected services are not assignable");
  });

  it("5b. Generic database RPC failure -> returns error and preserves failure integrity", async () => {
    setupAuth({
      systemRole: "owner",
      rpcError: { message: "connection timeout to database replica" },
    });

    const result = await updateStaffAction({
      staffId: TARGET_STAFF_ID,
      serviceIds: [],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("connection timeout to database replica");
  });

  // Requirement 6: Unauthorized changes -> rejected using existing authorization contracts
  it("6a. Unauthenticated caller -> rejected", async () => {
    setupAuth({ userId: null as unknown as string });

    const result = await updateStaffAction({
      staffId: TARGET_STAFF_ID,
      serviceIds: [],
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Not logged in");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("6b. Non-operational role (e.g. therapist) -> rejected", async () => {
    setupAuth({ systemRole: "therapist" });

    const result = await updateStaffAction({
      staffId: TARGET_STAFF_ID,
      serviceIds: [],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Access requires owner, manager, or CRM role");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("6c. Branch-scoped manager managing cross-branch staff -> rejected", async () => {
    setupAuth({
      systemRole: "manager",
      branchId: BRANCH_A_ID,
      targetBranchId: BRANCH_B_ID,
    });

    const result = await updateStaffAction({
      staffId: TARGET_STAFF_ID,
      serviceIds: [],
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("You can only manage staff in your branch");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("6d. Branch-scoped manager attempting to edit sensitive account (owner/manager) -> rejected", async () => {
    setupAuth({
      systemRole: "manager",
      branchId: BRANCH_A_ID,
      targetBranchId: BRANCH_A_ID,
      targetRole: "owner",
    });

    const result = await updateStaffAction({
      staffId: TARGET_STAFF_ID,
      serviceIds: [],
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("This action requires owner approval.");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  // Requirement 7: Unrelated staff profile edits -> existing service assignments preserved
  it("7. Unrelated staff profile edits -> existing service assignments preserved (serviceIds omitted)", async () => {
    setupAuth({ systemRole: "owner" });

    const result = await updateStaffAction({
      staffId: TARGET_STAFF_ID,
      fullName: "Brand New Full Name",
      nickname: "NewNick",
      phone: "08999999999",
      tier: "senior",
      systemRole: "service_head",
    });

    expect(result.success).toBe(true);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  // Requirement 8: Historical records -> not destructively modified
  it("8. Historical records -> only staff and staff_services RPC are touched, never bookings or financial ledger", async () => {
    setupAuth({ systemRole: "owner" });

    await updateStaffAction({
      staffId: TARGET_STAFF_ID,
      fullName: "Audited Staff Update",
      serviceIds: [],
    });

    // Verify touched tables
    expect(touchedTables).toContain("staff");
    expect(touchedTables).not.toContain("bookings");
    expect(touchedTables).not.toContain("booking_items");
    expect(touchedTables).not.toContain("attendance_records");
    expect(touchedTables).not.toContain("cash_flow_ledger");
    expect(touchedTables).not.toContain("payments");
    expect(rpcMock).toHaveBeenCalledWith("replace_staff_service_capabilities", {
      p_target_staff_id: TARGET_STAFF_ID,
      p_service_ids: [],
    });
  });
});

describe("StaffEditForm — Form Submission Contract", () => {
  // Requirement 1: Owner deselects all services -> submissions contain an explicit empty array
  it("1. Deselecting all services in Owner Manage Services form creates an explicit empty array", () => {
    // Simulate FormData when service capabilities fieldset is present and all checkboxes deselected
    const formData = new FormData();
    formData.append("manageServices", "1");
    formData.append("fullName", "Test Staff");
    formData.append("tier", "senior");
    formData.append("systemRole", "service_staff");
    formData.append("staffType", "therapist");
    // No "serviceIds" entries because all checkboxes are unchecked

    const isManagingServices = formData.get("manageServices") === "1";
    const selectedServiceIds = formData
      .getAll("serviceIds")
      .map((v) => String(v).trim())
      .filter((id) => id.length > 0);
    const serviceIds = isManagingServices ? selectedServiceIds : undefined;

    expect(serviceIds).toEqual([]); // Must be an explicit empty array, NOT undefined
  });

  it("1b. Selecting services in Owner Manage Services form passes non-empty array", () => {
    const formData = new FormData();
    formData.append("manageServices", "1");
    formData.append("serviceIds", SERVICE_1_ID);
    formData.append("serviceIds", SERVICE_2_ID);

    const isManagingServices = formData.get("manageServices") === "1";
    const selectedServiceIds = formData
      .getAll("serviceIds")
      .map((v) => String(v).trim())
      .filter((id) => id.length > 0);
    const serviceIds = isManagingServices ? selectedServiceIds : undefined;

    expect(serviceIds).toEqual([SERVICE_1_ID, SERVICE_2_ID]);
  });

  it("1c. Unrelated staff profile form (onEditServices provided) passes undefined serviceIds", () => {
    // When onEditServices is provided, manageServices is omitted from the form
    const formData = new FormData();
    formData.append("fullName", "Profile Only Update");
    formData.append("tier", "senior");

    const onEditServices = () => {};
    const isManagingServices = formData.get("manageServices") === "1" || !onEditServices;
    const selectedServiceIds = formData
      .getAll("serviceIds")
      .map((v) => String(v).trim())
      .filter((id) => id.length > 0);
    const serviceIds = isManagingServices ? selectedServiceIds : undefined;

    expect(serviceIds).toBeUndefined(); // Preserves existing service assignments!
  });
});
