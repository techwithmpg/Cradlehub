import "server-only";

import * as logger from "@/lib/logger";
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
const inFlightEvals = new Map<string, Promise<UnifiedEvaluationResult>>();

export function safeLogError(event: string, context?: Record<string, unknown>): void {
  try {
    logger.logError(event, context);
  } catch {
    console.error(event, context);
  }
}

function optimizerBaseUrl(): string | null {
  const raw = process.env.CRADLEHUB_OPTIMIZER_URL?.trim();
  return raw ? raw.replace(/\/+$/, "") : null;
}

async function callPythonJsonDetailed<T>(
  path: string,
  payload: unknown,
  timeoutMs = OPTIMIZER_TIMEOUT_MS
): Promise<{
  data: T | null;
  configured: boolean;
  fallbackReason: string | null;
}> {
  const baseUrl = optimizerBaseUrl();
  if (!baseUrl) {
    return { data: null, configured: false, fallbackReason: null };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!resp.ok) {
      safeLogError("optimization.python_http_error", { path, status: resp.status });
      return {
        data: null,
        configured: true,
        fallbackReason: `Optimizer service returned HTTP ${resp.status}; running local safety checks only.`,
      };
    }
    return {
      data: (await resp.json()) as T,
      configured: true,
      fallbackReason: null,
    };
  } catch (err) {
    safeLogError("optimization.python_unreachable_fallback", {
      path,
      error: err instanceof Error ? err.message : String(err),
    });
    const isAbort = err instanceof Error && err.name === "AbortError";
    return {
      data: null,
      configured: true,
      fallbackReason: isAbort
        ? "Optimizer service timed out; running local safety checks only."
        : "Optimizer service unreachable; running local safety checks only.",
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function solveOnsiteWithEngine(
  request: OnsiteSolveRequest
): Promise<OnsiteSolveResult> {
  const validated = onsiteSolveRequestSchema.parse(request);
  const remoteRes = await callPythonJsonDetailed<unknown>("/v1/onsite/solve", validated);
  if (remoteRes.data !== null) {
    const parsed = onsiteSolveResponseSchema.safeParse(remoteRes.data);
    if (parsed.success) {
      return { ...parsed.data, engineSource: "python_ortools" };
    }
    safeLogError("optimization.onsite_invalid_python_payload", {
      issues: parsed.error.issues.slice(0, 3),
    });
  }
  return {
    ...solveOnsiteFallback(validated),
    engineSource: "ts_deterministic_fallback",
  };
}

export async function evaluateUnifiedOperationsWithEngine(
  request: UnifiedEvaluateRequest,
  options?: { timeoutMs?: number }
): Promise<UnifiedEvaluationResult> {
  const evaluatedAt = new Date().toISOString();
  const remoteRes = await callPythonJsonDetailed<unknown>(
    "/v1/unified/evaluate",
    request,
    options?.timeoutMs ?? OPTIMIZER_TIMEOUT_MS
  );
  let degradedReason = remoteRes.fallbackReason;

  if (remoteRes.data !== null) {
    const parsed = unifiedEvaluateResponseSchema.safeParse(remoteRes.data);
    if (parsed.success) {
      return {
        ...parsed.data,
        branchName: request.branch_name,
        engineSource: "python_ortools",
        pythonConfigured: remoteRes.configured,
        degraded: false,
        degradedReason: null,
        evaluatedAt,
      };
    }
    safeLogError("optimization.unified_invalid_python_payload", {
      issues: parsed.error.issues.slice(0, 3),
    });
    degradedReason = "Optimizer payload failed schema validation; running local safety checks only.";
  }

  return {
    ...evaluateUnifiedOperationsFallback(request),
    branchName: request.branch_name,
    engineSource: "ts_deterministic_fallback",
    pythonConfigured: remoteRes.configured,
    degraded: Boolean(degradedReason),
    degradedReason,
    evaluatedAt,
  };
}

export async function evaluateBranchOperationsCached(params: {
  branchId: string;
  date?: string;
  bypassCache?: boolean;
  timeoutMs?: number;
}): Promise<UnifiedEvaluationResult> {
  const snapshot = await loadUnifiedOperationalSnapshot({
    branchId: params.branchId,
    date: params.date,
  });

  const cacheKey = `${params.branchId}:${snapshot.request.date}:${snapshot.request.source_snapshot_version}`;
  if (!params.bypassCache) {
    const hit = evalCache.get(cacheKey);
    if (hit && hit.expiresAt > Date.now() && !hit.result.degraded) {
      return hit.result;
    }
  }

  const existingFlight = !params.bypassCache ? inFlightEvals.get(cacheKey) : undefined;
  if (existingFlight) {
    return existingFlight;
  }

  const evalPromise = (async () => {
    const result = await evaluateUnifiedOperationsWithEngine(snapshot.request, {
      timeoutMs: params.timeoutMs,
    });
    evalCache.set(cacheKey, { expiresAt: Date.now() + EVAL_CACHE_TTL_MS, result });
    if (evalCache.size > 40) {
      const firstKey = evalCache.keys().next().value;
      if (firstKey) evalCache.delete(firstKey);
    }
    return result;
  })();

  inFlightEvals.set(cacheKey, evalPromise);
  try {
    return await evalPromise;
  } finally {
    if (inFlightEvals.get(cacheKey) === evalPromise) {
      inFlightEvals.delete(cacheKey);
    }
  }
}

export function invalidateBranchOptimizationCache(branchId: string, date?: string): void {
  const prefix = date ? `${branchId}:${date}:` : `${branchId}:`;
  for (const key of evalCache.keys()) {
    if (key.startsWith(prefix)) {
      evalCache.delete(key);
    }
  }
}

export function clearOptimizationEvaluationCache(): void {
  evalCache.clear();
}
