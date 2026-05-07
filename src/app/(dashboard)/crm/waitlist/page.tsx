import { redirect }     from "next/navigation";
import { PageHeader }   from "@/components/features/dashboard/page-header";
import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled, getDevBypassLayoutStaff } from "@/lib/dev-bypass";
import { getWaitlistAction } from "./actions";
import { WaitlistQueue }    from "./waitlist-queue";

const ALLOWED_ROLES = ["owner", "manager", "crm", "csr", "csr_head", "csr_staff"];

async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (isDevAuthBypassEnabled()) {
    const mock = getDevBypassLayoutStaff();
    return { branchId: mock.branch_id as string, branchName: mock.branches.name as string };
  }

  const { data: me } = await supabase
    .from("staff")
    .select("branch_id, branches(name), system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!me || !ALLOWED_ROLES.includes(me.system_role) || !me.branch_id) redirect("/login");

  return {
    branchId:   me.branch_id as string,
    branchName: (me.branches as { name: string } | null)?.name ?? "Your Branch",
  };
}

export default async function WaitlistPage() {
  const { branchId, branchName } = await getContext();

  const result = await getWaitlistAction(branchId);
  const rows = result.ok ? (result.data as Parameters<typeof WaitlistQueue>[0]["initialRows"]) : [];

  const waitingCount = rows.filter((r) => r.status === "waiting").length;

  return (
    <div>
      <PageHeader
        title="Waitlist & Callbacks"
        description={`${branchName} · Manage walk-in requests and callback queue`}
        icon="📋"
        action={
          waitingCount > 0 ? (
            <div
              style={{
                padding: "4px 12px",
                borderRadius: 20,
                backgroundColor: "var(--cs-sand-mist)",
                color: "var(--cs-sand)",
                fontSize: "0.8125rem",
                fontWeight: 700,
              }}
            >
              {waitingCount} waiting
            </div>
          ) : undefined
        }
      />

      <WaitlistQueue initialRows={rows} />
    </div>
  );
}
