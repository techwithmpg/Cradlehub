import { redirect }     from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar }      from "@/components/features/dashboard/sidebar";
import { Header }       from "@/components/features/dashboard/header";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("staff")
    .select("full_name, system_role, branch_id, branches(name)")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .single();

  if (!me) redirect("/login");

  return (
    <div style={{
      display:    "flex",
      minHeight:  "100vh",
      background: "var(--cs-bg)",
    }}>
      <Sidebar
        role={me.system_role}
        fullName={me.full_name}
        branchName={(me.branches as { name: string } | null)?.name}
      />

      <div style={{
        flex:          1,
        minWidth:      0,
        display:       "flex",
        flexDirection: "column",
      }}>
        <Header role={me.system_role} fullName={me.full_name} />
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
