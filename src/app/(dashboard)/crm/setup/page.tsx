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
import { ReadinessIssueList } from "@/components/shared/readiness-issue-list";

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

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div>
        <div
          style={{
            fontSize: "0.9375rem",
            fontWeight: 600,
            color: "var(--cs-text)",
            fontFamily: "var(--font-display)",
            marginBottom: description ? "0.25rem" : 0,
          }}
        >
          {title}
        </div>
        {description && (
          <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)" }}>
            {description}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CrmSetupPage() {
  const { branchId, branchName } = await getSetupPageContext();

  // getCrmSetupHealth powers the health cards — it is the required query.
  // getCrmReadiness powers the issues list and is fetched in parallel.
  // If getCrmReadiness fails internally it already emits system:warning issues
  // rather than throwing, so the .catch(() => null) guard is an extra safety net
  // for unexpected throws (e.g. module-load errors in tests).
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
          description={`${branchName} · Review the rules CradleHub follows for online booking, walk-ins, home-service, staff schedules, services, and spaces`}
          icon="🛠️"
        />
        <Alert variant="destructive">
          <AlertTitle>Could not load setup data</AlertTitle>
          <AlertDescription>
            Failed to run the setup health check. Please refresh the page. If the issue persists, check your connection.
          </AlertDescription>
        </Alert>
        {/* Still show informational sections even if health check fails */}
        <Section
          title="Booking Flow Rules"
          description="How CradleHub uses system data differently for each booking type."
        >
          <CrmBookingFlowRules />
        </Section>
        <Section
          title="What affects each booking type?"
          description="Which data the booking engine reads depends on the booking source and delivery type."
        >
          <CrmBookingImpactMatrix />
        </Section>
      </section>
    );
  }

  // Use readiness counts for the summary banner when available — these reflect
  // the full operational picture (setup + availability + dispatch + payment).
  // Fall back to getCrmSetupHealth counts if getCrmReadiness unexpectedly failed.
  const issueCount =
    readiness !== null
      ? readiness.issues.length
      : health.issues.length;

  const criticalCount =
    readiness !== null
      ? readiness.issues.filter((i) => i.severity === "critical").length
      : health.issues.filter((i) => i.severity === "error").length;

  const overallStatus = readiness?.status ?? (criticalCount > 0 ? "critical" : issueCount > 0 ? "warning" : "ok");

  const statusBadgeColor =
    overallStatus === "critical"
      ? "var(--cs-error, #c0392b)"
      : overallStatus === "warning"
        ? "var(--cs-warning, #e67e22)"
        : "var(--cs-success, #27ae60)";

  const statusBadgeLabel =
    overallStatus === "critical" ? "Critical" : overallStatus === "warning" ? "Warning" : "OK";

  return (
    <section className="space-y-6">
      <PageHeader
        title="Rules & Setup Center"
        description={`${branchName} · Review the rules CradleHub follows for online booking, walk-ins, home-service, staff schedules, services, and spaces`}
        icon="🛠️"
      />

      {/* ── Section 1: Booking Flow Rules ── */}
      <Section
        title="Booking Flow Rules"
        description="How CradleHub uses system data differently for each booking type."
      >
        <CrmBookingFlowRules />
      </Section>

      {/* ── Section 2: Setup Health ── */}
      {/* Readiness summary banner — shown when there are any issues */}
      {issueCount > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            backgroundColor: criticalCount > 0 ? "rgba(192,57,43,0.06)" : "rgba(230,126,34,0.06)",
            border: `1px solid ${criticalCount > 0 ? "rgba(192,57,43,0.25)" : "rgba(230,126,34,0.25)"}`,
            borderRadius: "var(--cs-r-sm, 8px)",
            fontSize: "0.875rem",
            color: "var(--cs-text-secondary)",
          }}
        >
          <span style={{ fontSize: 18, flexShrink: 0 }}>{criticalCount > 0 ? "⛔" : "⚠️"}</span>
          <span style={{ flex: 1 }}>
            <strong style={{ color: criticalCount > 0 ? "var(--cs-error, #c0392b)" : "var(--cs-warning, #e67e22)" }}>
              {issueCount} readiness issue{issueCount !== 1 ? "s" : ""} detected
            </strong>
            {criticalCount > 0 && ` · ${criticalCount} require${criticalCount === 1 ? "s" : ""} immediate action`}
            {" — review the checklist below."}
          </span>
          {/* Overall status badge */}
          <span
            style={{
              fontSize: "0.6875rem",
              fontWeight: 700,
              color: statusBadgeColor,
              background: `${statusBadgeColor}18`,
              border: `1px solid ${statusBadgeColor}40`,
              padding: "2px 8px",
              borderRadius: 10,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {statusBadgeLabel}
          </span>
        </div>
      )}

      <Section
        title="Setup Health"
        description="Quick view of whether the system has enough setup data to run smoothly."
      >
        <CrmSetupHealthCards data={health} />
      </Section>

      {/* ── Section 3: Readiness Issues (powered by getCrmReadiness) ── */}
      <Section
        title={
          issueCount > 0
            ? `Readiness Issues · ${issueCount} item${issueCount !== 1 ? "s" : ""}`
            : "Readiness Issues · All clear"
        }
        description="Current setup and operational conditions that need attention. Includes setup, scheduling, dispatch, and payment signals."
      >
        {readiness !== null ? (
          <ReadinessIssueList
            issues={readiness.issues}
            emptyTitle="No readiness issues found"
            emptyDescription="The system has the required setup for this area."
          />
        ) : (
          /* Fallback when getCrmReadiness unexpectedly failed after retries */
          <div
            style={{
              padding: "1rem 1.125rem",
              backgroundColor: "var(--cs-surface-raised)",
              border: "1px solid var(--cs-border-soft)",
              borderRadius: "var(--cs-r-sm, 8px)",
              fontSize: "0.8125rem",
              color: "var(--cs-text-muted)",
              lineHeight: 1.5,
            }}
          >
            Readiness issues could not be loaded. Open individual setup tools to continue configuration.
          </div>
        )}
      </Section>

      {/* ── Section 4: Setup Workspaces ── */}
      <Section
        title="Setup Workspaces"
        description="Open the right tool to update services, schedules, rooms, rules, and availability."
      >
        <CrmSetupWorkspaceTiles />
      </Section>

      {/* ── Section 5: What affects each booking type? ── */}
      <Section
        title="What affects each booking type?"
        description="Which data the booking engine reads depends on the booking source and delivery type."
      >
        <CrmBookingImpactMatrix />
      </Section>

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
