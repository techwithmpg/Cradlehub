import { redirect } from "next/navigation";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled, getDevBypassLayoutStaff } from "@/lib/dev-bypass";
import { getCrmSetupHealth } from "@/lib/queries/crm-setup";
import { SetupHealthContent } from "@/components/features/setup-center/setup-health-content";
import { CrmTabNav, SETUP_TABS } from "@/components/features/crm/crm-tab-nav";

// ── Auth + branch resolution ───────────────────────────────────────────────────

const ALLOWED_ROLES = new Set(["owner", "manager", "assistant_manager", "store_manager", "crm", "csr", "csr_head", "csr_staff"]);

async function getSetupPageContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("staff")
    .select("branch_id, branches(name), system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!me && isDevAuthBypassEnabled()) {
    const mock = getDevBypassLayoutStaff();
    return {
      branchId: mock.branch_id as string,
      branchName: (mock.branches as { name: string }).name,
    };
  }

  if (!me || !ALLOWED_ROLES.has(me.system_role) || !me.branch_id) redirect("/crm");

  return {
    branchId: me.branch_id as string,
    branchName: (me.branches as { name: string } | null)?.name ?? "Your Branch",
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CrmSetupPage() {
  const { branchId, branchName } = await getSetupPageContext();

  let health: Awaited<ReturnType<typeof getCrmSetupHealth>>;

  try {
    health = await getCrmSetupHealth(branchId);
  } catch (err) {
    console.error("[crm/setup] health check failed", {
      branchId,
      error: err instanceof Error ? err.message : String(err),
    });
    return (
      <section className="space-y-5">
        <PageHeader
          title="Setup Center"
          description="Everything you need to keep bookings, schedules, services, rooms, and dispatch running smoothly."
          icon="🛠️"
        />
        <Alert variant="destructive">
          <AlertTitle>Could not load setup data</AlertTitle>
          <AlertDescription>
            Failed to run the setup health check. Please refresh the page. If the issue persists, check your connection.
          </AlertDescription>
        </Alert>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <PageHeader
        title="Setup Center"
        description="Everything you need to keep bookings, schedules, services, rooms, and dispatch running smoothly."
        icon="🛠️"
      />

      <CrmTabNav tabs={SETUP_TABS} activeHref="/crm/setup" />

      <SetupHealthContent data={health} />

      {/* Footer */}
      <div className="border-t border-[var(--cs-border-soft)] pt-3 text-[0.6875rem] text-[var(--cs-text-muted)]">
        {branchName} · Health check runs on every page load against live data
      </div>
    </section>
  );
}
