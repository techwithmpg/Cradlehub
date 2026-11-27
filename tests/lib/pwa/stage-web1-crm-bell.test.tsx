// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StaffPortalStaff } from "@/components/features/staff-portal/types";

const mockRouter = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));
const mockToast = vi.hoisted(() => vi.fn());

const realtimeState = vi.hoisted(() => ({
  channels: [] as Array<{
    filter: string;
    callback: (payload: {
      eventType: string;
      new?: Record<string, unknown> | null;
      old?: Record<string, unknown> | null;
    }) => void;
  }>,
  queryOps: [] as string[],
  unreadCount: 2,
}));

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

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

vi.mock("sonner", () => ({
  toast: mockToast,
}));

vi.mock("@/components/features/staff-pwa/safe-memory", () => ({
  StaffSnapshotRecorder: () => null,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => {
    const channelObj = {
      on: vi.fn(
        (
          _type: string,
          opts: { filter: string },
          cb: (payload: {
            eventType: string;
            new?: Record<string, unknown> | null;
            old?: Record<string, unknown> | null;
          }) => void
        ) => {
          realtimeState.channels.push({ filter: opts.filter, callback: cb });
          return channelObj;
        }
      ),
      subscribe: vi.fn(() => channelObj),
    };
    return {
      from: vi.fn(() => {
        const chain: Record<string, unknown> = {};
        chain.select = vi.fn(() => {
          realtimeState.queryOps.push("select");
          return chain;
        });
        chain.eq = vi.fn((col: string, val: unknown) => {
          realtimeState.queryOps.push(`eq:${col}=${String(val)}`);
          return chain;
        });
        chain.or = vi.fn((expr: string) => {
          realtimeState.queryOps.push(`or:${expr}`);
          return chain;
        });
        chain.is = vi.fn(async (col: string, val: unknown) => {
          realtimeState.queryOps.push(`is:${col}=${String(val)}`);
          return { count: realtimeState.unreadCount, error: null };
        });
        return chain;
      }),
      channel: vi.fn(() => channelObj),
      removeChannel: vi.fn(async () => "ok"),
    };
  },
}));

import { StaffNoticesBellLink } from "@/components/features/staff-portal/staff-notices-bell-link";
import { CrmMobileHome } from "@/components/features/staff-pwa/crm/crm-mobile-home";

function makeStaff(overrides: Partial<StaffPortalStaff> = {}): StaffPortalStaff {
  return {
    id: "staff-1",
    full_name: "Claire Desk",
    nickname: "Claire",
    tier: null,
    system_role: "crm",
    staff_type: null,
    branch_id: "branch-1",
    avatar_url: null,
    ...overrides,
  };
}

describe("Stage WEB-1 CrmMobileHome & StaffNoticesBellLink workspace routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    realtimeState.channels = [];
    realtimeState.queryOps = [];
    realtimeState.unreadCount = 2;
  });

  afterEach(() => {
    cleanup();
  });

  it("wires CRM mobile home bell to workspace=crm for crm and workspace=staff for non-CRM staff fallback", async () => {
    const { rerender } = render(
      <CrmMobileHome
        staff={makeStaff({ id: "crm-1", system_role: "crm", branch_id: "branch-1" })}
        runtime={null}
        work={{ items: [], errors: [] }}
        attendance={null}
      />
    );

    await waitFor(() => {
      expect(realtimeState.channels).toHaveLength(1);
    });
    expect(realtimeState.channels[0]?.filter).toBe("branch_id=eq.branch-1");
    expect(realtimeState.queryOps).toContain("eq:target_workspace=crm");
    expect(screen.getByRole("link", { name: "Notifications (2 unread)" })).toBeTruthy();

    realtimeState.channels = [];
    realtimeState.queryOps = [];
    rerender(
      <CrmMobileHome
        staff={makeStaff({
          id: "staff-fallback",
          system_role: "staff",
          staff_type: "general",
          branch_id: "branch-1",
        })}
        runtime={null}
        work={{ items: [], errors: [] }}
        attendance={null}
      />
    );

    await waitFor(() => {
      expect(realtimeState.channels).toHaveLength(1);
    });
    expect(realtimeState.channels[0]?.filter).toBe("recipient_staff_id=eq.staff-fallback");
    expect(realtimeState.queryOps).toContain("eq:target_workspace=staff");
  });

  it("subscribes to target_workspace=eq.crm when branchId is omitted and ignores mismatched workspace events", async () => {
    render(<StaffNoticesBellLink staffId="crm-2" workspace="crm" href="/staff/notices" />);

    await waitFor(() => {
      expect(realtimeState.channels).toHaveLength(1);
    });
    expect(realtimeState.channels[0]?.filter).toBe("target_workspace=eq.crm");
    expect(realtimeState.queryOps[realtimeState.queryOps.length - 1]).toBe("is:resolved_at=null");

    const callback = realtimeState.channels[0]!.callback;

    // Mismatched target_workspace event must NOT toast or refresh
    callback({
      eventType: "INSERT",
      new: {
        target_workspace: "staff",
        branch_id: "branch-1",
        recipient_staff_id: "crm-2",
        title: "Wrong workspace alert",
        body: "Ignored",
      },
    });
    expect(mockToast).not.toHaveBeenCalled();
    expect(mockRouter.refresh).not.toHaveBeenCalled();

    // Matching CRM event fires toast and refreshes router
    callback({
      eventType: "INSERT",
      new: {
        target_workspace: "crm",
        branch_id: "branch-1",
        recipient_staff_id: null,
        title: "New booking requires review",
        body: "Guest Two",
      },
    });
    expect(mockToast).toHaveBeenCalledWith(
      "New booking requires review",
      expect.objectContaining({ description: "Guest Two" })
    );
    expect(mockRouter.refresh).toHaveBeenCalledTimes(1);
  });
});
