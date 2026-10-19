/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { StaffInstallPrompt } from "@/components/features/staff-pwa/install-prompt";

describe("Staff install prompt", () => {
  let standalone = false;

  beforeEach(() => {
    standalone = false;
    vi.stubGlobal("matchMedia", () => ({ matches: standalone }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows an available browser install prompt and hides it after installation", () => {
    render(<StaffInstallPrompt />);
    expect(screen.queryByRole("complementary", { name: "App installation banner" })).toBeNull();

    const installEvent = new Event("beforeinstallprompt", { cancelable: true });
    act(() => window.dispatchEvent(installEvent));
    expect(installEvent.defaultPrevented).toBe(true);
    expect(screen.getByRole("complementary", { name: "App installation banner" })).toBeTruthy();

    act(() => window.dispatchEvent(new Event("appinstalled")));
    expect(screen.queryByRole("complementary", { name: "App installation banner" })).toBeNull();
  });

  it("does not show the install banner in standalone mode", () => {
    standalone = true;
    render(<StaffInstallPrompt />);
    act(() => window.dispatchEvent(new Event("beforeinstallprompt", { cancelable: true })));
    expect(screen.queryByRole("complementary", { name: "App installation banner" })).toBeNull();
  });
});
