import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Sidebar } from "@/components/features/dashboard/sidebar";
import { Header } from "@/components/features/dashboard/header";
import { NotificationBell } from "@/components/features/notifications/notification-bell";
import { OfflineBanner } from "@/components/shared/offline-banner";
import { isDevAuthBypassEnabled, getDevBypassLayoutStaff } from "@/lib/dev-bypass";
import { getLayoutStaffContext } from "@/lib/queries/staff-context";
import { getCrmReadinessCached } from "@/lib/queries/crm-readiness";
import { getUserWorkspaceAccess } from "@/lib/auth/get-user-workspace-access";
import { getStaffDisplayName } from "@/lib/staff/display-name";
import { canViewMasterSheetReview } from "@/lib/auth/crm-permissions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [ctx, hdrs] = await Promise.all([getLayoutStaffContext(), headers()]);
  const staffPwaRoute = hdrs.get("x-cradle-staff-pwa-route") === "1";
  if (!ctx) redirect(staffPwaRoute ? "/staff/login" : "/login");

  const { me } = ctx;
  const resolvedMe = me ?? (isDevAuthBypassEnabled() ? getDevBypassLayoutStaff() : null);

  if (!resolvedMe) redirect(staffPwaRoute ? "/staff/login" : "/login");

  const branchId = resolvedMe.branch_id ?? null;
  const displayName = getStaffDisplayName(resolvedMe);

  const [workspaces, readiness] = await Promise.all([
    staffPwaRoute ? Promise.resolve([]) : getUserWorkspaceAccess(ctx.user.id).catch(() => []),
    staffPwaRoute || !branchId ? Promise.resolve(null) : getCrmReadinessCached(branchId).catch(() => null),
  ]);

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        background: "var(--cs-bg)",
      }}
    >
      <OfflineBanner />
      {staffPwaRoute && <NotificationBell role={resolvedMe.system_role} toastOnly />}
      {!staffPwaRoute && (
        <Sidebar
          role={resolvedMe.system_role}
          canReviewMasterSheet={Boolean(me && canViewMasterSheetReview(me.system_role))}
          fullName={resolvedMe.full_name}
          nickname={resolvedMe.nickname}
          avatarUrl={resolvedMe.avatar_url}
          branchName={(resolvedMe.branches as { name: string } | null)?.name}
        />
      )}

      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {!staffPwaRoute && (
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
        )}
        <main
          data-testid="workspace-main"
          className="p-0 md:p-5"
          style={{
            flex: 1,
            minWidth: 0,
            width: "100%",
            overflowY: "auto",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
