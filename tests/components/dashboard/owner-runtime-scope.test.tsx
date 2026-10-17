/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Link from "next/link";
import { useEffect } from "react";
import { useSWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OwnerRuntimeScope } from "@/components/features/dashboard/owner-runtime-scope";
import { RetainedWorkspaceModule } from "@/components/features/dashboard/retained-workspace-provider";
import { useGenerationAwareWorkspaceSWR } from "@/components/features/dashboard/use-workspace-generation";
import { useWorkspaceSWRKey } from "@/components/features/dashboard/workspace-swr-cache";
import { emitWorkspaceDomainEvent } from "@/components/features/dashboard/workspace-domain-events";
import { notifyBookingsChanged } from "@/lib/bookings/bookings-client-events";
import { isRetainedWorkspaceEnabled } from "@/lib/config/mvp-flags";
import type { WorkspaceGenerationStore } from "@/components/features/dashboard/workspace-generation";

const MAIN = "11111111-1111-4111-8111-111111111111";
const SM = "22222222-2222-4222-8222-222222222222";
const branches = [{ id: MAIN, name: "Main" }, { id: SM, name: "SM" }];
let search = new URLSearchParams();
const routerPush = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => "/owner/bookings", useSearchParams: () => search, useRouter: () => ({ push: routerPush }) }));
const fetcher = vi.fn<() => Promise<string>>();
let observedStore: WorkspaceGenerationStore | null = null;
let observedCache: ReturnType<typeof useSWRConfig>["cache"];
function Probe({ label }: { label: string }) {
  const result = useGenerationAwareWorkspaceSWR("owner-bookings", "same-request", fetcher, label);
  const key = useWorkspaceSWRKey(["owner-bookings", "same-request"]);
  const { cache } = useSWRConfig();
  useEffect(() => { observedStore = result.generation.store; observedCache = cache; cache.set("protected", { data: label }); }, [cache, label, result.generation.store]);
  return <><h1>{result.data}</h1><Link href="/owner/bookings">All bookings</Link><output data-testid="key">{JSON.stringify(key)}</output><output data-testid="generation">{result.generation.validatedGeneration}/{result.generation.invalidationGeneration}</output></>;
}
function tree(label: string, enabled = true, userId = "owner-a", role = "owner") {
  return <OwnerRuntimeScope userId={userId} role={role} authorizedBranches={branches} dispatchBranchId={MAIN} enabled={enabled}>
    <RetainedWorkspaceModule moduleId="owner-bookings"><Probe label={label} /></RetainedWorkspaceModule>
  </OwnerRuntimeScope>;
}
beforeEach(() => {
  search = new URLSearchParams({ branch: MAIN });
  fetcher.mockReset();
  routerPush.mockReset();
  observedStore = null;
  window.requestAnimationFrame = (callback: FrameRequestCallback) => { callback(0); return 1; };
  vi.stubEnv("NEXT_PUBLIC_RETAINED_WORKSPACES", "all"); // Isolated activation simulation, never a runtime/env-file change.
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

describe("Owner Main → SM → Main boundary", () => {
  it("does not rewrite an explicit all-branches destination with retained Main search state", () => {
    render(tree("Main retained"));
    // Let the document-level retention handler run, then suppress jsdom's
    // unsupported native navigation at the window boundary.
    window.addEventListener("click", (event) => event.preventDefault(), { once: true });
    fireEvent.click(screen.getByRole("link", { name: "All bookings" }));
    expect(routerPush).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "All bookings" }).getAttribute("href")).toBe("/owner/bookings");
  });
  it("remounts DOM/cache/generations, rejects pending Main writes, and filters branch events", async () => {
    let resolveOld!: (data: string) => void;
    fetcher.mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; })).mockResolvedValue("SM reconciled");
    const view = render(tree("Main retained"));
    const mainKey = screen.getByTestId("key").textContent;
    const mainStore = observedStore!;
    const mainCache = observedCache;
    act(() => emitWorkspaceDomainEvent({ name: "booking.status_changed", branchId: MAIN, payload: {} }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    search = new URLSearchParams({ branch: SM });
    view.rerender(tree("SM retained"));
    expect(screen.queryByText("Main retained")).toBeNull();
    expect(screen.getByRole("heading").textContent).toBe("SM retained");
    expect(screen.getByTestId("key").textContent).not.toBe(mainKey);
    expect(observedStore).not.toBe(mainStore);
    expect(observedCache).not.toBe(mainCache);
    expect(mainCache.get("protected")).toBeUndefined();
    await act(async () => resolveOld("late Main response"));
    expect(screen.queryByText("late Main response")).toBeNull();
    act(() => emitWorkspaceDomainEvent({ name: "booking.status_changed", branchId: MAIN, payload: {} }));
    expect(screen.getByTestId("generation").textContent).toBe("0/0");
    act(() => emitWorkspaceDomainEvent({ name: "booking.status_changed", branchId: SM, payload: {} }));
    await waitFor(() => expect(screen.getByRole("heading").textContent).toBe("SM reconciled"));
    const smStore = observedStore;
    search = new URLSearchParams({ branch: MAIN }); // Back/Forward is resolved from the current URL, not saved local selection.
    view.rerender(tree("Main fresh"));
    expect(screen.getByTestId("key").textContent).toBe(mainKey);
    expect(observedStore).not.toBe(mainStore);
    expect(observedStore).not.toBe(smStore);
    expect(screen.getByTestId("generation").textContent).toBe("0/0");
    expect(screen.queryByText("SM reconciled")).toBeNull();
    expect(screen.getByRole("heading").textContent).toBe("Main fresh");
    view.unmount();
    expect(observedCache.get("protected")).toBeUndefined();
  });

  it("keeps aggregates separate and preserves one legacy invalidation per notification", () => {
    fetcher.mockReturnValue(new Promise(() => undefined));
    search = new URLSearchParams();
    render(tree("Aggregate"));
    expect(screen.getByTestId("key").textContent).toContain("owner:all-branches");
    act(() => emitWorkspaceDomainEvent({ name: "booking.status_changed", branchId: SM, payload: {} }));
    expect(observedStore?.getSnapshot("owner-bookings").invalidationGeneration).toBe(1);
    act(() => notifyBookingsChanged());
    expect(observedStore?.getSnapshot("owner-bookings").invalidationGeneration).toBe(2);
  });

  it.each([["owner-b", "owner"], ["owner-a", "changed-role"]])("clears protected state on identity transition %s/%s", (user, role) => {
    const view = render(tree("Old"));
    const previousCache = observedCache;
    const previousStore = observedStore;
    view.rerender(tree("New", true, user, role));
    expect(previousCache.get("protected")).toBeUndefined();
    expect(observedStore).not.toBe(previousStore);
    expect(screen.queryByText("Old")).toBeNull();
  });

  it("keeps retention off by default while isolating ordinary SWR state across branches", () => {
    vi.stubEnv("NEXT_PUBLIC_RETAINED_WORKSPACES", "crm");
    expect(isRetainedWorkspaceEnabled("owner")).toBe(false);
    const view = render(tree("Main ordinary", false));
    const oldCache = observedCache;
    const oldKey = screen.getByTestId("key").textContent;
    search = new URLSearchParams({ branch: SM });
    view.rerender(tree("SM ordinary", false));
    expect(screen.queryByText("Main ordinary")).toBeNull();
    expect(oldCache.get("protected")).toBeUndefined();
    expect(screen.getByTestId("key").textContent).not.toBe(oldKey);
    expect(observedStore).toBeNull();
    expect(document.querySelector("[data-retained-workspace-module]")).toBeNull();
  });
});
