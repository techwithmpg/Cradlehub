import { redirect }     from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar }      from "@/components/features/dashboard/sidebar";
import { Header }       from "@/components/features/dashboard/header";
import { isDevAuthBypassEnabled, getDevBypassLayoutStaff } from "@/lib/dev-bypass";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  type LayoutStaff = {
    full_name:   string;
    system_role: string;
    branch_id:   string;
    branches:    { name: string } | { name: string }[] | null;
  };

  // Select only columns guaranteed to exist in every production deployment.
  // avatar_url is NOT selected here — it requires the staff_avatars migration to be applied first.
  const { data: meRaw, error: meError } = await supabase
    .from("staff")
    .select("full_name, system_role, branch_id, branches(name)")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (meError) {
    console.error("[layout] staff lookup error", {
      userId: user.id,
      message: meError.message,
      code: meError.code,
    });
  }

  const me = meRaw as LayoutStaff | null;

  // Dev bypass: if no staff record but dev mode is on, use a mock staff profile
  // so developers can test dashboard pages without creating a full staff record.
  const resolvedMe = me ?? (isDevAuthBypassEnabled() ? getDevBypassLayoutStaff() : null);

  if (!resolvedMe) redirect("/login");

  return (
    <div style={{
      display:    "flex",
      minHeight:  "100vh",
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
        <Header
          role={resolvedMe.system_role}
          fullName={resolvedMe.full_name}
          avatarUrl={null}
        />
        <main style={{
          flex:    1,
          padding: "20px",
          maxWidth: 1280,
          width:   "100%",
        }}>
          {children}
        </main>
      </div>
    </div>
  );
}
