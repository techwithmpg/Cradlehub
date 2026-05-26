import { redirect } from "next/navigation";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled, getDevBypassLayoutStaff } from "@/lib/dev-bypass";
import { getCrmSetupHealth } from "@/lib/queries/crm-setup";
import { getCrmReadiness } from "@/lib/queries/crm-readiness";
import { CrmSetupHealthCards } from "@/components/features/crm/setup/crm-setup-health-cards";
import { CrmSetupWorkspaceTiles } from "@/components/features/crm/setup/crm-setup-workspace-tiles";
import { CrmBookingFlowRules } from "@/components/features/crm/setup/crm-booking-flow-rules";
import { CrmBookingImpactMatrix } from "@/components/features/crm/setup/crm-booking-impact-matrix";
import { SystemReadinessBar } from "@/components/shared/system-readiness-bar";
import { buildReadinessResult } from "@/types/readiness";

// ── Auth + branch resolution ───────────────────────────────────────────────────

const ALLOWED_ROLES = new Set(["owner", "manager", "crm", "csr", "csr_head", "csr_staff"]);

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
  let readiness: Awaited<ReturnType<typeof getCrmReadiness>> | null;

  try {
    [health, readiness] = await Promise.all([
      getCrmSetupHealth(branchId),
      getCrmReadiness(branchId).catch(() => null),
    ]);
  } catch (err) {
    console.error("[crm/setup] health check failed", {
      branchId,
      error: err instanceof Error ? err.message : String(err),
    });
    return (
      <section className="space-y-5">
        <PageHeader
          title="Rules & Setup Center"
          description="Configure the rules and data CradleHub uses for online bookings, walk-ins, home service, staff schedules, services, and spaces."
          icon="🛠️"
        />
        <Alert variant="destructive">
          <AlertTitle>Could not load setup data</AlertTitle>
          <AlertDescription>
            Failed to run the setup health check. Please refresh the page. If the issue persists, check your connection.
          </AlertDescription>
        </Alert>
        <CrmBookingFlowRules />
      </section>
    );
  }

  // getCrmReadiness already aggregates getCrmSetupHealth internally.
  // When readiness is available (the common case), use its issues directly.
  // When it failed, fall back to an empty list — health cards below still render.
  const readinessResult = readiness ?? buildReadinessResult([]);
  const readinessIssues = readinessResult.issues;
  const readinessStatus = readinessResult.status;

  return (
    <section className="space-y-6">
      {/* ── Compact system readiness bar — always first ── */}
      <SystemReadinessBar
        issues={readinessIssues}
        status={readinessStatus}
        label="System Readiness"
      />

      <PageHeader
        title="Rules & Setup Center"
        description="Configure the rules and data CradleHub uses for online bookings, walk-ins, home service, staff schedules, services, and spaces."
        icon="🛠️"
      />

      {/* ── Booking flow cards ── */}
      <div>
        <div
          style={{
            fontSize: "0.9375rem",
            fontWeight: 600,
            color: "var(--cs-text)",
            fontFamily: "var(--font-display)",
            marginBottom: "0.75rem",
          }}
        >
          Booking Flows
        </div>
        <CrmBookingFlowRules />
      </div>

      {/* ── Setup health KPIs ── */}
      <div>
        <div
          style={{
            fontSize: "0.9375rem",
            fontWeight: 600,
            color: "var(--cs-text)",
            fontFamily: "var(--font-display)",
            marginBottom: "0.625rem",
          }}
        >
          Setup Health
        </div>
        <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)", marginBottom: "0.75rem" }}>
          Quick view of whether the system has enough data to run each workflow.
        </div>
        <CrmSetupHealthCards data={health} />
      </div>

      {/* ── Setup workspaces ── */}
      <div>
        <div
          style={{
            fontSize: "0.9375rem",
            fontWeight: 600,
            color: "var(--cs-text)",
            fontFamily: "var(--font-display)",
            marginBottom: "0.625rem",
          }}
        >
          Setup Workspaces
        </div>
        <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)", marginBottom: "0.75rem" }}>
          Open the right tool to update services, schedules, rooms, rules, and availability.
        </div>
        <CrmSetupWorkspaceTiles />
      </div>

      {/* ── Booking impact matrix ── */}
      <div>
        <div
          style={{
            fontSize: "0.9375rem",
            fontWeight: 600,
            color: "var(--cs-text)",
            fontFamily: "var(--font-display)",
            marginBottom: "0.625rem",
          }}
        >
          What affects each booking type?
        </div>
        <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)", marginBottom: "0.75rem" }}>
          Which data the booking engine reads depends on the booking source and delivery type.
        </div>
        <CrmBookingImpactMatrix />
      </div>

      {/* Footer */}
      <div
        style={{
          paddingTop: "0.75rem",
          borderTop: "1px solid var(--cs-border-soft)",
          fontSize: "0.6875rem",
          color: "var(--cs-text-muted)",
        }}
      >
        {branchName} · Health check runs on every page load against live data · Online booking remains schedule-based and is not affected by daily check-in status
      </div>
    </section>
  );
}
