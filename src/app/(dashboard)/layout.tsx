import { redirect } from "next/navigation";
import { Sidebar }  from "@/components/features/dashboard/sidebar";
import { Header }   from "@/components/features/dashboard/header";
import { isDevAuthBypassEnabled, getDevBypassLayoutStaff } from "@/lib/dev-bypass";
import { getLayoutStaffContext } from "@/lib/queries/staff-context";

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

  return (
    <div style={{
      display:    "flex",
      height:     "100vh",
      background: "var(--cs-bg)",
    }}>
      <Sidebar
        role={resolvedMe.system_role}
        fullName={resolvedMe.full_name}
        avatarUrl={null}
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
            avatarUrl={null}
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
