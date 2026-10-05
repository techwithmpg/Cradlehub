"use client";

import React from "react";
import { Database, FileSpreadsheet } from "lucide-react";

export function ReportsHeader() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between border-b border-stone-200/80 pb-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">Reports</h1>
        <p className="mt-1 text-sm text-stone-500">Business performance and operational insights</p>
      </div>

      {/* Data Sources Provenance Indicator */}
      <div className="flex flex-col items-start sm:items-end gap-1.5 self-start">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">
          Data Sources
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {/* CradleHub Canonical */}
          <div
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/80 px-2.5 py-1 text-xs font-medium text-emerald-800 shadow-xs"
            title="CradleHub canonical business records from Postgres/Supabase"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
            <Database className="h-3 w-3 text-emerald-700" />
            <span>CradleHub</span>
            <span className="hidden md:inline text-[10px] text-emerald-600/80 border-l border-emerald-200 pl-1.5">
              Canonical
            </span>
          </div>

          {/* Master Sheet External Evidence */}
          <div
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50/80 px-2.5 py-1 text-xs font-medium text-amber-800 shadow-xs"
            title="Master Sheet external read-only operational evidence (0 effect on canonical totals)"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <FileSpreadsheet className="h-3 w-3 text-amber-700" />
            <span>Master Sheet</span>
            <span className="hidden md:inline text-[10px] text-amber-600/80 border-l border-amber-200 pl-1.5">
              External Read-Only
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
