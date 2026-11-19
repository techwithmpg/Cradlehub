import "server-only";

import { after } from "next/server";
import { getBranchBusinessDate } from "@/lib/engine/slot-time";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  evaluateBranchOperationsCached,
  invalidateBranchOptimizationCache,
  safeLogError,
} from "./client";
import {
  buildUnavailableOptimizationSummary,
  summarizeOptimizationEvaluation,
  syncCrmOptimizationAlerts,
  type TieredCrmOperationsSummary,
} from "./crm-operations-assistant";
import type { UnifiedEvaluationResult } from "./types";

type CoordinatorState = {
  latestSeq: number;
  rerunRequested: boolean;
  pendingStartedAtMs: number;
  pendingReason: string;
  pendingActorStaffId: string | null;
  inFlight: Promise<void> | null;
};

const coordinators = new Map<string, CoordinatorState>();
const activeDrainSet = new Set<Promise<void>>();
const branchActionMutexes = new Map<string, Promise<void>>();

function keyFor(branchId: string, date: string): string {
  return `${branchId}:${date}`;
}

export async function withBranchOptimizationActionLock<T>(
  branchId: string,
  task: () => Promise<T>
): Promise<T> {
  const prev = branchActionMutexes.get(branchId) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chained = prev.catch(() => undefined).then(() => gate);
  branchActionMutexes.set(branchId, chained);

  await prev.catch(() => undefined);
  try {
    return await task();
  } finally {
    release();
    if (branchActionMutexes.get(branchId) === chained) {
      branchActionMutexes.delete(branchId);
    }
  }
}

export async function broadcastOptimizationOpsUpdated(params: {
  branchId: string;
  date: string;
  sourceSnapshotVersion?: string;
  reason?: string;
}): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return;

  try {
    const admin = createAdminClient();
    const channel = admin.channel(`crm-ops-sync:${params.branchId}`);
    try {
      await channel.httpSend(
        "ops_updated",
        {
          branchId: params.branchId,
          date: params.date,
          sourceSnapshotVersion: params.sourceSnapshotVersion ?? null,
          reason: params.reason ?? "mutation",
          emittedAt: Date.now(),
        },
        { timeout: 1000 }
      );
    } finally {
      await admin.removeChannel(channel);
    }
  } catch {
    // Realtime broadcast is an invalidation hint only; postgres_changes and polling cover fallback.
  }
}

async function runCoordinatorLoop(
  key: string,
  branchId: string,
  date: string
): Promise<void> {
  const state = coordinators.get(key);
  if (!state) return;

  try {
    while (state.rerunRequested) {
      const seq = state.latestSeq;
      const startedAtMs = state.pendingStartedAtMs;
      const reason = state.pendingReason;
      const actorStaffId = state.pendingActorStaffId;
      state.rerunRequested = false;

      try {
        invalidateBranchOptimizationCache(branchId, date);
        const evaluation = await evaluateBranchOperationsCached({
          branchId,
          date,
          bypassCache: true,
        });

        // If a newer operational mutation arrived while solving, skip stale writes and re-evaluate.
        if (seq !== state.latestSeq) {
          state.rerunRequested = true;
          continue;
        }

        await syncCrmOptimizationAlerts({
          evaluation,
          actorStaffId,
          forceSync: true,
          evaluationStartedAtMs: startedAtMs,
        });

        await broadcastOptimizationOpsUpdated({
          branchId,
          date: evaluation.date,
          sourceSnapshotVersion: evaluation.source_snapshot_version,
          reason,
        });
      } catch (err) {
        safeLogError("optimization.auto_reevaluate_failed", {
          branchId,
          date,
          reason,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } finally {
    state.inFlight = null;
    if (!state.rerunRequested && coordinators.get(key) === state) {
      coordinators.delete(key);
    }
  }
}

export function scheduleBranchOptimizationReevaluation(params: {
  branchId?: string | null;
  date?: string | null;
  reason: string;
  actorStaffId?: string | null;
}): void {
  const branchId = params.branchId?.trim();
  if (!branchId) return;

  const date =
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : getBranchBusinessDate();

  invalidateBranchOptimizationCache(branchId, date);

  const key = keyFor(branchId, date);
  let state = coordinators.get(key);
  if (!state) {
    state = {
      latestSeq: 0,
      rerunRequested: false,
      pendingStartedAtMs: Date.now(),
      pendingReason: params.reason,
      pendingActorStaffId: params.actorStaffId ?? null,
      inFlight: null,
    };
    coordinators.set(key, state);
  }

  state.latestSeq += 1;
  state.rerunRequested = true;
  state.pendingStartedAtMs = Date.now();
  state.pendingReason = params.reason;
  state.pendingActorStaffId = params.actorStaffId ?? null;

  if (!state.inFlight) {
    const runPromise = Promise.resolve()
      .then(() => runCoordinatorLoop(key, branchId, date))
      .finally(() => {
        activeDrainSet.delete(runPromise);
      });
    state.inFlight = runPromise;
    activeDrainSet.add(runPromise);
  }

  const activePromise = state.inFlight;
  if (activePromise) {
    try {
      after(() => activePromise);
    } catch {
      // Called outside Next.js request lifecycle (tests, CLI scripts, direct calls); promise runs standalone.
    }
  }
}

export async function drainPendingOptimizationReevaluations(): Promise<void> {
  while (activeDrainSet.size > 0) {
    await Promise.all([...activeDrainSet]);
  }
}

export async function evaluateBranchSummarySafe(params: {
  branchId: string;
  branchName?: string;
  date?: string;
  bypassCache?: boolean;
  syncAlerts?: boolean;
  actorStaffId?: string | null;
  timeoutMs?: number;
}): Promise<{
  ok: boolean;
  summary: TieredCrmOperationsSummary;
  evaluation: UnifiedEvaluationResult | null;
  error?: string;
}> {
  const date = params.date ?? getBranchBusinessDate();
  const startedAtMs = Date.now();
  try {
    const evaluation = await evaluateBranchOperationsCached({
      branchId: params.branchId,
      date,
      bypassCache: params.bypassCache,
      timeoutMs: params.timeoutMs,
    });
    const summary = params.syncAlerts
      ? await syncCrmOptimizationAlerts({
          evaluation,
          actorStaffId: params.actorStaffId,
          forceSync: true,
          evaluationStartedAtMs: startedAtMs,
        })
      : summarizeOptimizationEvaluation(evaluation);
    return { ok: true, summary, evaluation };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not evaluate branch operations.";
    safeLogError("optimization.evaluate_summary_safe_failed", {
      branchId: params.branchId,
      date,
      error: message,
    });
    return {
      ok: false,
      summary: buildUnavailableOptimizationSummary({
        branchId: params.branchId,
        branchName: params.branchName,
        date,
        reason:
          "Operations Assistant could not verify schedule commitments right now. Please retry.",
      }),
      evaluation: null,
      error: message,
    };
  }
}
