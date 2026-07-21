import { describe, expect, it } from "vitest";
import {
  createWorkspaceRegistryState,
  reduceWorkspaceRegistry,
  type WorkspaceRegistryState,
} from "@/components/features/dashboard/workspace-module-registry";
import {
  resolveWorkspaceModule,
  retainedModuleKey,
  WORKSPACE_RETENTION_LIMITS,
} from "@/components/features/dashboard/workspace-retention-policy";

const SCOPE = "user-1:crm:branch-1";

function activate(
  state: WorkspaceRegistryState,
  pathname: string,
  at: number,
  node = pathname
): WorkspaceRegistryState {
  const descriptor = resolveWorkspaceModule("crm", pathname);
  if (!descriptor) throw new Error(`Missing test policy for ${pathname}`);
  const previousScrollTop =
    state.entries.find((entry) => entry.key === state.activeKey)?.scrollTop ?? 0;
  return reduceWorkspaceRegistry(state, {
    type: "activate-server",
    key: retainedModuleKey(SCOPE, descriptor),
    descriptor,
    role: "crm",
    branchId: "branch-1",
    node,
    at,
    previousScrollTop,
  });
}

describe("retained workspace registry", () => {
  it("activates modules, keeps their nodes, and restores the retained instance", () => {
    let state = createWorkspaceRegistryState(WORKSPACE_RETENTION_LIMITS.crm);
    state = activate(state, "/crm/today", 1, "work-queue-instance");
    const workQueueKey = state.activeKey;
    state = reduceWorkspaceRegistry(state, {
      type: "save-scroll",
      key: workQueueKey!,
      scrollTop: 420,
    });
    state = activate(state, "/crm/bookings", 2, "bookings-instance");

    expect(state.entries).toHaveLength(2);
    expect(state.entries.find((entry) => entry.key === workQueueKey)).toMatchObject({
      node: "work-queue-instance",
      scrollTop: 420,
    });

    state = reduceWorkspaceRegistry(state, {
      type: "activate-retained",
      key: workQueueKey!,
      at: 3,
      previousScrollTop: 75,
    });
    expect(state.activeKey).toBe(workQueueKey);
    expect(state.entries.find((entry) => entry.key === workQueueKey)?.node).toBe(
      "work-queue-instance"
    );
  });

  it("enforces LRU eviction and removes the oldest eligible module", () => {
    let state = createWorkspaceRegistryState(2);
    state = activate(state, "/crm/today", 1);
    const workQueueKey = state.activeKey!;
    state = activate(state, "/crm/bookings", 2);
    state = activate(state, "/crm/schedule", 3);

    expect(state.entries.map((entry) => entry.moduleId)).toEqual([
      "crm-bookings",
      "crm-schedule",
    ]);
    expect(Object.values(state.restoration).map((entry) => entry.moduleId)).toContain(
      "crm-work-queue"
    );

    state = reduceWorkspaceRegistry(state, {
      type: "restore-evicted",
      key: workQueueKey,
      at: 4,
      previousScrollTop: 0,
    });
    expect(state.activeKey).toBe(workQueueKey);
    expect(state.entries.find((entry) => entry.key === workQueueKey)?.node).toBe(
      "/crm/today"
    );
    expect(state.entries).toHaveLength(2);
  });

  it("does not evict dirty or unsaved modules", () => {
    let state = createWorkspaceRegistryState(2);
    state = activate(state, "/crm/today", 1);
    const protectedKey = state.activeKey!;
    state = reduceWorkspaceRegistry(state, {
      type: "mark-dirty",
      moduleIds: ["crm-work-queue"],
    });
    state = reduceWorkspaceRegistry(state, {
      type: "set-unsaved",
      key: protectedKey,
      unsaved: true,
    });
    state = activate(state, "/crm/bookings", 2);
    state = activate(state, "/crm/schedule", 3);

    expect(state.entries.some((entry) => entry.key === protectedKey)).toBe(true);
    expect(state.entries.map((entry) => entry.moduleId)).toEqual([
      "crm-work-queue",
      "crm-schedule",
    ]);
  });

  it("clears retained operational state without browser storage", () => {
    let state = createWorkspaceRegistryState(4);
    state = activate(state, "/crm/today", 1);
    state = reduceWorkspaceRegistry(state, { type: "clear" });
    expect(state).toEqual({ activeKey: null, entries: [], limit: 4, restoration: {} });
  });

  it("normalizes URL restoration state without creating extra module instances", () => {
    const first = resolveWorkspaceModule(
      "crm",
      "/crm/bookings",
      "status=confirmed&date=2026-07-21&transient=ignored"
    );
    const second = resolveWorkspaceModule(
      "crm",
      "/crm/bookings",
      "date=2026-07-21&status=confirmed"
    );
    expect(first?.stableSearchState).toBe("date=2026-07-21&status=confirmed");
    expect(first && retainedModuleKey(SCOPE, first)).toBe(
      second && retainedModuleKey(SCOPE, second)
    );
  });
});
