import type { ReactNode } from "react";
import type {
  RetainedModuleId,
  RetainedWorkspace,
  WorkspaceModuleDescriptor,
  WorkspaceRetentionCost,
} from "./workspace-retention-policy";

export type RetainedWorkspaceEntry = {
  key: string;
  workspace: RetainedWorkspace;
  moduleId: RetainedModuleId;
  normalizedRoute: string;
  stableSearchState: string;
  role: string;
  branchId: string;
  lastActivatedAt: number;
  becameActiveAt: number;
  lastRefreshedAt: number;
  dirty: boolean;
  scrollTop: number;
  hasUnsavedChanges: boolean;
  isRefreshing: boolean;
  cost: WorkspaceRetentionCost;
  staleTimeMs: number;
  node: ReactNode;
};

export type WorkspaceRegistryState = {
  activeKey: string | null;
  entries: RetainedWorkspaceEntry[];
  limit: number;
  restoration: Record<string, RetainedWorkspaceEntry>;
};

export type WorkspaceRegistryAction =
  | {
      type: "activate-server";
      key: string;
      descriptor: WorkspaceModuleDescriptor;
      role: string;
      branchId: string;
      node: ReactNode;
      at: number;
      previousScrollTop: number;
    }
  | {
      type: "activate-retained";
      key: string;
      at: number;
      previousScrollTop: number;
      descriptor?: WorkspaceModuleDescriptor;
    }
  | { type: "restore-evicted"; key: string; at: number; previousScrollTop: number }
  | { type: "deactivate"; previousScrollTop: number }
  | { type: "mark-dirty"; moduleIds: readonly RetainedModuleId[] }
  | { type: "mark-clean"; key: string; at: number }
  | { type: "set-refreshing"; key: string; refreshing: boolean }
  | { type: "set-unsaved"; key: string; unsaved: boolean }
  | { type: "save-scroll"; key: string; scrollTop: number }
  | { type: "clear" };

export function createWorkspaceRegistryState(limit: number): WorkspaceRegistryState {
  return { activeKey: null, entries: [], limit, restoration: {} };
}

function rememberEntries(
  restoration: WorkspaceRegistryState["restoration"],
  entries: RetainedWorkspaceEntry[]
): WorkspaceRegistryState["restoration"] {
  const next = { ...restoration };
  for (const entry of entries) {
    next[entry.key] = entry;
  }
  return next;
}

function preservePreviousScroll(
  entries: RetainedWorkspaceEntry[],
  activeKey: string | null,
  scrollTop: number
): RetainedWorkspaceEntry[] {
  if (!activeKey) return entries;
  return entries.map((entry) =>
    entry.key === activeKey && entry.scrollTop !== scrollTop
      ? { ...entry, scrollTop }
      : entry
  );
}

function enforceLimit(
  entries: RetainedWorkspaceEntry[],
  limit: number,
  activeKey: string
): RetainedWorkspaceEntry[] {
  const next = [...entries];
  while (next.length > limit) {
    const candidate = next
      .filter(
        (entry) => entry.key !== activeKey && !entry.hasUnsavedChanges && !entry.dirty
      )
      .sort((left, right) => left.lastActivatedAt - right.lastActivatedAt)[0];
    if (!candidate) break;
    next.splice(next.findIndex((entry) => entry.key === candidate.key), 1);
  }
  return next;
}

export function reduceWorkspaceRegistry(
  state: WorkspaceRegistryState,
  action: WorkspaceRegistryAction
): WorkspaceRegistryState {
  switch (action.type) {
    case "activate-server": {
      const withScroll = preservePreviousScroll(
        state.entries,
        state.activeKey,
        action.previousScrollTop
      );
      const existing = withScroll.find((entry) => entry.key === action.key);
      const restored = state.restoration[action.key];
      const activated: RetainedWorkspaceEntry = existing
        ? {
            ...existing,
            ...action.descriptor,
            role: action.role,
            branchId: action.branchId,
            node: action.node,
            lastActivatedAt: action.at,
            becameActiveAt: state.activeKey === action.key ? existing.becameActiveAt : action.at,
            lastRefreshedAt: action.at,
            dirty: false,
            isRefreshing: false,
          }
        : {
            key: action.key,
            ...action.descriptor,
            role: action.role,
            branchId: action.branchId,
            node: action.node,
            lastActivatedAt: action.at,
            becameActiveAt: action.at,
            lastRefreshedAt: action.at,
            dirty: false,
            scrollTop: restored?.scrollTop ?? 0,
            hasUnsavedChanges: false,
            isRefreshing: false,
          };
      const entries = withScroll.filter((entry) => entry.key !== action.key);
      entries.push(activated);
      return {
        ...state,
        activeKey: action.key,
        entries: enforceLimit(entries, state.limit, action.key),
        restoration: rememberEntries(state.restoration, entries),
      };
    }

    case "activate-retained": {
      const target = state.entries.find((entry) => entry.key === action.key);
      if (!target) return state;
      const withScroll = preservePreviousScroll(
        state.entries,
        state.activeKey,
        action.previousScrollTop
      );
      const entries = withScroll.map((entry) =>
        entry.key === action.key
          ? {
              ...entry,
              ...action.descriptor,
              lastActivatedAt: action.at,
              becameActiveAt: state.activeKey === action.key ? entry.becameActiveAt : action.at,
            }
          : entry
      );
      return {
        ...state,
        activeKey: action.key,
        entries,
        restoration: rememberEntries(state.restoration, entries),
      };
    }

    case "restore-evicted": {
      const restored = state.restoration[action.key];
      if (!restored) return state;
      const withScroll = preservePreviousScroll(
        state.entries,
        state.activeKey,
        action.previousScrollTop
      );
      const activated = {
        ...restored,
        lastActivatedAt: action.at,
        becameActiveAt: action.at,
        isRefreshing: false,
      };
      const entries = [...withScroll, activated];
      return {
        ...state,
        activeKey: action.key,
        entries: enforceLimit(entries, state.limit, action.key),
        restoration: rememberEntries(state.restoration, entries),
      };
    }

    case "deactivate": {
      const entries = preservePreviousScroll(
        state.entries,
        state.activeKey,
        action.previousScrollTop
      );
      return {
        ...state,
        activeKey: null,
        entries,
        restoration: rememberEntries(state.restoration, entries),
      };
    }

    case "mark-dirty": {
      const affected = new Set(action.moduleIds);
      return {
        ...state,
        entries: state.entries.map((entry) =>
          affected.has(entry.moduleId) ? { ...entry, dirty: true } : entry
        ),
      };
    }

    case "mark-clean":
      return {
        ...state,
        entries: state.entries.map((entry) =>
          entry.key === action.key
            ? { ...entry, dirty: false, lastRefreshedAt: action.at }
            : entry
        ),
      };

    case "set-refreshing":
      return {
        ...state,
        entries: state.entries.map((entry) =>
          entry.key === action.key ? { ...entry, isRefreshing: action.refreshing } : entry
        ),
      };

    case "set-unsaved":
      return {
        ...state,
        entries: state.entries.map((entry) =>
          entry.key === action.key ? { ...entry, hasUnsavedChanges: action.unsaved } : entry
        ),
      };

    case "save-scroll": {
      const entries = state.entries.map((entry) =>
        entry.key === action.key ? { ...entry, scrollTop: action.scrollTop } : entry
      );
      return {
        ...state,
        entries,
        restoration: rememberEntries(state.restoration, entries),
      };
    }

    case "clear":
      return createWorkspaceRegistryState(state.limit);
  }
}
