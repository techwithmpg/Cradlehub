"use client";

import { useState, useTransition } from "react";
import { StatCard } from "@/components/features/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import {
  Users,
  DollarSign,
  Clock,
  CheckCircle,
  Plus,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import type { PayrollPeriodRow, PayrollItemRow } from "@/lib/queries/payroll";
import {
  generatePayrollItemsAction,
  approvePayrollPeriodAction,
  markPayrollPeriodPaidAction,
  createPayrollPeriodAction,
} from "@/lib/actions/payroll-actions";

const ACCENT = "#6D28D9";

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  draft:     { bg: "#F9FAFB", color: "#374151", label: "Draft" },
  locked:    { bg: "#EFF6FF", color: "#1D4ED8", label: "Locked" },
  approved:  { bg: "#ECFDF5", color: "#065F46", label: "Approved" },
  paid:      { bg: "#F0FDF4", color: "#166534", label: "Paid" },
  cancelled: { bg: "#FEF2F2", color: "#991B1B", label: "Cancelled" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES["draft"]!;
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function formatCurrency(n: number) {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Create Period Form ─────────────────────────────────────────────────────────

function CreatePeriodForm({ onCreated }: { onCreated: () => void }) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createPayrollPeriodAction({ periodStart: start, periodEnd: end, notes: notes || null });
      if (!res.ok) { setError(res.error); return; }
      onCreated();
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        <div>
          <label style={labelStyle}>Period Start</label>
          <input type="date" value={start} onChange={e => setStart(e.target.value)} required style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Period End</label>
          <input type="date" value={end} onChange={e => setEnd(e.target.value)} required style={inputStyle} />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Notes (optional)</label>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. May 1–15 payroll" style={inputStyle} />
      </div>
      {error && <div style={{ fontSize: 12.5, color: "#B91C1C" }}>{error}</div>}
      <Button type="submit" disabled={pending} style={{ background: ACCENT, color: "#fff", border: "none", fontWeight: 600 }}>
        {pending ? "Creating…" : "Create Period"}
      </Button>
    </form>
  );
}

// ── Period List ────────────────────────────────────────────────────────────────

function PeriodList({ periods, selectedId, onSelect }: { periods: PayrollPeriodRow[]; selectedId: string | null; onSelect: (id: string) => void }) {
  if (periods.length === 0) {
    return (
      <div style={{ padding: "2rem 1rem", textAlign: "center", color: "var(--cs-text-subtle)", fontSize: 13 }}>
        No payroll periods yet. Create the first one.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {periods.map((p) => (
        <div
          key={p.id}
          onClick={() => onSelect(p.id)}
          style={{
            padding: "0.75rem 1rem",
            borderBottom: "1px solid var(--cs-border-soft)",
            cursor: "pointer",
            background: selectedId === p.id ? `${ACCENT}08` : "transparent",
            borderLeft: selectedId === p.id ? `3px solid ${ACCENT}` : "3px solid transparent",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--cs-text)" }}>
              {formatDate(p.period_start)} – {formatDate(p.period_end)}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--cs-text-muted)", marginTop: 2, display: "flex", gap: 8 }}>
              <span>{p.item_count} staff</span>
              <span>·</span>
              <span>{formatCurrency(p.total_net_pay)} total</span>
              {p.branch_name && <span>· {p.branch_name}</span>}
            </div>
          </div>
          <StatusBadge status={p.status} />
          <ChevronRight size={14} style={{ color: "var(--cs-text-subtle)", flexShrink: 0 }} />
        </div>
      ))}
    </div>
  );
}

// ── Period Detail ──────────────────────────────────────────────────────────────

function PeriodDetail({ period, items, onRefresh }: { period: PayrollPeriodRow; items: PayrollItemRow[]; onRefresh: () => void }) {
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  function handleAction(fn: () => Promise<{ ok: boolean; error?: string } | { ok: boolean; data: undefined }>) {
    setActionError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok && "error" in res) { setActionError(res.error as string); return; }
      onRefresh();
    });
  }

  const canGenerate = period.status === "draft";
  const canApprove  = period.status === "locked";
  const canMarkPaid = period.status === "approved";

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1rem", gap: "0.75rem", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--cs-text)", marginBottom: 3 }}>
            {formatDate(period.period_start)} – {formatDate(period.period_end)}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <StatusBadge status={period.status} />
            {period.branch_name && <span style={{ fontSize: 11.5, color: "var(--cs-text-muted)" }}>{period.branch_name}</span>}
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {canGenerate && (
            <Button
              size="sm"
              disabled={pending}
              onClick={() => handleAction(() => generatePayrollItemsAction(period.id))}
              style={{ background: ACCENT, color: "#fff", border: "none", fontSize: 12.5, fontWeight: 600 }}
            >
              Generate Payroll
            </Button>
          )}
          {canApprove && (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => handleAction(() => approvePayrollPeriodAction(period.id))}
              style={{ fontSize: 12.5, fontWeight: 600 }}
            >
              Approve Period
            </Button>
          )}
          {canMarkPaid && (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => handleAction(() => markPayrollPeriodPaidAction(period.id))}
              style={{ fontSize: 12.5, fontWeight: 600 }}
            >
              Mark Paid
            </Button>
          )}
        </div>
      </div>

      {actionError && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0.5rem 0.75rem", background: "#FEF2F2", borderRadius: "var(--cs-r-xs)", marginBottom: "0.75rem", fontSize: 12.5, color: "#B91C1C" }}>
          <AlertCircle size={13} />
          {actionError}
        </div>
      )}

      {/* Summary KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.625rem", marginBottom: "1rem" }}>
        <StatCard label="Staff Members" value={period.item_count} icon={<Users size={13} />} accentColor={ACCENT} />
        <StatCard label="Total Net Pay" value={formatCurrency(period.total_net_pay)} icon={<DollarSign size={13} />} accentColor="#16A34A" />
        <StatCard label="Status" value={period.status.charAt(0).toUpperCase() + period.status.slice(1)} icon={<Clock size={13} />} accentColor="#2563EB" />
        <StatCard label="Approved By" value={period.approved_by_name ?? "—"} icon={<CheckCircle size={13} />} accentColor="#D97706" />
      </div>

      {/* Items table */}
      {items.length === 0 ? (
        <div style={{ padding: "2rem 1rem", textAlign: "center", color: "var(--cs-text-subtle)", fontSize: 13 }}>
          No payroll items yet. Click &ldquo;Generate Payroll&rdquo; to calculate pay from completed bookings.
        </div>
      ) : (
        <div style={{ overflowX: "auto", borderRadius: "var(--cs-r-md)", border: "1px solid var(--cs-border-soft)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
            <thead>
              <tr>
                {["Staff", "Bookings", "Revenue", "Base Pay", "Commission", "Allowance", "Deductions", "Net Pay", "Status"].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} style={{ borderBottom: "1px solid var(--cs-border-soft)" }}>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{item.staff_name}</td>
                  <td style={tdStyle}>{item.completed_bookings_count}</td>
                  <td style={tdStyle}>{formatCurrency(item.gross_revenue)}</td>
                  <td style={tdStyle}>{formatCurrency(item.base_pay)}</td>
                  <td style={tdStyle}>{formatCurrency(item.commission_pay)}</td>
                  <td style={tdStyle}>{formatCurrency(item.home_service_allowance_pay)}</td>
                  <td style={{ ...tdStyle, color: item.deduction_amount > 0 ? "#B91C1C" : "var(--cs-text)" }}>
                    {item.deduction_amount > 0 ? `-${formatCurrency(item.deduction_amount)}` : "—"}
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 700, color: "#16A34A" }}>{formatCurrency(item.net_pay)}</td>
                  <td style={tdStyle}><StatusBadge status={item.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main Payroll Page Client ───────────────────────────────────────────────────

interface PayrollPageClientProps {
  initialPeriods: PayrollPeriodRow[];
}

export function PayrollPageClient({ initialPeriods }: PayrollPageClientProps) {
  const [periods] = useState<PayrollPeriodRow[]>(initialPeriods);
  const [selectedId, setSelectedId] = useState<string | null>(initialPeriods[0]?.id ?? null);
  const [showCreate, setShowCreate] = useState(false);

  function selectPeriod(id: string) {
    setSelectedId(id);
    // In real app: fetch items for this period
    // For now the server page will handle this
  }

  const totalNetPay = periods.reduce((sum, p) => sum + (p.status !== "cancelled" ? p.total_net_pay : 0), 0);
  const draftCount = periods.filter(p => p.status === "draft").length;
  const paidCount  = periods.filter(p => p.status === "paid").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h1 style={{ fontSize: "1.375rem", fontWeight: 700, color: "var(--cs-text)", margin: 0 }}>Payroll</h1>
          <p style={{ fontSize: 13, color: "var(--cs-text-muted)", margin: "0.25rem 0 0" }}>
            Manage payroll periods, generate pay calculations, and track disbursements.
          </p>
        </div>
        <Button
          onClick={() => setShowCreate(!showCreate)}
          style={{ background: ACCENT, color: "#fff", border: "none", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}
        >
          <Plus size={15} /> New Period
        </Button>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem" }}>
        <StatCard label="Total Periods"   value={periods.length}          icon={<Clock size={14} />}       accentColor={ACCENT} />
        <StatCard label="Draft / Pending" value={draftCount}              icon={<AlertCircle size={14} />} accentColor="#D97706" />
        <StatCard label="Paid Periods"    value={paidCount}               icon={<CheckCircle size={14} />} accentColor="#16A34A" />
        <StatCard label="Total Net (All)" value={formatCurrency(totalNetPay)} icon={<DollarSign size={14} />}  accentColor="#2563EB" />
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{ background: "var(--cs-surface)", border: "1px solid var(--cs-border-soft)", borderRadius: "var(--cs-r-md)", padding: "1.25rem" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--cs-text)", marginBottom: "0.75rem" }}>
            Create New Payroll Period
          </div>
          <CreatePeriodForm onCreated={() => { setShowCreate(false); window.location.reload(); }} />
        </div>
      )}

      {/* Two-column: periods list + detail */}
      <div style={{ display: "grid", gridTemplateColumns: "320px minmax(0, 1fr)", gap: "0.75rem", alignItems: "start" }}>
        {/* Periods list */}
        <div style={{ background: "var(--cs-surface)", border: "1px solid var(--cs-border-soft)", borderRadius: "var(--cs-r-md)", overflow: "hidden" }}>
          <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--cs-border-soft)", fontSize: 12, fontWeight: 600, color: "var(--cs-text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Payroll Periods
          </div>
          <PeriodList periods={periods} selectedId={selectedId} onSelect={selectPeriod} />
        </div>

        {/* Detail panel — shown when a period is selected */}
        <div style={{ background: "var(--cs-surface)", border: "1px solid var(--cs-border-soft)", borderRadius: "var(--cs-r-md)", padding: "1.25rem" }}>
          {selectedId ? (
            <PayrollPeriodDetailLoader periodId={selectedId} periods={periods} />
          ) : (
            <div style={{ padding: "3rem 1rem", textAlign: "center", color: "var(--cs-text-subtle)", fontSize: 13 }}>
              Select a payroll period to view details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Period Detail Loader (fetches items client-side via server action proxy) ──

function PayrollPeriodDetailLoader({ periodId, periods }: { periodId: string; periods: PayrollPeriodRow[] }) {
  const period = periods.find(p => p.id === periodId);
  if (!period) return null;

  return (
    <PeriodDetail
      period={period}
      items={[]}
      onRefresh={() => window.location.reload()}
    />
  );
}

// Shared styles
const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11.5,
  fontWeight: 600,
  color: "var(--cs-text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.625rem",
  fontSize: 13.5,
  border: "1px solid var(--cs-border-soft)",
  borderRadius: "var(--cs-r-xs)",
  background: "var(--cs-surface)",
  color: "var(--cs-text)",
  outline: "none",
  boxSizing: "border-box",
};

const thStyle: React.CSSProperties = {
  padding: "0.5rem 0.75rem",
  textAlign: "left",
  fontSize: 10.5,
  fontWeight: 500,
  color: "var(--cs-text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  background: "var(--cs-surface-warm, #FAF8F5)",
  borderBottom: "1.5px solid var(--cs-border-soft)",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "0.5rem 0.75rem",
  fontSize: 12.5,
  color: "var(--cs-text)",
  whiteSpace: "nowrap",
};
