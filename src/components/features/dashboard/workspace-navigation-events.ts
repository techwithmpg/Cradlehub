export const WORKSPACE_NAVIGATION_EVENT = "cradlehub:workspace-navigation";
export const WORKSPACE_RETENTION_STATE_EVENT = "cradlehub:workspace-retention-state";

export type WorkspaceNavigationDetail = {
  href: string;
};

export type WorkspaceRetentionStateDetail = {
  unsavedModuleIds: string[];
};

export function notifyWorkspaceNavigation(href: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<WorkspaceNavigationDetail>(WORKSPACE_NAVIGATION_EVENT, {
      detail: { href },
    })
  );
}
