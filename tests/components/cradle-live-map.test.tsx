// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dispatch } from "@/components/features/cradle-live/board-dispatch";
import type { LiveBoardData, LiveTrip } from "@/lib/cradle-live/types";

vi.mock("@/lib/maps/load-dispatch-map", () => ({ loadGoogleMaps: async () => {} }));
vi.mock("@/lib/actions/dispatch-live-map-actions", () => ({ getCrmDriverRouteAction: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href}>{children}</a>
  ),
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Cradle Live driver map reconciliation", () => {
  it("retains the selected driver, marker and viewport across fresh positions", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY", "synthetic");
    const fit = vi.fn(),
      markerCreated = vi.fn(),
      position = vi.fn(),
      mounted = vi.fn();
    class TestMap {
      constructor() {
        mounted();
      }
      fitBounds = fit;
    }
    class Marker {
      constructor() {
        markerCreated();
      }
      setPosition = position;
      setMap = vi.fn();
      setIcon = vi.fn();
      addListener = vi.fn();
    }
    class Bounds {
      extend() {}
    }
    vi.stubGlobal("google", {
      maps: { Map: TestMap, Marker, LatLngBounds: Bounds, SymbolPath: { CIRCLE: 0 } },
    });
    const now = Date.UTC(2026, 10, 19, 0);
    const driver = (id: string): LiveTrip => ({
      id,
      driver: id,
      status: "En route",
      lastLocationAt: new Date(now).toISOString(),
      lat: 10.67,
      lng: 122.95,
      destinationPoint: { lat: 10.68, lng: 122.96 },
    });
    const trips = [driver("A"), driver("B")];
    const board = {
      trips,
      businessDate: "2026-11-19",
      refreshedAt: new Date(now).toISOString(),
    } as LiveBoardData;
    const priorAuthFailure = vi.fn();
    vi.stubGlobal("gm_authFailure", priorAuthFailure);
    const view = render(<Dispatch data={board} now={now} />);
    await waitFor(() => expect(fit).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: /^Select B:/ }));
    await waitFor(() => expect(fit).toHaveBeenCalledTimes(2));
    view.rerender(
      <Dispatch
        data={{ ...board, trips: [{ ...trips[1]!, lat: 10.675 }, trips[0]!] }}
        now={now + 1000}
      />
    );
    expect(screen.getByRole("button", { name: /^Select B:/ }).getAttribute("aria-pressed")).toBe(
      "true"
    );
    expect(position).toHaveBeenCalledWith({ lat: 10.675, lng: 122.95 });
    expect(markerCreated).toHaveBeenCalledTimes(4);
    expect(mounted).toHaveBeenCalledTimes(1);
    expect(fit).toHaveBeenCalledTimes(2);
    act(() => (window as Window & { gm_authFailure: () => void }).gm_authFailure());
    expect(priorAuthFailure).toHaveBeenCalledOnce();
    expect(screen.getByText("Google Maps unavailable for this site")).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Select B:/ })).toBeTruthy();
    view.unmount();
    expect((window as Window & { gm_authFailure: () => void }).gm_authFailure).toBe(
      priorAuthFailure
    );
  });
});
