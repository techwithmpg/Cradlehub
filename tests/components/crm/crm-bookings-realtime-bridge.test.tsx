/** @vitest-environment jsdom */

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CrmBookingsRealtimeBridge } from "@/components/features/bookings/crm-bookings-realtime-bridge";
import { BOOKINGS_CHANGED_EVENT } from "@/lib/bookings/bookings-client-events";

const realtime = vi.hoisted(() => ({
  handlers: [] as Array<{
    event: string;
    filter: string;
    table: string;
    handler: () => void;
  }>,
  subscribeCallback: null as ((status: string) => void) | null,
  removeChannel: vi.fn(),
  channelNames: [] as string[],
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => {
    const channel = {
      on: (
        _topic: string,
        config: { event: string; filter: string; table: string },
        handler: () => void,
      ) => {
        realtime.handlers.push({ ...config, handler });
        return channel;
      },
      subscribe: (callback: (status: string) => void) => {
        realtime.subscribeCallback = callback;
        return channel;
      },
    };
    return {
      channel: (name: string) => {
        realtime.channelNames.push(name);
        return channel;
      },
      removeChannel: realtime.removeChannel,
    };
  },
}));

describe("CrmBookingsRealtimeBridge", () => {
  const onBookingChange = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    realtime.handlers.length = 0;
    realtime.channelNames.length = 0;
    realtime.subscribeCallback = null;
    window.addEventListener(BOOKINGS_CHANGED_EVENT, onBookingChange);
  });

  afterEach(() => {
    cleanup();
    window.removeEventListener(BOOKINGS_CHANGED_EVENT, onBookingChange);
    vi.useRealTimers();
  });

  it("subscribes only to branch-scoped booking inserts and updates", () => {
    render(<CrmBookingsRealtimeBridge branchId="branch-a" />);

    expect(realtime.channelNames).toEqual(["crm-booking-reconciliation:branch-a"]);
    expect(realtime.handlers.map(({ event }) => event)).toEqual(["INSERT", "UPDATE"]);
    for (const handler of realtime.handlers) {
      expect(handler.filter).toBe("branch_id=eq.branch-a");
      expect(handler.table).toBe("bookings");
    }
  });

  it("invalidates CRM data once for a burst of public and CRM booking writes", () => {
    render(<CrmBookingsRealtimeBridge branchId="branch-a" />);

    act(() => {
      realtime.handlers[0]!.handler(); // public INSERT
      realtime.handlers[1]!.handler(); // CRM UPDATE
      vi.advanceTimersByTime(200);
    });

    expect(onBookingChange).toHaveBeenCalledTimes(1);
  });

  it("reconciles after subscribing, reconnecting, and returning online", () => {
    render(<CrmBookingsRealtimeBridge branchId="branch-a" />);

    act(() => {
      realtime.subscribeCallback?.("SUBSCRIBED");
      vi.advanceTimersByTime(200);
    });
    expect(onBookingChange).toHaveBeenCalledTimes(1);

    act(() => {
      realtime.subscribeCallback?.("TIMED_OUT");
      vi.advanceTimersByTime(200);
    });
    expect(onBookingChange).toHaveBeenCalledTimes(2);

    act(() => {
      window.dispatchEvent(new Event("online"));
      vi.advanceTimersByTime(200);
    });
    expect(onBookingChange).toHaveBeenCalledTimes(3);
  });

  it("throttles repeated foreground-focus reconciliations without throttling realtime writes", () => {
    render(<CrmBookingsRealtimeBridge branchId="branch-a" />);

    act(() => {
      window.dispatchEvent(new Event("focus"));
      vi.advanceTimersByTime(200);
    });
    expect(onBookingChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(30_000);
      window.dispatchEvent(new Event("focus"));
      vi.advanceTimersByTime(200);
    });
    expect(onBookingChange).toHaveBeenCalledTimes(1);

    act(() => {
      realtime.handlers[0]!.handler();
      vi.advanceTimersByTime(200);
    });
    expect(onBookingChange).toHaveBeenCalledTimes(2);
  });

  it("removes the subscription and prevents stale updates after unmount", () => {
    const view = render(<CrmBookingsRealtimeBridge branchId="branch-a" />);
    const insert = realtime.handlers[0]!.handler;

    act(() => insert());
    view.unmount();
    act(() => vi.advanceTimersByTime(300));
    expect(onBookingChange).not.toHaveBeenCalled();
    expect(realtime.removeChannel).toHaveBeenCalledTimes(1);

    act(() => {
      insert();
      vi.advanceTimersByTime(300);
    });
    expect(onBookingChange).not.toHaveBeenCalled();
  });
});
