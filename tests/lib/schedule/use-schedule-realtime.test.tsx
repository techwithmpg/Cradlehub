/**
 * @vitest-environment jsdom
 */

import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBrowserClient } from "@supabase/ssr";
import { useScheduleRealtime } from "@/components/features/schedule/hooks/use-schedule-realtime";

type RealtimeHandler = () => void;

const mocks = vi.hoisted(() => {
  const onCalls: Array<{ table: string; filter?: string; handler: RealtimeHandler }> = [];
  const channel = {
    on: vi.fn(),
    subscribe: vi.fn(),
  };
  channel.on.mockImplementation(
    (_event: string, config: { table: string; filter?: string }, handler: RealtimeHandler) => {
      onCalls.push({ table: config.table, filter: config.filter, handler });
      return channel;
    }
  );
  channel.subscribe.mockImplementation(() => channel);

  return {
    onCalls,
    channel,
    removeChannel: vi.fn(),
    channelSpy: vi.fn(() => channel),
  };
});

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: vi.fn(() => ({
    channel: mocks.channelSpy,
    removeChannel: mocks.removeChannel,
  })),
}));

beforeEach(() => {
  mocks.onCalls.length = 0;
  mocks.channel.on.mockClear();
  mocks.channel.subscribe.mockClear();
  mocks.removeChannel.mockClear();
  mocks.channelSpy.mockClear();
  vi.mocked(createBrowserClient).mockClear();
});

afterEach(() => cleanup());

describe("useScheduleRealtime", () => {
  it("subscribes once per branch/date and invalidates from realtime events", () => {
    const firstInvalidate = vi.fn();
    const secondInvalidate = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ onInvalidate }) =>
        useScheduleRealtime({
          branchId: "branch-1",
          date: "2026-07-03",
          onInvalidate,
        }),
      { initialProps: { onInvalidate: firstInvalidate } }
    );

    expect(mocks.channelSpy).toHaveBeenCalledTimes(1);
    expect(mocks.channelSpy).toHaveBeenCalledWith("schedule-live-branch-1-2026-07-03");
    expect(mocks.channel.subscribe).toHaveBeenCalledTimes(1);
    expect(mocks.onCalls.map((call) => call.table)).toEqual([
      "bookings",
      "staff",
      "branch_resources",
      "staff_schedules",
      "schedule_overrides",
      "staff_group_schedule_rules",
      "blocked_times",
    ]);
    expect(mocks.onCalls.find((call) => call.table === "bookings")?.filter).toBe(
      "branch_id=eq.branch-1"
    );

    rerender({ onInvalidate: secondInvalidate });
    expect(mocks.channelSpy).toHaveBeenCalledTimes(1);

    mocks.onCalls.find((call) => call.table === "bookings")?.handler();
    expect(firstInvalidate).not.toHaveBeenCalled();
    expect(secondInvalidate).toHaveBeenCalledTimes(1);

    mocks.onCalls.find((call) => call.table === "staff_schedules")?.handler();
    expect(secondInvalidate).toHaveBeenCalledTimes(2);

    unmount();
    expect(mocks.removeChannel).toHaveBeenCalledWith(mocks.channel);
  });
});
