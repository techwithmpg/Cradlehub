import { redirect } from "next/navigation";
import {
  Building2,
  ChevronRight,
  ClipboardList,
  Crown,
  Headphones,
  ShieldCheck,
  Truck,
  UserRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { WorkspaceSwitchLink } from "@/components/shared/workspace-switch-link";
import { getCurrentUserWorkspaceAccess } from "@/lib/auth/get-user-workspace-access";
import { getWorkspaceSwitchDestination, type WorkspaceAccess, type WorkspaceKey } from "@/lib/auth/workspace-access";

const WORKSPACE_ICONS: Record<WorkspaceKey, LucideIcon> = {
  crm: Headphones,
  staff_portal: UserRound,
  driver: Truck,
  owner: Crown,
  manager: Building2,
  utility: Wrench,
};

function loadingLabel(workspace: WorkspaceAccess): string {
  switch (workspace.key) {
    case "crm":
      return "Opening CRM Workspace...";
    case "staff_portal":
      return "Preparing your Staff Portal...";
    case "driver":
      return "Preparing your Driver Portal...";
    case "owner":
      return "Opening Owner / Admin Workspace...";
    case "manager":
      return "Preparing your Manager Workspace...";
    case "utility":
      return "Preparing your Utility Portal...";
  }
}

export default async function SelectWorkspacePage() {
  const access = await getCurrentUserWorkspaceAccess();
  if (!access) redirect("/login");

  const { workspaces } = access;
  if (workspaces.length === 0) redirect("/account/setup");
  if (workspaces.length === 1) redirect(getWorkspaceSwitchDestination(workspaces));

  return (
    <section className="mx-auto flex min-h-full w-full max-w-5xl flex-col justify-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 text-center">
        <div className="mb-5 flex justify-center">
          <BrandLogo size="md" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--cs-sand)]">
          Workspace access
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-[var(--cs-text)]">
          Choose Your Workspace
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[var(--cs-text-muted)]">
          You have access to more than one workspace. Choose where you want to continue.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {workspaces.map((workspace) => {
          const Icon = WORKSPACE_ICONS[workspace.key];
          return (
            <WorkspaceSwitchLink
              className="group flex h-full min-h-44 flex-col rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--cs-sand)]/50 hover:shadow-lg hover:shadow-black/10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--cs-sand)]/35"
              href={workspace.href}
              key={workspace.key}
              label={`Open ${workspace.label}`}
              loadingLabel={loadingLabel(workspace)}
            >
              <span className="flex items-start justify-between gap-3">
                <span className="flex size-12 items-center justify-center rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] text-[var(--sp-forest)]">
                  <Icon className="size-5" />
                </span>
                <span className="flex size-9 items-center justify-center rounded-full text-[var(--cs-text-muted)] transition group-hover:bg-[var(--cs-surface-warm)] group-hover:text-[var(--sp-forest)]">
                  <ChevronRight className="size-5" />
                </span>
              </span>

              <span className="mt-5 text-lg font-semibold text-[var(--cs-text)]">
                {workspace.label}
              </span>
              <span className="mt-2 text-sm leading-6 text-[var(--cs-text-muted)]">
                {workspace.description}
              </span>
              {workspace.branchName ? (
                <span className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] px-3 py-1 text-xs font-medium text-[var(--cs-text-secondary)]">
                  <ShieldCheck className="size-3.5" />
                  {workspace.branchName}
                </span>
              ) : null}

              <span className="mt-auto pt-5">
                <span className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-[var(--sp-forest)] px-4 text-sm font-semibold text-white transition group-hover:brightness-95">
                  Open Workspace
                </span>
              </span>
            </WorkspaceSwitchLink>
          );
        })}
      </div>

      <div className="mt-5 rounded-2xl border border-dashed border-[var(--cs-border)] bg-[var(--cs-surface-warm)] p-4 text-center text-sm text-[var(--cs-text-muted)]">
        <ClipboardList className="mx-auto mb-2 size-5 text-[var(--cs-sand)]" />
        Not sure which workspace to use? Contact your branch manager or CRM team for assistance.
      </div>
    </section>
  );
}
