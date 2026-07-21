/** @vitest-environment jsdom */

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useWorkspaceNotificationRealtime } from "@/components/features/notifications/use-workspace-notification-realtime";
import type { WorkspaceNotification } from "@/lib/notifications/types";

type Handler = (payload: { new: unknown }) => void;

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

const mocks = vi.hoisted(() => {
  const handlers: Array<{ event: string; handler: Handler }> = [];
  let statusHandler: ((status: string) => void) | null = null;
  const channel = {
    on: vi.fn(),
    subscribe: vi.fn(),
  };
  channel.on.mockImplementation(
    (_kind: string, config: { event: string }, handler: Handler) => {
      handlers.push({ event: config.event, handler });
      return channel;
    }
  );
  channel.subscribe.mockImplementation((handler: (status: string) => void) => {
    statusHandler = handler;
    return channel;
  });
  return {
    channel,
    channelFactory: vi.fn(() => channel),
    handlers,
    removeChannel: vi.fn(),
    getStatusHandler: () => statusHandler,
    resetStatusHandler: () => {
      statusHandler = null;
    },
  };
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: mocks.channelFactory,
    removeChannel: mocks.removeChannel,
  }),
}));

function notification(
  overrides: Partial<WorkspaceNotification> = {}
): WorkspaceNotification {
  return {
    action_href: "/crm/bookings?bookingId=11111111-1111-4111-8111-111111111111",
    actor_staff_id: null,
    body: "Massage · today at 4:30 PM",
    branch_id: "11111111-1111-4111-8111-111111111111",
    created_at: new Date().toISOString(),
    dedupe_key: "booking:test:payment",
    entity_id: "11111111-1111-4111-8111-111111111111",
    entity_type: "booking",
    id: "22222222-2222-4222-8222-222222222222",
    metadata: {},
    priority: "high",
    read_at: null,
    recipient_staff_id: null,
    requires_action: true,
    resolved_at: null,
    status: "unread",
    target_role: null,
    target_workspace: "crm",
    title: "New online booking",
    type: "payment_pending",
    ...overrides,
  };
}

beforeEach(() => {
  mocks.handlers.length = 0;
  mocks.channelFactory.mockClear();
  mocks.channel.on.mockClear();
  mocks.channel.subscribe.mockClear();
  mocks.removeChannel.mockClear();
  mocks.resetStatusHandler();
  Object.defineProperty(window, "sessionStorage", {
    configurable: true,
    value: memoryStorage(),
  });
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: memoryStorage(),
  });
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
});

afterEach(cleanup);

describe("useWorkspaceNotificationRealtime", () => {
  it("presents a fresh insert once and still reports it immediately for bell state", () => {
    const onInsert = vi.fn();
    renderHook(() =>
      useWorkspaceNotificationRealtime({
        onInsert,
        onUpdate: vi.fn(),
        onReconcile: vi.fn(),
      })
    );
    const insert = mocks.handlers.find((entry) => entry.event === "INSERT")!;
    const row = notification();

    act(() => insert.handler({ new: row }));
    act(() => insert.handler({ new: row }));

    expect(onInsert).toHaveBeenCalledWith(row, { present: false });
    expect(
      onInsert.mock.calls.filter(([, context]) => context.present === true)
    ).toHaveLength(1);
  });

  it("does not present old unread rows or hidden-tab inserts as new toasts", () => {
    const onInsert = vi.fn();
    const onReconcile = vi.fn();
    renderHook(() =>
      useWorkspaceNotificationRealtime({
        onInsert,
        onUpdate: vi.fn(),
        onReconcile,
      })
    );
    const insert = mocks.handlers.find((entry) => entry.event === "INSERT")!;

    act(() =>
      insert.handler({
        new: notification({ created_at: "2026-01-01T00:00:00.000Z" }),
      })
    );
    expect(onInsert).not.toHaveBeenCalled();
    expect(onReconcile).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    act(() =>
      insert.handler({
        new: notification({ id: "33333333-3333-4333-8333-333333333333" }),
      })
    );
    expect(
      onInsert.mock.calls.filter(([, context]) => context.present === true)
    ).toHaveLength(0);
  });

  it("applies UPDATE events and reconciles after a Realtime reconnect", () => {
    const onUpdate = vi.fn();
    const onReconcile = vi.fn();
    renderHook(() =>
      useWorkspaceNotificationRealtime({
        onInsert: vi.fn(),
        onUpdate,
        onReconcile,
      })
    );
    const update = mocks.handlers.find((entry) => entry.event === "UPDATE")!;
    const row = notification({ status: "read", read_at: new Date().toISOString() });
    act(() => update.handler({ new: row }));
    expect(onUpdate).toHaveBeenCalledWith(row);

    act(() => mocks.getStatusHandler()?.("SUBSCRIBED"));
    expect(onReconcile).not.toHaveBeenCalled();
    act(() => mocks.getStatusHandler()?.("SUBSCRIBED"));
    expect(onReconcile).toHaveBeenCalledTimes(1);
  });
});
