import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  workspaces: [] as Array<{ key: "owner" | "crm" | "marketing" | "staff_portal"; label: string; description: string; href: string; priority: number; branchName?: string }>,
  getOwnerFrontDeskBranches: vi.fn(),
}));

vi.mock("@/lib/auth/get-user-workspace-access", () => ({
  getCurrentUserWorkspaceAccess: async () => ({ user: { id: "user-1" }, workspaces: mocks.workspaces }),
}));
vi.mock("@/lib/queries/front-desk-branch", () => ({
  getOwnerFrontDeskBranches: mocks.getOwnerFrontDeskBranches,
}));
vi.mock("@/components/shared/workspace-switch-link", () => ({
  WorkspaceSwitchLink: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@/components/shared/brand-logo", () => ({ BrandLogo: () => <div /> }));

import SelectWorkspacePage from "@/app/(dashboard)/select-workspace/page";

const crm = { key: "crm" as const, label: "Front Desk", description: "Operations", href: "/crm", priority: 10, branchName: "Main Spa" };
const staff = { key: "staff_portal" as const, label: "Staff Portal", description: "Staff", href: "/staff-portal", priority: 20 };

describe("Owner workspace chooser", () => {
  it("offers active Front Desk branches on the existing chooser", async () => {
    mocks.workspaces = [
      { key: "owner", label: "Owner / Admin", description: "Admin", href: "/owner", priority: 5 },
      crm,
      { key: "marketing", label: "Marketing Studio", description: "Marketing", href: "/marketing", priority: 7 },
      staff,
    ];
    mocks.getOwnerFrontDeskBranches.mockResolvedValue([
      { id: "main", name: "Main Spa" },
      { id: "sm", name: "SM Branch" },
    ]);
    const html = renderToStaticMarkup(await SelectWorkspacePage());
    expect(html).toContain("Choose a branch to open");
    expect(html).toContain('id="owner-front-desk-branch"');
    expect(html).toContain('value="main"');
    expect(html).toContain('value="sm"');
    expect(html).toContain("Open Front Desk");
    expect(html).toContain('href="/owner"');
    expect(html).toContain('href="/marketing"');
  });

  it("leaves non-Owner workspace navigation unchanged", async () => {
    mocks.workspaces = [crm, staff];
    mocks.getOwnerFrontDeskBranches.mockClear();
    const html = renderToStaticMarkup(await SelectWorkspacePage());
    expect(html).toContain('href="/crm"');
    expect(html).not.toContain("Choose a branch to open");
    expect(mocks.getOwnerFrontDeskBranches).not.toHaveBeenCalled();
  });
});
