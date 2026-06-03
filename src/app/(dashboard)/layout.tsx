import { redirect } from "next/navigation";
import { Sidebar }  from "@/components/features/dashboard/sidebar";
import { Header }   from "@/components/features/dashboard/header";
import { OfflineBanner } from "@/components/shared/offline-banner";
import { isDevAuthBypassEnabled, getDevBypassLayoutStaff } from "@/lib/dev-bypass";
import { getLayoutStaffContext } from "@/lib/queries/staff-context";
import { getCrmReadinessCached } from "@/lib/queries/crm-readiness";
import { getUserWorkspaceAccess } from "@/lib/auth/get-user-workspace-access";
import { getStaffDisplayName } from "@/lib/staff/display-name";

// force-dynamic is NOT set here — the layout is already dynamic because
// createClient() calls cookies() from next/headers, which inherently opts
// this segment into dynamic rendering on every request.

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getLayoutStaffContext();
  if (!ctx) redirect("/login");

  const { me } = ctx;

  // Dev bypass: if no staff record but dev mode is on, use a mock staff profile.
  const resolvedMe = me ?? (isDevAuthBypassEnabled() ? getDevBypassLayoutStaff() : null);

  if (!resolvedMe) redirect("/login");

  const workspaces = await getUserWorkspaceAccess(ctx.user.id).catch(() => []);

  // Fetch CRM readiness for the header indicator (failure-safe).
  const branchId = resolvedMe.branch_id ?? null;
  const displayName = getStaffDisplayName(resolvedMe);
  const readiness = branchId
    ? await getCrmReadinessCached(branchId).catch(() => null)
    : null;

  return (
    <div style={{
      display:    "flex",
      height:     "100vh",
      background: "var(--cs-bg)",
    }}>
      <OfflineBanner />
      <Sidebar
        role={resolvedMe.system_role}
        fullName={resolvedMe.full_name}
        nickname={resolvedMe.nickname}
        avatarUrl={resolvedMe.avatar_url}
        branchName={(resolvedMe.branches as { name: string } | null)?.name}
      />

      <div style={{
        flex:          1,
        minWidth:      0,
        display:       "flex",
        flexDirection: "column",
      }}>
        <div className="hidden md:block">
          <Header
            role={resolvedMe.system_role}
            fullName={resolvedMe.full_name}
            displayName={displayName}
            avatarUrl={resolvedMe.avatar_url}
            readiness={readiness}
            workspaces={workspaces}
          />
        </div>
        <main
          className="p-0 md:p-5"
          style={{
            flex:       1,
            minWidth:   0,
            width:      "100%",
            overflowY:  "auto",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
