import { Children, isValidElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signOut: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signOut: mocks.signOut } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { Header } from "@/components/features/dashboard/header";

function findLogoutAction(node: ReactNode): (() => Promise<void>) | null {
  if (!isValidElement(node)) return null;
  const props = node.props as { action?: () => Promise<void>; children?: ReactNode };
  if (node.type === "form" && props.action) return props.action;
  for (const child of Children.toArray(props.children)) {
    const action = findLogoutAction(child);
    if (action) return action;
  }
  return null;
}

beforeEach(() => {
  mocks.signOut.mockReset().mockResolvedValue({ error: null });
  mocks.revalidatePath.mockReset();
  mocks.redirect.mockReset();
});

describe("dashboard logout Review cache invalidation", () => {
  it("invalidates the Master Sheet Review path after sign-out and before redirect", async () => {
    const action = findLogoutAction(Header({ role: "owner", fullName: "Test Owner" }));
    expect(action).not.toBeNull();
    await action!();
    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/crm/master-sheet");
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
    expect(mocks.signOut.mock.invocationCallOrder[0]!).toBeLessThan(
      mocks.revalidatePath.mock.invocationCallOrder[0]!
    );
    expect(mocks.revalidatePath.mock.invocationCallOrder[0]!).toBeLessThan(
      mocks.redirect.mock.invocationCallOrder[0]!
    );
  });
});
