import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

const state = vi.hoisted(() => {
  type DbRow = Record<string, unknown>;
  const tables: {
    workflow_tasks: DbRow[];
    workspace_notifications: DbRow[];
    bookings: DbRow[];
    branch_resources: DbRow[];
    staff: DbRow[];
    [key: string]: DbRow[] | undefined;
  } = {
    workflow_tasks: [],
    workspace_notifications: [],
    bookings: [],
    branch_resources: [],
    staff: [],
  };

  let idCounter = 1;
  const makeId = (prefix: string) => `${prefix}-${idCounter++}`;

  const filterRows = (table: string, filters: Array<{ kind: string; key: string; value: unknown }>) =>
    (tables[table] ?? []).filter((row) =>
      filters.every((f) => {
        if (f.kind === "eq") return row[f.key] === f.value;
        if (f.kind === "in") return Array.isArray(f.value) && f.value.includes(row[f.key]);
        if (f.kind === "like") {
          const pattern = String(f.value).replace(/%/g, "");
          return typeof row[f.key] === "string" && String(row[f.key]).startsWith(pattern);
        }
        return true;
      })
    );

  function makeAdminClient() {
    return {
      auth: {
        getUser: async () => ({
          data: { user: { id: "auth-crm-main-1" } },
          error: null,
        }),
      },
      from(table: string) {
        const filters: Array<{ kind: string; key: string; value: unknown }> = [];
        let mode: "select" | "insert" | "update" = "select";
        let payload: DbRow | null = null;

        const builder = {
          select() {
            return builder;
          },
          eq(key: string, value: unknown) {
            filters.push({ kind: "eq", key, value });
            return builder;
          },
          is(key: string, value: unknown) {
            filters.push({ kind: "eq", key, value });
            return builder;
          },
          in(key: string, value: unknown[]) {
            filters.push({ kind: "in", key, value });
            return builder;
          },
          like(key: string, value: string) {
            filters.push({ kind: "like", key, value });
            return builder;
          },
          limit() {
            return builder;
          },
          insert(values: DbRow) {
            mode = "insert";
            payload = values;
            return builder;
          },
          update(values: DbRow) {
            mode = "update";
            payload = values;
            return builder;
          },
          async maybeSingle() {
            if (mode === "select") {
              const matched = filterRows(table, filters);
              return { data: matched[0] ?? null, error: null };
            }
            const res = await exec();
            return { data: res.data?.[0] ?? null, error: null };
          },
          async single() {
            const res = await exec();
            return { data: res.data?.[0] ?? null, error: null };
          },
          then(resolve: (v: { data: DbRow[]; error: null }) => void) {
            void exec().then(resolve);
          },
        };

        async function exec() {
          const tableRows = (tables[table] ??= []);
          if (mode === "insert" && payload) {
            const row = { id: makeId(table), ...payload };
            tableRows.push(row);
            return { data: [row], error: null as null };
          }
          if (mode === "update" && payload) {
            const matched = filterRows(table, filters);
            for (const row of matched) {
              Object.assign(row, payload);
            }
            return { data: matched, error: null as null };
          }
          return { data: filterRows(table, filters), error: null as null };
        }

        return builder;
      },
      channel() {
        return {
          httpSend: async () => "ok",
        };
      },
      async removeChannel() {
        return "ok";
      },
    };
  }

  return {
    tables,
    reset() {
      tables.workflow_tasks = [];
      tables.workspace_notifications = [];
      tables.bookings = [];
      tables.branch_resources = [];
      tables.staff = [
        {
          id: "staff-crm-1",
          auth_user_id: "auth-crm-main-1",
          branch_id: "11111111-1111-4111-8111-111111111111",
          system_role: "crm",
          is_active: true,
          archived_at: null,
          merged_into_staff_id: null,
        },
      ];
      idCounter = 1;
    },
    makeAdminClient,
    evaluateMock: vi.fn(),
    snapshotMock: vi.fn(),
    assignTherapistMock: vi.fn(),
    assignRoomMock: vi.fn(),
    assignDriverMock: vi.fn(),
    collectionDispMock: vi.fn(),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/server", () => ({
  after: () => {
    throw new Error("outside request scope");
  },
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => state.makeAdminClient(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => state.makeAdminClient(),
}));
vi.mock("@/lib/dev-bypass", () => ({
  isDevAuthBypassEnabled: () => false,
  getDevBypassLayoutStaff: () => ({
    branch_id: "11111111-1111-4111-8111-111111111111",
    system_role: "crm",
  }),
}));
vi.mock("@/lib/queries/front-desk-branch", () => ({
  resolveOwnerFrontDeskBranch: async () => ({ id: "11111111-1111-4111-8111-111111111111" }),
}));
vi.mock("@/lib/bookings/revalidate-booking-surfaces", () => ({
  revalidateOperationalBookingSurfaces: vi.fn(),
}));
vi.mock("@/lib/notifications/push/delivery", () => ({
  deliverWorkspaceNotificationPush: vi.fn(async () => undefined),
}));
vi.mock("@/app/(dashboard)/crm/bookings/actions", () => ({
  assignBookingTherapistAction: (...args: unknown[]) => state.assignTherapistMock(...args),
  assignBookingRoomAction: (...args: unknown[]) => state.assignRoomMock(...args),
}));
vi.mock("@/lib/home-service/dispatch-operations", () => ({
  assignHomeServiceDriver: (...args: unknown[]) => state.assignDriverMock(...args),
}));
vi.mock("@/lib/dispatch/optimizer-bridge", () => ({
  updateBookingCollectionDisposition: (...args: unknown[]) => state.collectionDispMock(...args),
}));

import {
  clearOptimizationAssistantSyncCache,
  summarizeOptimizationEvaluation,
  syncCrmOptimizationAlerts,
} from "@/lib/optimization/crm-operations-assistant";
import {
  clearOptimizationEvaluationCache,
} from "@/lib/optimization/client";
import * as optClient from "@/lib/optimization/client";
import {
  drainPendingOptimizationReevaluations,
  evaluateBranchSummarySafe,
  scheduleBranchOptimizationReevaluation,
} from "@/lib/optimization/auto-reevaluate";
import { applyRecommendedFixAction } from "@/lib/actions/optimization-actions";
import type { PredictiveConflictItem, UnifiedEvaluationResult } from "@/lib/optimization/types";

const BRANCH_MAIN = "11111111-1111-4111-8111-111111111111";
const BRANCH_SM = "22222222-2222-4222-8222-222222222222";
const BOOKING_A = "aaaa1111-1111-4111-8111-111111111111";
const BOOKING_B = "bbbb2222-2222-4222-8222-222222222222";
const STAFF_SWAP = "cccc3333-3333-4333-8333-333333333333";
const DRIVER_PICKUP = "dddd4444-4444-4444-8444-444444444444";

function makeConflict(overrides: Partial<PredictiveConflictItem> = {}): PredictiveConflictItem {
  return {
    issue_type: "room_capacity_bottleneck",
    branch_id: BRANCH_MAIN,
    affected_booking_ids: [BOOKING_A],
    affected_staff_ids: [STAFF_SWAP],
    affected_resource_ids: [],
    severity: "high",
    confidence_or_data_quality: { status: "high", score: 0.96, notes: [] },
    predicted_impact: "Couple Room 1 is double-booked at 14:00.",
    latest_useful_action_time: "13:30",
    latest_useful_action_minute: 810,
    recommended_actions: [
      {
        action_id: "act-1",
        action_type: "swap_therapist",
        label: "Reassign to Ana Reyes",
        detail: "Clears overlap without touching guest time.",
        target_booking_id: BOOKING_A,
        proposed_staff_id: STAFF_SWAP,
        proposed_staff_name: "Ana Reyes",
        proposed_resource_id: null,
        proposed_resource_name: null,
        proposed_driver_id: null,
        proposed_driver_name: null,
        proposed_start_minute: null,
        requires_customer_approval: false,
        verified_feasible: true,
      },
    ],
    authorization_required: "crm_operator",
    source_snapshot_version: "2026-11-19:snap-v1",
    dedupe_key: `uoe:${BRANCH_MAIN}:room_cap:${BOOKING_A}`,
    expiration_or_resolution_condition: "Assign separate room or therapist.",
    assistant_tier: "persistent_action_required",
    ...overrides,
  };
}

function makeEval(
  overrides: Partial<UnifiedEvaluationResult> = {}
): UnifiedEvaluationResult {
  const date = overrides.date ?? "2026-11-19";
  return {
    branch_id: BRANCH_MAIN,
    branchName: "Main Spa",
    date,
    now_minute: 780,
    source_snapshot_version: `${date}:snap-v1`,
    dynamic_buffers: [],
    therapist_timelines: [],
    conflicts_and_opportunities: [],
    summary_counts: {},
    evaluator_latency_ms: 14,
    engineSource: "python_ortools",
    degraded: false,
    degradedReason: null,
    evaluatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("CRM Operations Assistant Pipeline & Synchronization", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    state.reset();
    clearOptimizationAssistantSyncCache();
    clearOptimizationEvaluationCache();
    state.assignTherapistMock.mockReset().mockResolvedValue({ success: true });
    state.assignRoomMock.mockReset().mockResolvedValue({ success: true });
    state.assignDriverMock.mockReset().mockResolvedValue({ ok: true });
    state.collectionDispMock.mockReset().mockResolvedValue({ ok: true });
  });

  it("distinguishes healthy, degraded fallback, and unavailable states instead of false All Clear", async () => {
    const healthy = summarizeOptimizationEvaluation(makeEval());
    expect(healthy.status).toBe("healthy");

    const degraded = summarizeOptimizationEvaluation(
      makeEval({
        engineSource: "ts_deterministic_fallback",
        degraded: true,
        degradedReason: "Python OR-Tools optimizer unreachable; running local safety checks only.",
      })
    );
    expect(degraded.status).toBe("degraded");
    expect(degraded.degradedReason).toContain("unreachable");

    vi.spyOn(optClient, "evaluateBranchOperationsCached").mockRejectedValueOnce(
      new Error("Snapshot query timeout")
    );
    const unavailable = await evaluateBranchSummarySafe({
      branchId: BRANCH_MAIN,
      branchName: "Main Spa",
      date: "2026-11-19",
    });
    expect(unavailable.ok).toBe(false);
    expect(unavailable.summary.status).toBe("unavailable");
  });

  it("enforces tier persistence, re-notifies when resolved issue recurs, and isolates dates & branches", async () => {
    const db = state.makeAdminClient() as unknown as SupabaseClient<Database>;
    const persistent = makeConflict();
    const earlyWarning = makeConflict({
      dedupe_key: `uoe:${BRANCH_MAIN}:warning:${BOOKING_B}`,
      issue_type: "session_overrun_ripple",
      assistant_tier: "early_warning_toast",
      severity: "warning",
    });
    const quiet = makeConflict({
      dedupe_key: `uoe:${BRANCH_MAIN}:quiet:${BOOKING_B}`,
      issue_type: "earlier_slot_opportunity",
      assistant_tier: "quiet_opportunity",
      severity: "info",
    });
    const foreignBranch = makeConflict({
      branch_id: BRANCH_SM,
      dedupe_key: `uoe:${BRANCH_SM}:room_cap:other`,
    });

    const summary1 = await syncCrmOptimizationAlerts({
      evaluation: makeEval({
        date: "2026-11-19",
        source_snapshot_version: "2026-11-19:v1",
        conflicts_and_opportunities: [persistent, earlyWarning, quiet, foreignBranch],
      }),
      forceSync: true,
      evaluationStartedAtMs: 1000,
      supabase: db,
    });

    expect(summary1.persistentActions).toHaveLength(1);
    expect(summary1.earlyWarnings).toHaveLength(1);
    expect(summary1.quietOpportunities).toHaveLength(1);
    // Only persistent branch conflict hits durable tasks & notifications (no quiet/warning spam)
    expect(state.tables.workflow_tasks).toHaveLength(1);
    expect(state.tables.workspace_notifications).toHaveLength(1);
    expect(state.tables.workspace_notifications[0]?.status).toBe("unread");

    // Evaluating Tomorrow (2026-11-20) must NOT resolve open alerts for Today (2026-11-19)
    await syncCrmOptimizationAlerts({
      evaluation: makeEval({
        date: "2026-11-20",
        source_snapshot_version: "2026-11-20:v1",
        conflicts_and_opportunities: [],
      }),
      forceSync: true,
      evaluationStartedAtMs: 1100,
      supabase: db,
    });
    expect(state.tables.workflow_tasks[0]?.status).toBe("open");
    expect(state.tables.workspace_notifications[0]?.status).toBe("unread");

    // Monotonic guard: an older started run (900 < 1000) cannot overwrite or resolve newer state
    await syncCrmOptimizationAlerts({
      evaluation: makeEval({
        date: "2026-11-19",
        source_snapshot_version: "2026-11-19:v0",
        conflicts_and_opportunities: [],
      }),
      forceSync: true,
      evaluationStartedAtMs: 900,
      supabase: db,
    });
    expect(state.tables.workflow_tasks[0]?.status).toBe("open");

    // Clear Today (2026-11-19) -> both task & notification auto-resolve
    await syncCrmOptimizationAlerts({
      evaluation: makeEval({
        date: "2026-11-19",
        source_snapshot_version: "2026-11-19:v2",
        conflicts_and_opportunities: [],
      }),
      forceSync: true,
      evaluationStartedAtMs: 1200,
      supabase: db,
    });
    expect(state.tables.workflow_tasks[0]?.status).toBe("completed");
    expect(state.tables.workspace_notifications[0]?.status).toBe("resolved");

    // Re-occurrence of the SAME dedupe_key MUST re-alert (regression fixed: createNotificationOnce missed it)
    await syncCrmOptimizationAlerts({
      evaluation: makeEval({
        date: "2026-11-19",
        source_snapshot_version: "2026-11-19:v3",
        conflicts_and_opportunities: [persistent],
      }),
      forceSync: true,
      evaluationStartedAtMs: 1300,
      supabase: db,
    });
    expect(state.tables.workspace_notifications.filter((n) => n.status === "unread")).toHaveLength(1);
    expect(state.tables.workspace_notifications).toHaveLength(2);
  });

  it("coalesces rapid mutation reevaluations outside request scope without dropping latest snapshot", async () => {
    const evalSpy = vi.spyOn(optClient, "evaluateBranchOperationsCached");
    evalSpy.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 15));
      return makeEval({
        date: "2026-11-19",
        source_snapshot_version: `2026-11-19:calls-${evalSpy.mock.calls.length}`,
      });
    });

    scheduleBranchOptimizationReevaluation({
      branchId: BRANCH_MAIN,
      date: "2026-11-19",
      reason: "event_1",
    });
    scheduleBranchOptimizationReevaluation({
      branchId: BRANCH_MAIN,
      date: "2026-11-19",
      reason: "event_2",
    });
    scheduleBranchOptimizationReevaluation({
      branchId: BRANCH_MAIN,
      date: "2026-11-19",
      reason: "event_3",
    });

    await drainPendingOptimizationReevaluations();
    expect(evalSpy.mock.calls.length).toBeLessThanOrEqual(2);
    expect(evalSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("blocks customer_selected swap without explicit confirmation and serializes concurrent dual-PC fix clicks", async () => {
    const conflict = makeConflict({
      recommended_actions: [
        {
          action_id: "act-swap",
          action_type: "swap_therapist",
          label: "Swap to Ana Reyes",
          detail: "Resolve double booking",
          target_booking_id: BOOKING_A,
          proposed_staff_id: STAFF_SWAP,
          proposed_staff_name: "Ana Reyes",
          proposed_resource_id: null,
          proposed_resource_name: null,
          proposed_driver_id: null,
          proposed_driver_name: null,
          proposed_start_minute: null,
          requires_customer_approval: true,
          verified_feasible: true,
        },
      ],
    });

    state.tables.bookings.push({
      id: BOOKING_A,
      branch_id: BRANCH_MAIN,
      status: "confirmed",
      therapist_selection_source: "customer_selected",
      metadata: {},
    });

    const evalSpy = vi.spyOn(optClient, "evaluateBranchOperationsCached");
    evalSpy.mockResolvedValue(
      makeEval({
        branch_id: BRANCH_MAIN,
        source_snapshot_version: "2026-11-19:conflict-v1",
        conflicts_and_opportunities: [conflict],
      })
    );

    // 1. Without confirmCustomerApproval, server must reject swap on customer_selected booking
    const blocked = await applyRecommendedFixAction({
      sourceSnapshotVersion: "2026-11-19:conflict-v1",
      date: "2026-11-19",
      actionType: "swap_therapist",
      targetBookingId: BOOKING_A,
      proposedStaffId: STAFF_SWAP,
      confirmCustomerApproval: false,
    });
    expect(blocked.success).toBe(false);
    if (!blocked.success) {
      expect(blocked.code).toBe("CUSTOMER_APPROVAL_REQUIRED");
    }
    expect(state.assignTherapistMock).not.toHaveBeenCalled();

    // 2. Simultaneous PC 1 + PC 2 clicks with explicit approval -> only ONE commits!
    let resolvedInDb = false;
    evalSpy.mockImplementation(async () => {
      if (!resolvedInDb) {
        return makeEval({
          branch_id: BRANCH_MAIN,
          source_snapshot_version: "2026-11-19:conflict-v1",
          conflicts_and_opportunities: [conflict],
        });
      }
      return makeEval({
        branch_id: BRANCH_MAIN,
        source_snapshot_version: "2026-11-19:resolved-v2",
        conflicts_and_opportunities: [],
      });
    });
    state.assignTherapistMock.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 20));
      resolvedInDb = true;
      return { success: true };
    });

    const [pc1, pc2] = await Promise.all([
      applyRecommendedFixAction({
        sourceSnapshotVersion: "2026-11-19:conflict-v1",
        date: "2026-11-19",
        actionType: "swap_therapist",
        targetBookingId: BOOKING_A,
        proposedStaffId: STAFF_SWAP,
        confirmCustomerApproval: true,
      }),
      applyRecommendedFixAction({
        sourceSnapshotVersion: "2026-11-19:conflict-v1",
        date: "2026-11-19",
        actionType: "swap_therapist",
        targetBookingId: BOOKING_A,
        proposedStaffId: STAFF_SWAP,
        confirmCustomerApproval: true,
      }),
    ]);

    expect(pc1.success).toBe(true);
    expect(pc2.success).toBe(false);
    if (!pc2.success) {
      expect(pc2.code).toBe("CONFLICT_ALREADY_RESOLVED");
      expect(pc2.summary?.persistentActions).toHaveLength(0);
    }
    expect(state.assignTherapistMock).toHaveBeenCalledTimes(1);
    expect(
      (state.tables.booking_events ?? []).some((e) =>
        String(e.notes ?? "").includes("with confirmed guest approval")
      )
    ).toBe(true);

    // 2b. When swap_therapist also proposes a room that is not active/valid in branch_resources, fail BEFORE mutating therapist
    const swapAndInvalidRoomConflict = makeConflict({
      recommended_actions: [
        {
          action_id: "act-swap-room",
          action_type: "swap_therapist",
          label: "Swap therapist and move room",
          detail: "Moves to inactive room",
          target_booking_id: BOOKING_A,
          proposed_staff_id: STAFF_SWAP,
          proposed_staff_name: "Ana Santos",
          proposed_resource_id: "eeee5555-5555-4555-8555-555555555555",
          proposed_resource_name: "Closed Suite",
          proposed_driver_id: null,
          proposed_driver_name: null,
          proposed_start_minute: null,
          requires_customer_approval: true,
          verified_feasible: true,
        },
      ],
    });
    evalSpy.mockResolvedValue(
      makeEval({
        branch_id: BRANCH_MAIN,
        source_snapshot_version: "2026-11-19:swap-room-v1",
        conflicts_and_opportunities: [swapAndInvalidRoomConflict],
      })
    );
    const badRoomRes = await applyRecommendedFixAction({
      sourceSnapshotVersion: "2026-11-19:swap-room-v1",
      date: "2026-11-19",
      actionType: "swap_therapist",
      targetBookingId: BOOKING_A,
      proposedStaffId: STAFF_SWAP,
      proposedResourceId: "eeee5555-5555-4555-8555-555555555555",
      confirmCustomerApproval: true,
    });
    expect(badRoomRes.success).toBe(false);
    // Therapist must NOT have been mutated when the room pre-check failed
    expect(state.assignTherapistMock).toHaveBeenCalledTimes(1);

    // 3. Collection driver reassignment executes through authoritative optimizer-bridge helper
    const collConflict = makeConflict({
      issue_type: "driver_route_ripple",
      dedupe_key: `uoe:${BRANCH_MAIN}:driver_ripple:${BOOKING_B}`,
      recommended_actions: [
        {
          action_id: "act-coll",
          action_type: "reassign_collection_driver",
          label: "Assign Driver Two for pickup",
          detail: "Balances return collection",
          target_booking_id: BOOKING_B,
          proposed_staff_id: null,
          proposed_staff_name: null,
          proposed_resource_id: null,
          proposed_resource_name: null,
          proposed_driver_id: DRIVER_PICKUP,
          proposed_driver_name: "Driver Two",
          proposed_start_minute: null,
          requires_customer_approval: false,
          verified_feasible: true,
        },
      ],
    });
    evalSpy.mockResolvedValue(
      makeEval({
        branch_id: BRANCH_MAIN,
        source_snapshot_version: "2026-11-19:coll-v1",
        conflicts_and_opportunities: [collConflict],
      })
    );
    const colRes = await applyRecommendedFixAction({
      sourceSnapshotVersion: "2026-11-19:coll-v1",
      date: "2026-11-19",
      actionType: "reassign_collection_driver",
      targetBookingId: BOOKING_B,
      proposedDriverId: DRIVER_PICKUP,
    });
    expect(colRes.success).toBe(true);
    expect(state.collectionDispMock).toHaveBeenCalledTimes(1);
  });

  it("enforces cross-instance database monotonic watermark and cross-instance duplicate fix protection", async () => {
    const db = state.makeAdminClient() as unknown as SupabaseClient<Database>;
    const conflict = makeConflict();

    // Instance 2 commits a newer evaluation (startedAtMs = 2000) that creates then resolves the task
    await syncCrmOptimizationAlerts({
      evaluation: makeEval({
        date: "2026-11-19",
        source_snapshot_version: "2026-11-19:v2",
        conflicts_and_opportunities: [conflict],
      }),
      forceSync: true,
      evaluationStartedAtMs: 1800,
      supabase: db,
    });
    await syncCrmOptimizationAlerts({
      evaluation: makeEval({
        date: "2026-11-19",
        source_snapshot_version: "2026-11-19:v3-resolved",
        conflicts_and_opportunities: [],
      }),
      forceSync: true,
      evaluationStartedAtMs: 2000,
      supabase: db,
    });
    expect(state.tables.workflow_tasks[0]?.status).toBe("completed");

    // Simulate a separate serverless instance (Instance 1) with an empty in-memory lastSyncByScope cache
    // finishing a stale evaluation that started at 1500 (< 2000).
    clearOptimizationAssistantSyncCache();
    await syncCrmOptimizationAlerts({
      evaluation: makeEval({
        date: "2026-11-19",
        source_snapshot_version: "2026-11-19:v1-stale",
        conflicts_and_opportunities: [conflict],
      }),
      forceSync: true,
      evaluationStartedAtMs: 1500,
      supabase: db,
    });

    // The DB-backed watermark (2000 > 1500) must prevent Instance 1 from re-opening the completed task
    expect(state.tables.workflow_tasks[0]?.status).toBe("completed");

    // Cross-instance duplicate fix protection: if Instance B already updated bookingRow.staff_id to STAFF_SWAP,
    // Instance A must return CONFLICT_ALREADY_RESOLVED without calling assignBookingTherapistAction again.
    state.tables.bookings = [
      {
        id: BOOKING_A,
        branch_id: BRANCH_MAIN,
        staff_id: STAFF_SWAP,
        resource_id: null,
        status: "confirmed",
        therapist_selection_source: "system_assigned",
        metadata: {},
      },
    ];
    vi.spyOn(optClient, "evaluateBranchOperationsCached").mockResolvedValue(
      makeEval({
        branch_id: BRANCH_MAIN,
        source_snapshot_version: "2026-11-19:race-v1",
        conflicts_and_opportunities: [conflict],
      })
    );
    state.assignTherapistMock.mockClear();

    const duplicateInstanceRes = await applyRecommendedFixAction({
      sourceSnapshotVersion: "2026-11-19:race-v1",
      date: "2026-11-19",
      actionType: "swap_therapist",
      targetBookingId: BOOKING_A,
      proposedStaffId: STAFF_SWAP,
    });
    expect(duplicateInstanceRes.success).toBe(false);
    if (!duplicateInstanceRes.success) {
      expect(duplicateInstanceRes.code).toBe("CONFLICT_ALREADY_RESOLVED");
    }
    expect(state.assignTherapistMock).not.toHaveBeenCalled();
  });
});
