import { readFileSync } from "node:fs";
import vm from "node:vm";
import { beforeEach, describe, expect, it, vi } from "vitest";

const source = readFileSync("public/cradlehub-push-sw.js", "utf8");

type Listener = (event: {
  data?: { json: () => unknown };
  notification?: { close: () => void; data?: Record<string, unknown> };
  waitUntil: (promise: Promise<unknown>) => void;
}) => void;

function createHarness(windows: Array<Record<string, unknown>> = []) {
  const listeners = new Map<string, Listener>();
  const showNotification = vi.fn().mockResolvedValue(undefined);
  const openWindow = vi.fn().mockResolvedValue(undefined);
  const self = {
    addEventListener: vi.fn((name: string, listener: Listener) => listeners.set(name, listener)),
    skipWaiting: vi.fn(),
    location: { origin: "https://app.cradlehub.test" },
    registration: {
      showNotification,
      pushManager: { subscribe: vi.fn() },
    },
    clients: {
      claim: vi.fn(),
      matchAll: vi.fn().mockResolvedValue(windows),
      openWindow,
    },
  };
  vm.runInNewContext(source, {
    self,
    URL,
    fetch: vi.fn(),
    console,
  });
  return { listeners, openWindow, self, showNotification };
}

beforeEach(() => vi.clearAllMocks());

describe("cradlehub-push-sw", () => {
  it("shows a bounded payload and rejects an external action URL", async () => {
    const harness = createHarness();
    let pending: Promise<unknown> = Promise.resolve();
    harness.listeners.get("push")!({
      data: {
        json: () => ({
          notificationId: "notification-1",
          title: "Booking update",
          body: "Open the booking",
          actionHref: "https://evil.example/phish",
          priority: "high",
        }),
      },
      waitUntil: (promise) => {
        pending = Promise.resolve(promise);
      },
    });
    await pending;

    expect(harness.showNotification).toHaveBeenCalledTimes(1);
    expect(harness.showNotification.mock.calls[0]?.[1]).toMatchObject({
      tag: "cradlehub-notification:notification-1",
      data: { actionHref: "/", notificationId: "notification-1" },
    });
  });

  it("lets a visible RLS-authorized tab reconcile instead of duplicating an OS card", async () => {
    const postMessage = vi.fn();
    const harness = createHarness([{ visibilityState: "visible", postMessage }]);
    let pending: Promise<unknown> = Promise.resolve();
    harness.listeners.get("push")!({
      data: {
        json: () => ({
          notificationId: "notification-2",
          title: "New booking",
          actionHref: "/crm/bookings?bookingId=booking-2",
        }),
      },
      waitUntil: (promise) => {
        pending = Promise.resolve(promise);
      },
    });
    await pending;
    expect(postMessage).toHaveBeenCalledWith({
      type: "CRADLEHUB_PUSH_RECONCILE",
      notificationId: "notification-2",
    });
    expect(harness.showNotification).not.toHaveBeenCalled();
  });

  it("focuses and navigates an existing CradleHub tab, otherwise opens one", async () => {
    const navigate = vi.fn().mockResolvedValue(undefined);
    const focus = vi.fn().mockResolvedValue(undefined);
    const existing = {
      url: "https://app.cradlehub.test/crm",
      visibilityState: "hidden",
      navigate,
      focus,
    };
    const harness = createHarness([existing]);
    let pending: Promise<unknown> = Promise.resolve();
    harness.listeners.get("notificationclick")!({
      notification: {
        close: vi.fn(),
        data: { actionHref: "/crm/bookings?bookingId=booking-3" },
      },
      waitUntil: (promise) => {
        pending = Promise.resolve(promise);
      },
    });
    await pending;
    expect(navigate).toHaveBeenCalledWith(
      "https://app.cradlehub.test/crm/bookings?bookingId=booking-3"
    );
    expect(focus).toHaveBeenCalledTimes(1);
    expect(harness.openWindow).not.toHaveBeenCalled();

    const noWindow = createHarness();
    noWindow.listeners.get("notificationclick")!({
      notification: {
        close: vi.fn(),
        data: { actionHref: "/driver/jobs/booking-4" },
      },
      waitUntil: (promise) => {
        pending = Promise.resolve(promise);
      },
    });
    await pending;
    expect(noWindow.openWindow).toHaveBeenCalledWith(
      "https://app.cradlehub.test/driver/jobs/booking-4"
    );
  });

  it("registers subscription-change recovery", () => {
    const harness = createHarness();
    expect(harness.listeners.has("pushsubscriptionchange")).toBe(true);
  });

  it("does not allow the out-of-scope Manager workspace as a push click target", async () => {
    const harness = createHarness();
    let pending: Promise<unknown> = Promise.resolve();
    harness.listeners.get("push")!({
      data: {
        json: () => ({
          notificationId: "notification-manager",
          title: "Manager route attempt",
          actionHref: "/manager/control",
        }),
      },
      waitUntil: (promise) => {
        pending = Promise.resolve(promise);
      },
    });
    await pending;
    expect(harness.showNotification.mock.calls[0]?.[1]).toMatchObject({
      data: { actionHref: "/" },
    });
  });
});
