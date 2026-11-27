// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe("WEB-1 /staff/enable-notifications status resolution", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv(
      "NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY",
      "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8"
    );
    Object.defineProperty(window, "isSecureContext", {
      value: true,
      configurable: true,
    });
    Object.defineProperty(window, "PushManager", {
      value: function PushManager() {},
      configurable: true,
    });
    Object.defineProperty(window, "Notification", {
      value: { permission: "default", requestPermission: vi.fn() },
      configurable: true,
    });
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        getRegistration: vi.fn().mockResolvedValue(null),
        register: vi.fn(),
      },
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("transitions from Checking your phone to ready when server push is configured", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ configured: true, activeSubscriptionCount: 0 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    const { default: EnableNotificationsPage } =
      await import("@/app/(dashboard)/staff/enable-notifications/page");
    render(<EnableNotificationsPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Enable notifications" })).toBeTruthy();
    });
    expect(screen.queryByText("Checking your phone…")).toBeNull();
  });

  it("recovers from hung or aborted subscription check with a Retry check control instead of staying stuck", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("Aborted", "AbortError"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ configured: true, activeSubscriptionCount: 0 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const { default: EnableNotificationsPage } =
      await import("@/app/(dashboard)/staff/enable-notifications/page");
    render(<EnableNotificationsPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Retry check" })).toBeTruthy();
    });
    expect(
      screen.getByText("Notification check timed out. Check your connection and tap Retry.")
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Retry check" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Enable notifications" })).toBeTruthy();
    });
  });

  it("transitions to login_required on 401 instead of staying stuck", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    const { default: EnableNotificationsPage } =
      await import("@/app/(dashboard)/staff/enable-notifications/page");
    render(<EnableNotificationsPage />);

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Sign in to CradleHub" })).toBeTruthy();
    });
  });

  it("shows Refresh & send test alert in ready state without enabled_unverified warning when subscription already exists", async () => {
    Object.defineProperty(window, "Notification", {
      value: { permission: "granted", requestPermission: vi.fn() },
      configurable: true,
    });
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        getRegistration: vi.fn().mockResolvedValue({
          pushManager: {
            getSubscription: vi.fn().mockResolvedValue({ endpoint: "https://push.example/sub-1" }),
          },
        }),
        register: vi.fn(),
      },
      configurable: true,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ configured: true, activeSubscriptionCount: 1 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const { default: EnableNotificationsPage } =
      await import("@/app/(dashboard)/staff/enable-notifications/page");
    render(<EnableNotificationsPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Refresh & send test alert" })).toBeTruthy();
    });
    expect(screen.queryByText(/test delivery could not be confirmed/i)).toBeNull();
  });

  it("recovers to failed state with retry button when enable step throws instead of hanging", async () => {
    Object.defineProperty(window, "Notification", {
      value: { permission: "granted", requestPermission: vi.fn().mockResolvedValue("granted") },
      configurable: true,
    });
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        getRegistration: vi.fn().mockResolvedValue(null),
        register: vi.fn().mockRejectedValue(new Error("Notification registration failed.")),
      },
      configurable: true,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ configured: true, activeSubscriptionCount: 0 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const { default: EnableNotificationsPage } =
      await import("@/app/(dashboard)/staff/enable-notifications/page");
    render(<EnableNotificationsPage />);

    const button = await screen.findByRole("button", { name: "Enable notifications" });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("Notification registration failed.")).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: "Enable notifications" })).toBeTruthy();
    expect(screen.queryByText("Connecting your phone…")).toBeNull();
  });
});
