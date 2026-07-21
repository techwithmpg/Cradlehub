/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSWRConfig } from "swr";
import {
  RetainedWorkspaceModule,
  RetainedWorkspaceProvider,
} from "@/components/features/dashboard/retained-workspace-provider";
import { resolveWorkspaceModule } from "@/components/features/dashboard/workspace-retention-policy";
import { useWorkspaceReactivationRefresh } from "@/components/features/dashboard/use-workspace-visibility";
import { notifyWorkspaceNavigation } from "@/components/features/dashboard/workspace-navigation-events";
import { notifyBookingsChanged } from "@/lib/bookings/bookings-client-events";

let pathname = "/crm/today";
let search = new URLSearchParams();
const routerPush = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useSearchParams: () => search,
  useRouter: () => ({ push: routerPush }),
}));

const lifecycle = {
  mounted: vi.fn(),
  cleaned: vi.fn(),
};
let observedSWRCache: ReturnType<typeof useSWRConfig>["cache"] | null = null;

function CacheProbe() {
  const { cache } = useSWRConfig();
  useEffect(() => {
    observedSWRCache = cache;
    cache.set("/sensitive-retained-test", { data: "retained" });
  }, [cache]);
  return <div>cache probe</div>;
}

function StatefulModule({ name }: { name: string }) {
  const [selection, setSelection] = useState(0);
  useEffect(() => {
    lifecycle.mounted(name);
    return () => lifecycle.cleaned(name);
  }, [name]);

  return (
    <section>
      <h1>{name}</h1>
      <button type="button" onClick={() => setSelection((value) => value + 1)}>
        selection {selection}
      </button>
    </section>
  );
}

function RefreshModule({
  name,
  refresh,
}: {
  name: string;
  refresh: () => Promise<void>;
}) {
  useWorkspaceReactivationRefresh(refresh);
  return <h1>{name}</h1>;
}

function renderWorkspace(child: React.ReactNode, userId = "user-1") {
  const descriptor = resolveWorkspaceModule("crm", pathname, search);
  return (
    <main data-testid="workspace-main">
      <RetainedWorkspaceProvider
        workspace="crm"
        userId={userId}
        role="crm"
        branchId="branch-1"
        enabled
      >
        {descriptor ? (
          <RetainedWorkspaceModule moduleId={descriptor.moduleId}>
            {child}
          </RetainedWorkspaceModule>
        ) : child}
      </RetainedWorkspaceProvider>
    </main>
  );
}

beforeEach(() => {
  pathname = "/crm/today";
  search = new URLSearchParams();
  lifecycle.mounted.mockReset();
  lifecycle.cleaned.mockReset();
  routerPush.mockReset();
  observedSWRCache = null;
  window.requestAnimationFrame = (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  };
});

afterEach(cleanup);

describe("RetainedWorkspaceProvider", () => {
  it("hides the first module, pauses its effect, and reveals the same state on return", async () => {
    const view = render(renderWorkspace(<StatefulModule name="Work Queue" />));
    fireEvent.click(screen.getByRole("button", { name: "selection 0" }));
    expect(screen.getByRole("button", { name: "selection 1" })).toBeTruthy();

    pathname = "/crm/bookings";
    view.rerender(renderWorkspace(<StatefulModule name="Bookings" />));
    await waitFor(() => expect(lifecycle.cleaned).toHaveBeenCalledWith("Work Queue"));

    const hiddenWorkQueue = screen.getByText("Work Queue").closest(
      "[data-retained-workspace-module]"
    );
    expect(hiddenWorkQueue?.hasAttribute("hidden")).toBe(true);
    expect(hiddenWorkQueue?.getAttribute("aria-hidden")).toBe("true");
    expect(hiddenWorkQueue?.hasAttribute("inert")).toBe(true);

    pathname = "/crm/today";
    view.rerender(renderWorkspace(<StatefulModule name="Work Queue" />));
    expect(screen.getByRole("button", { name: "selection 1" })).toBeTruthy();
    await waitFor(() => {
      expect(lifecycle.mounted.mock.calls.filter(([name]) => name === "Work Queue")).toHaveLength(2);
    });
  });

  it("clears retained component state when the authenticated scope changes", () => {
    const view = render(renderWorkspace(<StatefulModule name="Work Queue" />));
    fireEvent.click(screen.getByRole("button", { name: "selection 0" }));
    expect(screen.getByRole("button", { name: "selection 1" })).toBeTruthy();

    view.rerender(renderWorkspace(<StatefulModule name="Work Queue" />, "user-2"));
    expect(screen.getByRole("button", { name: "selection 0" })).toBeTruthy();
  });

  it("purges the shared SWR cache when the authenticated workspace unmounts", async () => {
    const view = render(
      <RetainedWorkspaceProvider
        workspace="crm"
        userId="user-1"
        role="crm"
        branchId="branch-1"
        enabled
      >
        <CacheProbe />
      </RetainedWorkspaceProvider>
    );
    await waitFor(() =>
      expect(observedSWRCache?.get("/sensitive-retained-test")).toMatchObject({
        data: "retained",
      })
    );

    view.rerender(
      <RetainedWorkspaceProvider
        workspace="crm"
        userId="user-1"
        role="crm"
        branchId="branch-1"
        enabled={false}
      >
        <div>signed out</div>
      </RetainedWorkspaceProvider>
    );
    await waitFor(() =>
      expect(observedSWRCache?.get("/sensitive-retained-test")).toBeUndefined()
    );
  });

  it("falls back to ordinary route rendering when the rollout flag is disabled", () => {
    render(
      <RetainedWorkspaceProvider
        workspace="crm"
        userId="user-1"
        role="crm"
        branchId="branch-1"
        enabled={false}
      >
        <div>ordinary workspace</div>
      </RetainedWorkspaceProvider>
    );
    expect(screen.getByText("ordinary workspace")).toBeTruthy();
    expect(document.querySelector("[data-retained-workspace-module]")).toBeNull();
  });

  it("refreshes a dirty hidden module once on predictive reactivation", async () => {
    const refreshWorkQueue = vi.fn().mockResolvedValue(undefined);
    const view = render(
      renderWorkspace(<RefreshModule name="Work Queue" refresh={refreshWorkQueue} />)
    );

    pathname = "/crm/bookings";
    view.rerender(renderWorkspace(<StatefulModule name="Bookings" />));
    act(() => notifyBookingsChanged());
    expect(refreshWorkQueue).not.toHaveBeenCalled();

    act(() => notifyWorkspaceNavigation("/crm/today"));
    expect(screen.getByRole("heading", { name: "Work Queue" })).toBeTruthy();
    await waitFor(() => expect(refreshWorkQueue).toHaveBeenCalledTimes(1));
  });

  it("does not refetch a fresh retained module on predictive reactivation", async () => {
    const refreshWorkQueue = vi.fn().mockResolvedValue(undefined);
    const view = render(
      renderWorkspace(<RefreshModule name="Work Queue" refresh={refreshWorkQueue} />)
    );
    pathname = "/crm/bookings";
    view.rerender(renderWorkspace(<StatefulModule name="Bookings" />));

    act(() => notifyWorkspaceNavigation("/crm/today"));
    await act(async () => Promise.resolve());
    expect(refreshWorkQueue).not.toHaveBeenCalled();
  });

  it("reopens a retained module with its last canonical query state", async () => {
    search = new URLSearchParams("filter=exceptions");
    const view = render(renderWorkspace(<StatefulModule name="Work Queue" />));

    pathname = "/crm/bookings";
    search = new URLSearchParams();
    view.rerender(
      renderWorkspace(
        <>
          <StatefulModule name="Bookings" />
          <Link href="/crm/today">Return to Work Queue</Link>
        </>
      )
    );
    await waitFor(() => screen.getByRole("link", { name: "Return to Work Queue" }));

    fireEvent.click(screen.getByRole("link", { name: "Return to Work Queue" }));
    expect(routerPush).toHaveBeenCalledWith("/crm/today?filter=exceptions");
  });

  it("restores module scroll and keeps the mounted count within the CRM LRU limit", async () => {
    const view = render(renderWorkspace(<StatefulModule name="Work Queue" />));
    const main = screen.getByTestId("workspace-main");
    main.scrollTop = 210;

    act(() => notifyWorkspaceNavigation("/crm/bookings"));
    pathname = "/crm/bookings";
    view.rerender(renderWorkspace(<StatefulModule name="Bookings" />));
    main.scrollTop = 35;
    act(() => notifyWorkspaceNavigation("/crm/today"));
    pathname = "/crm/today";
    view.rerender(renderWorkspace(<StatefulModule name="Work Queue" />));
    await waitFor(() => expect(main.scrollTop).toBe(210));

    for (const [nextPath, name] of [
      ["/crm/bookings", "Bookings"],
      ["/crm/schedule", "Schedule"],
      ["/crm/attendance", "Attendance"],
      ["/crm/customers", "Customers"],
    ] as const) {
      act(() => notifyWorkspaceNavigation(nextPath));
      pathname = nextPath;
      view.rerender(renderWorkspace(<StatefulModule name={name} />));
    }
    expect(document.querySelectorAll("[data-retained-workspace-module]")).toHaveLength(4);
    expect(document.querySelector('[data-retained-workspace-module="crm-work-queue"]')).toBeNull();
  });
});
