/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SWRConfig } from "swr";
import { createWorkspaceGenerationStore } from "@/components/features/dashboard/workspace-generation";
import { WorkspaceGenerationContext, useGenerationAwareWorkspaceSWR } from "@/components/features/dashboard/use-workspace-generation";
import { WorkspaceSWRScopeContext } from "@/components/features/dashboard/workspace-swr-cache";
import type { WorkspaceRuntimeModuleId } from "@/components/features/dashboard/workspace-domain-events";

afterEach(cleanup);
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const moduleId = "crm-bookings";
function Probe({ fetcher, request = "/bookings", module = moduleId }: { fetcher: () => Promise<string>; request?: string; module?: WorkspaceRuntimeModuleId }) {
  const result = useGenerationAwareWorkspaceSWR(module, request, fetcher, "retained");
  return <>
    <p data-testid="data">{result.data}</p>
    <p data-testid="generation">{result.generation.validatedGeneration}/{result.generation.invalidationGeneration}</p>
    <p data-testid="failure">{result.error instanceof Error ? result.error.message : "none"}</p>
    <button onClick={() => { void result.revalidate().catch(() => undefined); }}>retry</button>
  </>;
}
function fixture() {
  const store = createWorkspaceGenerationStore();
  const cache = new Map();
  const fetcher = vi.fn<() => Promise<string>>();
  const tree = (scope = "user-a:crm:branch-a", request = "/bookings", module: WorkspaceRuntimeModuleId = moduleId) =>
    <SWRConfig value={{ provider: () => cache }}>
      <WorkspaceSWRScopeContext.Provider value={scope}>
        <WorkspaceGenerationContext.Provider value={store}>
          <Probe key={`${scope}:${module}`} module={module} fetcher={fetcher} request={request} />
        </WorkspaceGenerationContext.Provider>
      </WorkspaceSWRScopeContext.Provider>
    </SWRConfig>;
  return { store, cache, fetcher, tree };
}

describe("generation-aware real SWR integration", () => {
  it("makes no hidden requests even on focus/reconnect/manual retry; reveals retained data then reconciles", async () => {
    const { store, fetcher, tree } = fixture();
    const response = deferred<string>();
    fetcher.mockReturnValue(response.promise);
    render(tree());
    act(() => { store.invalidate(moduleId); store.invalidate(moduleId); window.dispatchEvent(new Event("focus")); window.dispatchEvent(new Event("online")); });
    fireEvent.click(screen.getByText("retry"));
    expect(fetcher).not.toHaveBeenCalled();
    expect(screen.getByTestId("data").textContent).toBe("retained");
    act(() => store.setActive(moduleId));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("data").textContent).toBe("retained");
    await act(async () => response.resolve("server"));
    expect(screen.getByTestId("data").textContent).toBe("server");
    expect(screen.getByTestId("generation").textContent).toBe("2/2");
  });

  it("discards an old response and reconciles the newer generation without a blank screen", async () => {
    const { store, fetcher, tree } = fixture();
    const old = deferred<string>();
    const next = deferred<string>();
    fetcher.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    store.setActive(moduleId);
    render(tree());
    act(() => store.invalidate(moduleId));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    act(() => store.invalidate(moduleId));
    await act(async () => old.resolve("stale"));
    expect(screen.getByTestId("data").textContent).toBe("retained");
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    await act(async () => next.resolve("latest"));
    expect(screen.getByTestId("data").textContent).toBe("latest");
    expect(screen.getByTestId("generation").textContent).toBe("2/2");
  });

  it("preserves data on failure without an automatic retry loop; explicit retry succeeds", async () => {
    const { store, fetcher, tree } = fixture();
    fetcher.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce("recovered");
    store.setActive(moduleId);
    render(tree());
    act(() => store.invalidate(moduleId));
    await waitFor(() => expect(screen.getByTestId("failure").textContent).toBe("offline"));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("data").textContent).toBe("retained");
    expect(store.getSnapshot(moduleId).isDirty).toBe(true);
    fireEvent.click(screen.getByText("retry"));
    await waitFor(() => expect(screen.getByTestId("data").textContent).toBe("recovered"));
    expect(store.getSnapshot(moduleId).isDirty).toBe(false);
  });

  it.each(["user-b:crm:branch-a", "user-a:owner:branch-a", "user-a:crm:branch-b"])("keeps cached data isolated for %s", async (scope) => {
    const { store, fetcher, tree } = fixture();
    fetcher.mockResolvedValue("scope-a-data");
    store.setActive(moduleId);
    const view = render(tree());
    fireEvent.click(screen.getByText("retry"));
    await waitFor(() => expect(screen.getByTestId("data").textContent).toBe("scope-a-data"));
    view.rerender(tree(scope));
    expect(screen.getByTestId("data").textContent).toBe("retained");
  });

  it("does not validate a replacement request key with an older request response", async () => {
    const { store, fetcher, tree } = fixture();
    const old = deferred<string>();
    const next = deferred<string>();
    fetcher.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    store.setActive(moduleId);
    const view = render(tree());
    fireEvent.click(screen.getByText("retry"));
    view.rerender(tree(undefined, "/bookings?date=next"));
    await act(async () => old.resolve("wrong day"));
    expect(screen.getByTestId("data").textContent).toBe("retained");
    await act(async () => next.resolve("right day"));
    await waitFor(() => expect(screen.getByTestId("data").textContent).toBe("right day"));
  });

  it("isolates two modules sharing the same request key", async () => {
    const { store, fetcher, tree } = fixture();
    fetcher.mockResolvedValue("bookings-only");
    store.setActive(moduleId);
    const view = render(tree());
    fireEvent.click(screen.getByText("retry"));
    await waitFor(() => expect(screen.getByTestId("data").textContent).toBe("bookings-only"));
    act(() => store.setActive("crm-schedule"));
    view.rerender(tree(undefined, undefined, "crm-schedule"));
    expect(screen.getByTestId("data").textContent).toBe("retained");
  });

  it("reconciles the same dirty generation on reactivation and ignores the hidden request's late failure", async () => {
    const { store, fetcher, tree } = fixture();
    const old = deferred<string>();
    fetcher.mockReturnValueOnce(old.promise).mockResolvedValueOnce("reactivated");
    store.setActive(moduleId);
    render(tree());
    act(() => store.invalidate(moduleId));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    act(() => store.setActive(null));
    expect(screen.getByTestId("data").textContent).toBe("retained");
    act(() => store.setActive(moduleId));
    await waitFor(() => expect(screen.getByTestId("data").textContent).toBe("reactivated"));
    await act(async () => old.reject(new Error("obsolete failure")));
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("failure").textContent).toBe("none");
    expect(screen.getByTestId("generation").textContent).toBe("1/1");
  });
});
