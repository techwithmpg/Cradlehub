import { createClient } from "@/lib/supabase/server";
import { redirect }     from "next/navigation";
import Link from "next/link";
import { ChevronDown, HelpCircle, LogOut, Settings, Shuffle, UserRound } from "lucide-react";
import { WorkspaceSwitchLink } from "@/components/shared/workspace-switch-link";
import { UserAvatar } from "@/components/shared/user-avatar";
import { NotificationBell } from "@/components/features/notifications/notification-bell";
import { WorkspaceBreadcrumb } from "./workspace-breadcrumb";
import { WorkspaceReadinessIndicator } from "./workspace-readiness-indicator";
import type { WorkspaceAccess } from "@/lib/auth/workspace-access";
import type { ReadinessResult } from "@/types/readiness";

async function logoutAction() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

type HeaderProps = {
  role:      string;
  fullName:  string;
  displayName?: string;
  avatarUrl?: string | null;
  readiness?: ReadinessResult | null;
  workspaces?: WorkspaceAccess[];
};

function profileHref(workspaces: readonly WorkspaceAccess[]): string {
  return workspaces.some((workspace) => workspace.key === "staff_portal")
    ? "/staff-portal/profile"
    : "/select-workspace";
}

function settingsHref(role: string): string {
  if (role === "owner") return "/owner";
  if (role === "manager" || role === "assistant_manager" || role === "store_manager") {
    return "/manager/settings";
  }
  return "/crm/setup";
}

export function Header({ role, fullName, displayName, avatarUrl, readiness, workspaces = [] }: HeaderProps) {
  const canSwitchWorkspace = workspaces.length > 1;
  const headerName = displayName ?? fullName;

  return (
    <header style={{
      height:          52,
      backgroundColor: "var(--cs-surface)",
      borderBottom:    "1px solid var(--cs-border-soft)",
      display:         "flex",
      alignItems:      "center",
      justifyContent:  "space-between",
      padding:         "0 20px",
      position:        "sticky",
      top:             0,
      zIndex:          20,
      boxShadow:       "var(--cs-shadow-xs)",
    }}>

      {/* Left – workspace breadcrumb */}
      <WorkspaceBreadcrumb role={role} />

      {/* Right – date + user + sign out */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

        <div style={{
          fontSize:           11.5,
          color:              "var(--cs-text-subtle)",
          fontVariantNumeric: "tabular-nums",
        }}>
          {new Date().toLocaleDateString("en-PH", {
            weekday: "short", month: "short", day: "numeric",
          })}
        </div>

        <div style={{ width: 1, height: 16, background: "var(--cs-border)", margin: "0 4px" }} />

        <WorkspaceReadinessIndicator readiness={readiness ?? null} />

        <div style={{ width: 1, height: 16, background: "var(--cs-border)", margin: "0 4px" }} />

        <NotificationBell role={role} />

        <div style={{ width: 1, height: 16, background: "var(--cs-border)", margin: "0 2px" }} />

        <details className="group relative">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-lg px-1.5 py-1 outline-none transition hover:bg-[var(--cs-surface-warm)] focus-visible:ring-3 focus-visible:ring-[var(--cs-sand)]/30">
            <UserAvatar
              name={headerName}
              imageUrl={avatarUrl}
              size="sm"
              className="border border-border-soft"
            />
            <span
              className="hidden sm:block"
              style={{ fontSize: 12.5, color: "var(--cs-text-secondary)" }}
            >
              {headerName.split(" ")[0]}
            </span>
            <ChevronDown className="size-3.5 text-[var(--cs-text-muted)] transition group-open:rotate-180" />
          </summary>

          <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-2 shadow-xl shadow-black/10">
            <div className="px-2.5 py-2">
              <p className="truncate text-sm font-semibold text-[var(--cs-text)]">{headerName}</p>
              {headerName !== fullName ? (
                <p className="truncate text-xs text-[var(--cs-text-muted)]">{fullName}</p>
              ) : null}
              <p className="text-xs capitalize text-[var(--cs-text-muted)]">{role.replace(/_/g, " ")}</p>
            </div>
            <div className="my-1 h-px bg-[var(--cs-border-soft)]" />

            <Link className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-[var(--cs-text-secondary)] transition hover:bg-[var(--cs-surface-warm)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--cs-sand)]/30" href={profileHref(workspaces)}>
              <UserRound className="size-4" />
              My Profile
            </Link>

            {canSwitchWorkspace ? (
              <WorkspaceSwitchLink
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-[var(--cs-text-secondary)] transition hover:bg-[var(--cs-surface-warm)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--cs-sand)]/30"
                href="/select-workspace"
                label="Switch Workspace"
                loadingLabel="Preparing your workspace options..."
              >
                <Shuffle className="size-4" />
                Switch Workspace
              </WorkspaceSwitchLink>
            ) : null}

            <Link className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-[var(--cs-text-secondary)] transition hover:bg-[var(--cs-surface-warm)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--cs-sand)]/30" href={settingsHref(role)}>
              <Settings className="size-4" />
              Settings
            </Link>

            <a className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-[var(--cs-text-secondary)] transition hover:bg-[var(--cs-surface-warm)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--cs-sand)]/30" href="mailto:support@cradlewellnessliving.com">
              <HelpCircle className="size-4" />
              Help &amp; Support
            </a>

            <div className="my-1 h-px bg-[var(--cs-border-soft)]" />
            <form action={logoutAction}>
              <button
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-[var(--cs-text-muted)] transition hover:bg-[var(--cs-surface-warm)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--cs-sand)]/30"
                type="submit"
              >
                <LogOut className="size-4" />
                Logout
              </button>
            </form>
          </div>
        </details>
      </div>
    </header>
  );
}
