import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

const crmRoutes = join(root, "src", "app", "(dashboard)", "crm");
const ownerRoutes = join(root, "src", "app", "(dashboard)", "owner");
const activeFeatureDirectories = [
  "attendance",
  "bookings",
  "dispatch",
  "owner",
  "payroll",
  "schedule",
].map((name) => join(root, "src", "components", "features", name));
const crmFeatures = join(root, "src", "components", "features", "crm");

function activeWorkspaceFiles() {
  return [
    ...sourceFiles(crmRoutes),
    ...sourceFiles(ownerRoutes),
    ...activeFeatureDirectories.flatMap(sourceFiles),
    ...sourceFiles(crmFeatures).filter(
      (file) => !file.includes(join("crm", "availability"))
    ),
  ];
}

describe("CRM and Owner navigation performance contract", () => {
  it("does not define full-area route loaders inside either workspace", () => {
    const loaders = [...sourceFiles(crmRoutes), ...sourceFiles(ownerRoutes)]
      .filter((file) => file.endsWith("loading.tsx"))
      .map((file) => relative(root, file));

    expect(loaders).toEqual([]);
  });

  it("does not refresh the whole route for active workspace mutations", () => {
    const offenders = activeWorkspaceFiles()
      .filter((file) => readFileSync(file, "utf8").includes("router.refresh()"))
      .map((file) => relative(root, file));

    expect(offenders).toEqual([]);
  });

  it("does not use document navigation for internal CRM or Owner links", () => {
    const internalDocumentNavigation =
      /window\.location\.(?:href\s*=|assign\(|replace\()\s*["'`]\/(?:crm|owner)|<a\s+[^>]*href=["']\/(?:crm|owner)/;
    const offenders = activeWorkspaceFiles()
      .filter((file) => internalDocumentNavigation.test(readFileSync(file, "utf8")))
      .map((file) => relative(root, file));

    expect(offenders).toEqual([]);
  });

  it("keeps the workspace shell mounted and exposes local link progress", () => {
    const sidebar = readFileSync(
      join(root, "src", "components", "features", "dashboard", "sidebar.tsx"),
      "utf8"
    );
    const layout = readFileSync(
      join(root, "src", "app", "(dashboard)", "layout.tsx"),
      "utf8"
    );
    const scheduleShell = readFileSync(
      join(
        root,
        "src",
        "components",
        "features",
        "schedule",
        "workspace",
        "schedule-workspace-shell.tsx"
      ),
      "utf8"
    );

    expect(sidebar).toContain("useLinkStatus");
    expect(sidebar).toContain('data-testid="workspace-sidebar"');
    expect(layout).toContain('data-testid="workspace-main"');
    expect(scheduleShell).toContain("window.history.pushState");
    expect(scheduleShell).toContain("mountedTabs.has");
  });
});
