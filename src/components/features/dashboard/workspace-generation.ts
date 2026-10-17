import type { WorkspaceRuntimeModuleId } from "./workspace-domain-events";

export type WorkspaceGeneration = {
  invalidationGeneration: number;
  validatedGeneration: number;
  isActive: boolean;
  isDirty: boolean;
  isRefreshing: boolean;
};

export type WorkspaceValidation = Readonly<{ generation: number; requestId: number }>;
export const INITIAL_GENERATION: WorkspaceGeneration = Object.freeze({
  invalidationGeneration: 0, validatedGeneration: 0,
  isActive: false, isDirty: false, isRefreshing: false,
});

/** One instance per authenticated user/role/branch/workspace. Never global. */
export function createWorkspaceGenerationStore() {
  const states = new Map<WorkspaceRuntimeModuleId, WorkspaceGeneration>();
  const validations = new Map<WorkspaceRuntimeModuleId, WorkspaceValidation>();
  const listeners = new Set<() => void>();
  let requestId = 0;
  let connected = true;
  const getSnapshot = (id: WorkspaceRuntimeModuleId) => states.get(id) ?? INITIAL_GENERATION;
  const publish = (id: WorkspaceRuntimeModuleId, patch: Partial<WorkspaceGeneration>) => {
    const next = { ...getSnapshot(id), ...patch };
    next.isDirty = next.invalidationGeneration > next.validatedGeneration;
    states.set(id, next);
  };
  const notify = () => listeners.forEach((listener) => listener());
  const invalidateMany = (ids: readonly WorkspaceRuntimeModuleId[]) => {
    if (!connected) return;
    for (const id of new Set(ids)) publish(id, { invalidationGeneration: getSnapshot(id).invalidationGeneration + 1 });
    notify();
  };
  const isCurrent = (id: WorkspaceRuntimeModuleId, token: WorkspaceValidation) =>
    connected && getSnapshot(id).isActive && validations.get(id) === token &&
    getSnapshot(id).invalidationGeneration === token.generation;
  const finish = (id: WorkspaceRuntimeModuleId, token: WorkspaceValidation, success: boolean) => {
    if (!connected || validations.get(id) !== token) return false;
    const valid = success && isCurrent(id, token);
    validations.delete(id);
    const state = getSnapshot(id);
    publish(id, {
      isRefreshing: false,
      validatedGeneration: valid ? Math.max(state.validatedGeneration, token.generation) : state.validatedGeneration,
    });
    notify();
    return valid;
  };
  return {
    getSnapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    invalidate: (id: WorkspaceRuntimeModuleId) => invalidateMany([id]),
    invalidateMany,
    setActive(id: WorkspaceRuntimeModuleId | null) {
      if (!connected) return;
      let changed = false;
      const ids = new Set([...states.keys(), ...(id ? [id] : [])]);
      for (const candidate of ids) {
        const isActive = candidate === id;
        if (getSnapshot(candidate).isActive === isActive) continue;
        if (!isActive) validations.delete(candidate);
        publish(candidate, { isActive, ...(!isActive ? { isRefreshing: false } : {}) });
        changed = true;
      }
      if (changed) notify();
    },
    beginValidation(id: WorkspaceRuntimeModuleId): WorkspaceValidation | null {
      const state = getSnapshot(id);
      if (!connected || !state.isActive || validations.has(id)) return null;
      // A manual/TTL refresh of a clean module is also an invalidation until proven.
      const generation = state.invalidationGeneration + (state.isDirty ? 0 : 1);
      const token = Object.freeze({ generation, requestId: ++requestId });
      validations.set(id, token);
      publish(id, { invalidationGeneration: generation, isRefreshing: true });
      notify();
      return token;
    },
    isCurrent,
    cancelValidation(id: WorkspaceRuntimeModuleId) {
      if (!validations.delete(id)) return;
      publish(id, { isRefreshing: false });
      notify();
    },
    completeValidation: (id: WorkspaceRuntimeModuleId, token: WorkspaceValidation) => finish(id, token, true),
    failValidation: (id: WorkspaceRuntimeModuleId, token: WorkspaceValidation) => { finish(id, token, false); },
    connect() { connected = true; },
    disconnect() {
      connected = false;
      validations.clear();
      states.clear();
      notify();
    },
  };
}

export type WorkspaceGenerationStore = ReturnType<typeof createWorkspaceGenerationStore>;

/** Fetch has no cache side effects; commit must check the supplied guard at write time. */
export async function reconcileWorkspaceGeneration<T>(
  store: WorkspaceGenerationStore,
  moduleId: WorkspaceRuntimeModuleId,
  fetch: () => Promise<T>,
  commit: (data: T, isCurrent: () => boolean) => Promise<unknown>,
): Promise<"skipped" | "stale" | "validated"> {
  const token = store.beginValidation(moduleId);
  if (!token) return "skipped";
  try {
    const data = await fetch();
    if (!store.isCurrent(moduleId, token)) {
      store.failValidation(moduleId, token);
      return "stale";
    }
    await commit(data, () => store.isCurrent(moduleId, token));
    return store.completeValidation(moduleId, token) ? "validated" : "stale";
  } catch (error) {
    store.failValidation(moduleId, token);
    throw error;
  }
}
