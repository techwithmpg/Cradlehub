import "server-only";

import { logError } from "@/lib/logger";
import {
  evaluateUnifiedOperationsFallback,
  solveOnsiteFallback,
} from "./fallback-evaluator";
import { loadUnifiedOperationalSnapshot } from "./snapshot-loader";
import {
  onsiteSolveRequestSchema,
  onsiteSolveResponseSchema,
  unifiedEvaluateResponseSchema,
  type OnsiteSolveRequest,
  type OnsiteSolveResult,
  type UnifiedEvaluateRequest,
  type UnifiedEvaluationResult,
} from "./types";

const OPTIMIZER_TIMEOUT_MS = 3500;
const EVAL_CACHE_TTL_MS = 15_000;

type CacheEntry = {
  expiresAt: number;
  result: UnifiedEvaluationResult;
};

const evalCache = new Map<string, CacheEntry>();

function optimizerBaseUrl(): string | null {
  const raw = process.env.CRADLEHUB_OPTIMIZER_URL?.trim();
  return raw ? raw.replace(/\/+$/, "") : null;
}

async function callPythonJson<T>(
  path: string,
  payload: unknown
): Promise<T | null> {
  const baseUrl = optimizerBaseUrl();
  if (!baseUrl) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPTIMIZER_TIMEOUT_MS);
  try {
    const resp = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!resp.ok) {
      logError("optimization.python_http_error", { path, status: resp.status });
      return null;
    }
    return (await resp.json()) as T;
  } catch (err) {
    logError("optimization.python_unreachable_fallback", {
      path,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function solveOnsiteWithEngine(
  request: OnsiteSolveRequest
): Promise<OnsiteSolveResult> {
  const validated = onsiteSolveRequestSchema.parse(request);
  const remoteRaw = await callPythonJson<unknown>("/v1/onsite/solve", validated);
  if (remoteRaw !== null) {
    const parsed = onsiteSolveResponseSchema.safeParse(remoteRaw);
    if (parsed.success) {
      return { ...parsed.data, engineSource: "python_ortools" };
    }
    logError("optimization.onsite_invalid_python_payload", {
      issues: parsed.error.issues.slice(0, 3),
    });
  }
  return {
    ...solveOnsiteFallback(validated),
    engineSource: "ts_deterministic_fallback",
  };
}

export async function evaluateUnifiedOperationsWithEngine(
  request: UnifiedEvaluateRequest
): Promise<UnifiedEvaluationResult> {
  const remoteRaw = await callPythonJson<unknown>("/v1/unified/evaluate", request);
  if (remoteRaw !== null) {
    const parsed = unifiedEvaluateResponseSchema.safeParse(remoteRaw);
    if (parsed.success) {
      return {
        ...parsed.data,
        branchName: request.branch_name,
        engineSource: "python_ortools",
      };
    }
    logError("optimization.unified_invalid_python_payload", {
      issues: parsed.error.issues.slice(0, 3),
    });
  }
  return {
    ...evaluateUnifiedOperationsFallback(request),
    branchName: request.branch_name,
    engineSource: "ts_deterministic_fallback",
  };
}

export async function evaluateBranchOperationsCached(params: {
  branchId: string;
  date?: string;
  bypassCache?: boolean;
}): Promise<UnifiedEvaluationResult> {
  const snapshot = await loadUnifiedOperationalSnapshot({
    branchId: params.branchId,
    date: params.date,
  });

  const cacheKey = `${params.branchId}:${snapshot.request.date}:${snapshot.request.source_snapshot_version}`;
  if (!params.bypassCache) {
    const hit = evalCache.get(cacheKey);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.result;
    }
  }

  const result = await evaluateUnifiedOperationsWithEngine(snapshot.request);
  evalCache.set(cacheKey, { expiresAt: Date.now() + EVAL_CACHE_TTL_MS, result });
  if (evalCache.size > 40) {
    const firstKey = evalCache.keys().next().value;
    if (firstKey) evalCache.delete(firstKey);
  }
  return result;
}

export function clearOptimizationEvaluationCache(): void {
  evalCache.clear();
}
