import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/features/dashboard/sidebar";
import { Header } from "@/components/features/dashboard/header";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: staffRecord } = await supabase
    .from("staff")
    .select("full_name, system_role, branch_id, branches(name)")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .single();

  if (!staffRecord) redirect("/login");

  const role = staffRecord.system_role;
  const fullName = staffRecord.full_name;
  const branchName = (staffRecord.branches as { name: string } | null)?.name;

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "var(--cs-warm-white)" }}>
      <Sidebar role={role} fullName={fullName} branchName={branchName} />

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <Header role={role} fullName={fullName} />
        <main style={{
          flex: 1,
          padding: "1.5rem",
          backgroundColor: "var(--cs-warm-white)",
        }}>
          {children}
        </main>
      </div>
    </div>
  );
}
