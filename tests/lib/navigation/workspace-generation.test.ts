import { describe, expect, it, vi } from "vitest";
import { createWorkspaceGenerationStore, reconcileWorkspaceGeneration } from "@/components/features/dashboard/workspace-generation";
import { affectedWorkspaceModules, WORKSPACE_EVENT_DEPENDENCIES } from "@/components/features/dashboard/workspace-domain-events";

const id = "crm-bookings";
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe("workspace generation contract", () => {
  it("increments each affected module once per event and derives dirty state", () => {
    const store = createWorkspaceGenerationStore();
    expect(store.getSnapshot(id)).toMatchObject({ invalidationGeneration: 0, validatedGeneration: 0, isDirty: false });
    for (let i = 0; i < 10; i++) store.invalidateMany([id, id]);
    expect(store.getSnapshot(id)).toMatchObject({ invalidationGeneration: 10, validatedGeneration: 0, isDirty: true });
    expect(store.getSnapshot("crm-customers").invalidationGeneration).toBe(0);
  });

  it("hidden invalidation makes zero fetches; reactivation validates retained data", async () => {
    const store = createWorkspaceGenerationStore();
    let data = "retained";
    const fetch = vi.fn(async () => "server");
    const commit = vi.fn(async (next: string, current: () => boolean) => { if (current()) data = next; });
    store.invalidate(id);
    expect(await reconcileWorkspaceGeneration(store, id, fetch, commit)).toBe("skipped");
    expect(fetch).not.toHaveBeenCalled();
    expect(data).toBe("retained");
    store.setActive(id);
    expect(data).toBe("retained");
    expect(await reconcileWorkspaceGeneration(store, id, fetch, commit)).toBe("validated");
    expect(data).toBe("server");
    expect(store.getSnapshot(id)).toMatchObject({ invalidationGeneration: 1, validatedGeneration: 1, isDirty: false });
  });

  it("generation 10 cannot commit or validate generation 11", async () => {
    const store = createWorkspaceGenerationStore();
    store.setActive(id);
    for (let i = 0; i < 10; i++) store.invalidate(id);
    const response = deferred<string>();
    const commit = vi.fn(async () => undefined);
    const pending = reconcileWorkspaceGeneration(store, id, () => response.promise, commit);
    store.invalidate(id);
    response.resolve("old");
    expect(await pending).toBe("stale");
    expect(commit).not.toHaveBeenCalled();
    expect(store.getSnapshot(id)).toMatchObject({ invalidationGeneration: 11, validatedGeneration: 0, isDirty: true, isRefreshing: false });
  });

  it("failed refresh preserves prior validated generation and data", async () => {
    const store = createWorkspaceGenerationStore();
    store.setActive(id);
    let data = "retained";
    const first = store.beginValidation(id)!;
    store.completeValidation(id, first);
    store.invalidate(id);
    await expect(reconcileWorkspaceGeneration(store, id, async () => { throw new Error("offline"); }, async (next: string) => { data = next; })).rejects.toThrow("offline");
    expect(data).toBe("retained");
    expect(store.getSnapshot(id)).toMatchObject({ invalidationGeneration: 2, validatedGeneration: 1, isDirty: true });
  });

  it("deduplicates validation and rejects completed or forged tokens", () => {
    const store = createWorkspaceGenerationStore();
    store.setActive(id);
    const token = store.beginValidation(id)!;
    expect(store.beginValidation(id)).toBeNull();
    expect(store.completeValidation(id, { ...token })).toBe(false);
    expect(store.completeValidation(id, token)).toBe(true);
    store.invalidate(id);
    expect(store.completeValidation(id, token)).toBe(false);
    expect(store.getSnapshot(id)).toMatchObject({ invalidationGeneration: 2, validatedGeneration: 1 });
  });

  it("hiding a module invalidates its pending response even if reactivated", async () => {
    const store = createWorkspaceGenerationStore();
    store.setActive(id);
    const response = deferred<string>();
    const commit = vi.fn(async () => undefined);
    const pending = reconcileWorkspaceGeneration(store, id, () => response.promise, commit);
    store.setActive("crm-customers");
    store.setActive(id);
    const latest = store.beginValidation(id)!;
    response.resolve("old");
    expect(await pending).toBe("stale");
    expect(commit).not.toHaveBeenCalled();
    expect(store.isCurrent(id, latest)).toBe(true);
  });

  it("destruction invalidates pending commits and never resurrects an old scope", async () => {
    const store = createWorkspaceGenerationStore();
    store.setActive(id);
    const response = deferred<string>();
    const commit = vi.fn(async () => undefined);
    const pending = reconcileWorkspaceGeneration(store, id, () => response.promise, commit);
    store.disconnect();
    store.connect(); // React StrictMode may reconnect the same provider.
    store.setActive(id);
    response.resolve("private old data");
    expect(await pending).toBe("stale");
    expect(commit).not.toHaveBeenCalled();
  });

  it("rechecks the generation at the asynchronous cache-write boundary", async () => {
    const store = createWorkspaceGenerationStore();
    store.setActive(id);
    let data = "retained";
    const gate = deferred<void>();
    const pending = reconcileWorkspaceGeneration(store, id, async () => "old", async (next, current) => {
      await gate.promise;
      if (current()) data = next;
    });
    await Promise.resolve();
    store.invalidate(id);
    gate.resolve();
    expect(await pending).toBe("stale");
    expect(data).toBe("retained");
  });
});

describe("semantic dependency mapping", () => {
  const scope = { workspace: "crm" as const, branchId: "branch-a", role: "crm" };
  it("targets status and payment consumers without invalidating unrelated modules", () => {
    expect(affectedWorkspaceModules({ name: "booking.status_changed", branchId: "branch-a", payload: {} }, scope)).toEqual(["crm-work-queue", "crm-bookings"]);
    expect(affectedWorkspaceModules({ name: "booking.payment_changed", branchId: "branch-a", payload: {} }, scope)).toContain("crm-cash-flow");
    expect(affectedWorkspaceModules({ name: "attendance.changed", branchId: "branch-a", payload: {} }, scope)).toEqual(["crm-attendance", "crm-schedule"]);
  });
  it("rejects other branches and defines invalidate-only authority for every event", () => {
    expect(affectedWorkspaceModules({ name: "customer.changed", branchId: "branch-b", payload: {} }, scope)).toEqual([]);
    for (const entry of Object.values(WORKSPACE_EVENT_DEPENDENCIES)) {
      expect(entry.tacticalPatch).toBe("invalidate-only");
      expect(new Set(entry.crm).size).toBe(entry.crm.length);
      expect(new Set(entry.owner).size).toBe(entry.owner.length);
    }
  });
});
