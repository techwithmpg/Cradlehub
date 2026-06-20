import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import {
  deleteStaffGroupScheduleRuleAction,
  upsertStaffGroupScheduleRuleAction,
} from "@/lib/actions/staff-schedule-groups";

const GROUP_ID = "8f2300b7-03ac-49a5-87a5-afca5c11d95e";
const BRANCH_ID = "c1000000-0000-0000-0000-000000000001";
const OTHER_BRANCH_ID = "c1000000-0000-0000-0000-000000000002";
const USER_ID = "ecacb2f8-1d6b-40db-b56a-6c9dcfd908a8";
const SAFE_PERMISSION_ERROR =
  "You do not have permission to update schedule rules for this branch.";
const SAFE_SAVE_ERROR = "We could not save the schedule rules. Please try again.";

function actorQuery(role: string, branchId: string | null = BRANCH_ID) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn().mockResolvedValue({
      data: { id: "staff-id", system_role: role, branch_id: branchId },
      error: null,
    }),
  };
  return query;
}

function groupQuery(branchId = BRANCH_ID) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn().mockResolvedValue({
      data: { id: GROUP_ID, branch_id: branchId },
      error: null,
    }),
  };
  return query;
}

function upsertQuery(error: { code?: string; message: string } | null = null) {
  const savedRule = {
    id: "rule-id",
    group_id: GROUP_ID,
    day_of_week: 0,
    shift_type: "opening",
    start_time: "10:00:00",
    end_time: "17:30:00",
    is_day_off: false,
    is_active: true,
    created_at: "2026-06-17T00:00:00Z",
    updated_at: "2026-06-17T00:00:00Z",
  };
  const query = {
    upsert: vi.fn(() => query),
    select: vi.fn(() => query),
    single: vi.fn().mockResolvedValue({ data: error ? null : savedRule, error }),
  };
  return { query, savedRule };
}

function deleteQuery(error: { code?: string; message: string } | null = null) {
  const query = {
    delete: vi.fn(() => query),
    eq: vi.fn(() => query),
    select: vi.fn().mockResolvedValue({ data: error ? null : [{ id: "rule-id" }], error }),
  };
  return query;
}

function clientFor(options: {
  role: string;
  actorBranchId?: string | null;
  groupBranchId?: string;
  mutationQuery?: unknown;
}) {
  const actor = actorQuery(options.role, options.actorBranchId);
  const group = groupQuery(options.groupBranchId);
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }),
    },
    from: vi.fn((table: string) => {
      if (table === "staff") return actor;
      if (table === "staff_schedule_groups") return group;
      return options.mutationQuery;
    }),
  };
}

const validUpsert = {
  groupId: GROUP_ID,
  dayOfWeek: 0,
  shiftType: "opening" as const,
  startTime: "10:00",
  endTime: "17:30",
  isDayOff: false,
  isActive: true,
};

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("staff group schedule rule actions", () => {
  it("allows the legacy csr role to upsert a rule in its own branch", async () => {
    const mutation = upsertQuery();
    mocks.createClient.mockResolvedValue(
      clientFor({ role: "csr", mutationQuery: mutation.query })
    );

    const result = await upsertStaffGroupScheduleRuleAction(validUpsert);

    expect(result).toEqual({ success: true, rule: mutation.savedRule });
    expect(mutation.query.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ group_id: GROUP_ID, day_of_week: 0, shift_type: "opening" }),
      { onConflict: "group_id,day_of_week,shift_type" }
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/crm/schedule");
  });

  it("blocks an unauthorized staff role before mutation", async () => {
    const mutation = upsertQuery();
    mocks.createClient.mockResolvedValue(
      clientFor({ role: "staff", mutationQuery: mutation.query })
    );

    const result = await upsertStaffGroupScheduleRuleAction(validUpsert);

    expect(result).toEqual({ success: false, error: SAFE_PERMISSION_ERROR });
    expect(mutation.query.upsert).not.toHaveBeenCalled();
  });

  it("blocks a CRM user from another branch", async () => {
    const mutation = upsertQuery();
    mocks.createClient.mockResolvedValue(
      clientFor({
        role: "crm",
        actorBranchId: OTHER_BRANCH_ID,
        groupBranchId: BRANCH_ID,
        mutationQuery: mutation.query,
      })
    );

    const result = await upsertStaffGroupScheduleRuleAction(validUpsert);

    expect(result).toEqual({ success: false, error: SAFE_PERMISSION_ERROR });
    expect(mutation.query.upsert).not.toHaveBeenCalled();
  });

  it("maps RLS errors to a safe permission message", async () => {
    const mutation = upsertQuery({
      code: "42501",
      message: 'new row violates row-level security policy for table "staff_group_schedule_rules"',
    });
    mocks.createClient.mockResolvedValue(
      clientFor({ role: "csr", mutationQuery: mutation.query })
    );

    const result = await upsertStaffGroupScheduleRuleAction(validUpsert);

    expect(result).toEqual({ success: false, error: SAFE_PERMISSION_ERROR });
    expect(result.error).not.toContain("row-level security");
  });

  it("maps other database errors to a safe retry message", async () => {
    const mutation = upsertQuery({ code: "XX000", message: "internal database detail" });
    mocks.createClient.mockResolvedValue(
      clientFor({ role: "csr", mutationQuery: mutation.query })
    );

    const result = await upsertStaffGroupScheduleRuleAction(validUpsert);

    expect(result).toEqual({ success: false, error: SAFE_SAVE_ERROR });
  });

  it("authorizes and deletes a same-branch rule", async () => {
    const mutation = deleteQuery();
    mocks.createClient.mockResolvedValue(
      clientFor({ role: "manager", mutationQuery: mutation })
    );

    const result = await deleteStaffGroupScheduleRuleAction({
      groupId: GROUP_ID,
      dayOfWeek: 0,
      shiftType: "opening",
    });

    expect(result).toEqual({ success: true });
    expect(mutation.delete).toHaveBeenCalledOnce();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/crm/schedule");
  });
});
