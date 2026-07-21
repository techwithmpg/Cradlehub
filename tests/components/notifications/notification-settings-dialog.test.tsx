/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationSettingsDialog } from "@/components/features/notifications/notification-settings-dialog";

const requestPermission = vi.fn<() => Promise<NotificationPermission>>();
const getRegistration = vi.fn();

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, String(value)); },
  };
}

function installBrowserPush(permission: NotificationPermission, subscription: unknown = null) {
  vi.stubGlobal("Notification", {
    permission,
    requestPermission,
  });
  vi.stubGlobal("PushManager", function PushManager() {});
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      getRegistration,
      register: vi.fn(),
    },
  });
  getRegistration.mockResolvedValue({
    pushManager: {
      getSubscription: vi.fn().mockResolvedValue(subscription),
    },
  });
}

beforeEach(() => {
  requestPermission.mockReset();
  getRegistration.mockReset();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: memoryStorage(),
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ configured: true }),
    })
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: undefined,
  });
});

describe("NotificationSettingsDialog", () => {
  it("requests browser permission only after the explicit Enable click", async () => {
    installBrowserPush("default");
    requestPermission.mockResolvedValue("denied");
    render(<NotificationSettingsDialog role="crm" />);
    expect(requestPermission).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Notification settings" }));
    const enable = await screen.findByRole("button", {
      name: "Enable browser notifications",
    });
    expect(requestPermission).not.toHaveBeenCalled();
    fireEvent.click(enable);
    await waitFor(() => expect(requestPermission).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText(/Notifications are blocked in browser settings/)
    ).toBeTruthy();
  });

  it("shows unsupported and denied guidance without repeatedly prompting", async () => {
    vi.stubGlobal("Notification", undefined);
    vi.stubGlobal("PushManager", undefined);
    render(<NotificationSettingsDialog role="crm" />);
    fireEvent.click(screen.getByRole("button", { name: "Notification settings" }));
    expect(
      await screen.findByText("Browser notifications are not supported on this device.")
    ).toBeTruthy();
    expect(requestPermission).not.toHaveBeenCalled();

    cleanup();
    installBrowserPush("denied");
    render(<NotificationSettingsDialog role="crm" />);
    fireEvent.click(screen.getByRole("button", { name: "Notification settings" }));
    expect(
      await screen.findByText(/Notifications are blocked in browser settings/)
    ).toBeTruthy();
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it("shows enabled controls when this browser already has a subscription", async () => {
    installBrowserPush("granted", {
      endpoint: "https://push.example.test/device",
      unsubscribe: vi.fn(),
    });
    render(<NotificationSettingsDialog role="crm" />);
    fireEvent.click(screen.getByRole("button", { name: "Notification settings" }));
    expect(await screen.findByText("Browser notifications enabled")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Send test notification" })
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Disable" })).toBeTruthy();
  });
});
