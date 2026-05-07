import { redirect } from "next/navigation";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled, getDevBypassLayoutStaff } from "@/lib/dev-bypass";
import { getDailyPaymentSummary } from "@/lib/queries/bookings";
import { getReconciliationsAction } from "./actions";
import { ReconciliationForm } from "./reconciliation-form";

const ALLOWED_ROLES = ["owner", "manager", "crm", "csr", "csr_head", "csr_staff"];

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  draft:     { bg: "var(--cs-surface-warm)", color: "var(--cs-text-muted)" },
  submitted: { bg: "#FFF7ED",               color: "#92400E" },
  approved:  { bg: "#ECFDF5",               color: "#065F46" },
};

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

export default async function ReconciliationPage() {
  const { branchId, branchName } = await getContext();
  const today = new Date().toISOString().split("T")[0]!;

  const [summary, historyResult] = await Promise.all([
    getDailyPaymentSummary(branchId, today).catch(() => null),
    getReconciliationsAction(branchId, 20),
  ]);

  const history = historyResult.ok ? historyResult.data : [];

  const existing = history.find((r) => r.reconciliation_date === today) ?? null;

  return (
    <div>
      <PageHeader
        title="End-of-Day Reconciliation"
        description={`${branchName} · Verify today's collections against system records`}
        icon="📊"
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: "1.5rem",
          alignItems: "start",
        }}
      >
        {/* Left: Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Today's summary from system */}
          {summary && (
            <div className="cs-card" style={{ padding: "1.25rem" }}>
              <div
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: "var(--cs-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "1rem",
                }}
              >
                System Records — {new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" })}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
                {[
                  { label: "Total Bookings", value: summary.total_count },
                  { label: "Paid",           value: summary.paid_count },
                  { label: "Unpaid",         value: summary.unpaid_count },
                  { label: "Expected",       value: `₱${summary.total_expected.toLocaleString()}` },
                  { label: "Collected",      value: `₱${summary.total_collected.toLocaleString()}` },
                  { label: "Outstanding",    value: `₱${summary.total_unpaid.toLocaleString()}` },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    style={{
                      padding: "0.75rem",
                      borderRadius: 8,
                      backgroundColor: "var(--cs-surface-warm)",
                      border: "1px solid var(--cs-border)",
                    }}
                  >
                    <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--cs-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                      {kpi.label}
                    </div>
                    <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--cs-text)" }}>
                      {kpi.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reconciliation form */}
          <ReconciliationForm
            branchId={branchId}
            date={today}
            summary={summary}
            existing={
              existing
                ? {
                    actual_cash:  Number(existing.actual_cash),
                    actual_gcash: Number(existing.actual_gcash),
                    actual_maya:  Number(existing.actual_maya),
                    actual_card:  Number(existing.actual_card),
                    actual_other: Number(existing.actual_other),
                    notes:        existing.notes,
                    status:       existing.status,
                  }
                : null
            }
          />
        </div>

        {/* Right: History */}
        <div className="cs-card" style={{ padding: "1.25rem" }}>
          <div
            style={{
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: "var(--cs-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "1rem",
            }}
          >
            History
          </div>

          {history.length === 0 ? (
            <div style={{ padding: "1rem", textAlign: "center", color: "var(--cs-text-muted)", fontSize: "0.875rem" }}>
              No reconciliations yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              {history.map((rec) => {
                const totalActual =
                  Number(rec.actual_cash) +
                  Number(rec.actual_gcash) +
                  Number(rec.actual_maya) +
                  Number(rec.actual_card) +
                  Number(rec.actual_other);
                const totalExpected =
                  Number(rec.expected_cash) +
                  Number(rec.expected_gcash) +
                  Number(rec.expected_maya) +
                  Number(rec.expected_card) +
                  Number(rec.expected_other);
                const diff = totalActual - totalExpected;
                const style = STATUS_STYLE[rec.status] ?? STATUS_STYLE["draft"]!;

                return (
                  <div
                    key={rec.id}
                    style={{
                      padding: "0.75rem",
                      borderRadius: 8,
                      border: "1px solid var(--cs-border)",
                      backgroundColor: rec.reconciliation_date === today ? "var(--cs-sand-mist)" : "var(--cs-surface-warm)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--cs-text)" }}>
                        {new Date(rec.reconciliation_date + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                        {rec.reconciliation_date === today && (
                          <span style={{ marginLeft: 6, fontSize: "0.6875rem", color: "var(--cs-sand)", fontWeight: 700 }}>Today</span>
                        )}
                      </span>
                      <span
                        style={{
                          fontSize: "0.6875rem",
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: 4,
                          textTransform: "capitalize",
                          ...style,
                        }}
                      >
                        {rec.status}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem" }}>
                      <span style={{ color: "var(--cs-text-muted)" }}>
                        Actual: ₱{totalActual.toLocaleString()}
                      </span>
                      <span style={{ color: diff === 0 ? "var(--cs-text-muted)" : diff > 0 ? "var(--cs-info)" : "var(--cs-error)", fontWeight: 600 }}>
                        {diff === 0 ? "Balanced" : `${diff > 0 ? "+" : ""}₱${diff.toLocaleString()}`}
                      </span>
                    </div>
                    {rec.notes && (
                      <div style={{ marginTop: 4, fontSize: "0.75rem", color: "var(--cs-text-muted)", fontStyle: "italic" }}>
                        {rec.notes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
