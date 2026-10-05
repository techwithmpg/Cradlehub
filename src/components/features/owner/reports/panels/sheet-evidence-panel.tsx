"use client";

import React from "react";
import type { OwnerReportsData, ReportTab } from "@/lib/owner/reports-types";
import { formatPeso } from "@/lib/owner/reports";
import { FileSpreadsheet, AlertTriangle, Info, Clock, ShieldCheck } from "lucide-react";

export interface SheetEvidencePanelProps {
  data: OwnerReportsData;
  onNavigateToTab?: (tab: ReportTab) => void;
}

export function SheetEvidencePanel({ data }: SheetEvidencePanelProps) {
  const sheetEvidence = data.sheetEvidence;

  return (
    <div className="space-y-6">
      {/* ── Strict Provenance Banner ──────────────────────────────── */}
      <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-4 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-amber-200/80 p-2 text-amber-900 shrink-0">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-amber-950">
                  Master Sheet Operational Evidence (Stage 1D/1E Projection)
                </span>
                <span className="rounded bg-amber-200/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-900">
                  Read-Only External
                </span>
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                  Noncanonical
                </span>
              </div>
              <p className="mt-1 text-xs text-amber-900/80 leading-relaxed">
                External Google Sheets records for operational cross-reference only. Sheet evidence
                records are never merged or summed into canonical CradleHub totals.
              </p>
            </div>
          </div>

          <div className="shrink-0 rounded-lg border border-amber-300/80 bg-white/80 px-3 py-2 text-center shadow-2xs">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-800">
              Effect on Canonical Totals
            </span>
            <span className="text-sm font-extrabold text-stone-900">₱0.00</span>
          </div>
        </div>
      </div>

      {/* ── Branch Provenance Warning ─────────────────────────────── */}
      <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-xs text-stone-600">
        <Info className="h-4 w-4 text-stone-500 shrink-0" />
        <span>
          <strong>Branch Provenance Rule:</strong> Sheet evidence does not inherit the selected
          reporting scope. Records with unverified branch origin remain explicitly labelled as{" "}
          <code className="rounded bg-stone-200 px-1 py-0.5 text-[11px] font-mono text-stone-800">
            BRANCH_UNKNOWN
          </code>
          .
        </span>
      </div>

      {!sheetEvidence || sheetEvidence.status === "unavailable" ? (
        <div className="flex h-56 flex-col items-center justify-center rounded-xl border border-dashed border-amber-200 bg-amber-50/30 p-6 text-center">
          <FileSpreadsheet className="h-8 w-8 text-amber-400 mb-2" />
          <h3 className="text-sm font-bold text-amber-950">Master Sheet Evidence Unavailable</h3>
          <p className="mt-1 max-w-md text-xs text-amber-800/80">
            {sheetEvidence?.status === "forbidden"
              ? "Access to Google Sheet projections is restricted for this credential."
              : "Google Sheet credentials are not configured or the operational sheet is currently unreachable."}
          </p>
        </div>
      ) : (
        <>
          {/* ── Summary KPI Row ───────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-stone-200/90 bg-white p-4 shadow-xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                Observed Records
              </span>
              <div className="mt-2 text-2xl font-bold tracking-tight text-stone-900">
                {sheetEvidence.totalRecords.toLocaleString()}
              </div>
              <div className="mt-1 text-[11px] text-stone-500">Total sheet rows parsed</div>
            </div>

            <div className="rounded-xl border border-stone-200/90 bg-white p-4 shadow-xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                Client Visits
              </span>
              <div className="mt-2 text-2xl font-bold tracking-tight text-stone-900">
                {sheetEvidence.visitCount.toLocaleString()}
              </div>
              <div className="mt-1 text-[11px] text-stone-500">Operational appointments</div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 shadow-xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-800">
                Needs Review
              </span>
              <div className="mt-2 text-2xl font-bold tracking-tight text-amber-950">
                {sheetEvidence.needsReviewCount.toLocaleString()}
              </div>
              <div className="mt-1 text-[11px] text-amber-800/80">
                Possible overlaps / anomalies
              </div>
            </div>

            <div className="rounded-xl border border-stone-200/90 bg-white p-4 shadow-xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                Evidence Amount
              </span>
              <div className="mt-2 text-2xl font-bold tracking-tight text-stone-900">
                {formatPeso(sheetEvidence.evidenceAmount)}
              </div>
              <div className="mt-1 text-[11px] text-stone-500">Noncanonical evidence only</div>
            </div>
          </div>

          {/* ── Recent Visits Evidence Table ─────────────────────────── */}
          <div className="rounded-xl border border-stone-200/90 bg-white p-5 shadow-xs">
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-bold text-stone-900">Operational Visit Records</h2>
                <p className="text-xs text-stone-500">
                  Read-only operational visit entries from the projected Master Sheet
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-stone-500">
                <Clock className="h-3.5 w-3.5" />
                <span>Observed at: {new Date(sheetEvidence.observedAt).toLocaleTimeString()}</span>
              </div>
            </div>

            {!sheetEvidence.recentVisits || sheetEvidence.recentVisits.length === 0 ? (
              <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-stone-200 text-xs text-stone-500">
                No recent visit entries projected from sheet
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-400 font-semibold uppercase text-[10px]">
                      <th className="pb-2.5">Date & Time</th>
                      <th className="pb-2.5">Customer</th>
                      <th className="pb-2.5">Attendant</th>
                      <th className="pb-2.5">Services</th>
                      <th className="pb-2.5">Channel</th>
                      <th className="pb-2.5 text-right">Amount</th>
                      <th className="pb-2.5">Branch</th>
                      <th className="pb-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 font-sans">
                    {sheetEvidence.recentVisits.map((v) => (
                      <tr key={v.id} className="hover:bg-amber-50/20 transition-colors">
                        <td className="py-2.5 text-stone-700 whitespace-nowrap">
                          {v.date ?? "—"} {v.time ? `• ${v.time}` : ""}
                        </td>
                        <td className="py-2.5 font-medium text-stone-900">
                          {v.customer ?? "Guest"}
                        </td>
                        <td className="py-2.5 text-stone-600">{v.attendant ?? "Unassigned"}</td>
                        <td
                          className="py-2.5 text-stone-600 max-w-[180px] truncate"
                          title={v.services}
                        >
                          {v.services || "—"}
                        </td>
                        <td className="py-2.5">
                          <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-600">
                            {v.channel || "Standard"}
                          </span>
                        </td>
                        <td className="py-2.5 text-right font-semibold text-stone-900">
                          {v.amount !== null ? formatPeso(v.amount) : "—"}
                        </td>
                        <td className="py-2.5">
                          <span className="rounded bg-stone-200/70 px-1.5 py-0.5 text-[10px] font-mono text-stone-600">
                            BRANCH_UNKNOWN
                          </span>
                        </td>
                        <td className="py-2.5">
                          {v.reasons.length > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                              <AlertTriangle className="h-3 w-3" />
                              <span>Review ({v.reasons.length})</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
                              <ShieldCheck className="h-3 w-3" />
                              <span>Observed</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
