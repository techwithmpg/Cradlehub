/**
 * @vitest-environment jsdom
 */

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AgentCoachProvider,
  useAgentCoachContext,
} from "@/components/agent/agent-context-provider";

vi.mock("next/navigation", () => ({
  usePathname: () => "/crm/schedule",
}));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function IdleProbe({ onRender }: { onRender: (isIdle: boolean) => void }) {
  const { isIdle } = useAgentCoachContext();
  onRender(isIdle);
  return null;
}

function renderProvider(onRender: (isIdle: boolean) => void) {
  return render(
    <AgentCoachProvider
      workspace="crm"
      role="admin"
      branchId="branch-1"
      branchName="Main Branch"
      userId="user-1"
    >
      <IdleProbe onRender={onRender} />
    </AgentCoachProvider>
  );
}

describe("AgentCoachProvider", () => {
  it("does not repeatedly update idle state while the user is already active", () => {
    const onRender = vi.fn();
    renderProvider(onRender);

    expect(onRender).toHaveBeenCalledTimes(1);
    expect(onRender).toHaveBeenLastCalledWith(false);

    act(() => {
      window.dispatchEvent(new Event("mousemove"));
      window.dispatchEvent(new Event("scroll"));
      window.dispatchEvent(new Event("click"));
    });

    expect(onRender).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(45_000);
    });

    expect(onRender).toHaveBeenCalledTimes(2);
    expect(onRender).toHaveBeenLastCalledWith(true);

    act(() => {
      window.dispatchEvent(new Event("mousemove"));
    });

    expect(onRender).toHaveBeenCalledTimes(3);
    expect(onRender).toHaveBeenLastCalledWith(false);

    act(() => {
      window.dispatchEvent(new Event("mousemove"));
      window.dispatchEvent(new Event("scroll"));
    });

    expect(onRender).toHaveBeenCalledTimes(3);
  });
});
