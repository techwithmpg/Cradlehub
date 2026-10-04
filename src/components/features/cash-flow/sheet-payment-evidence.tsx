"use client";

import { useMemo, useState } from "react";
import { useSheetNativeReferences } from "@/components/features/crm/master-sheet/use-sheet-native-references";

function peso(value: number): string {
  return `₱${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function SheetPaymentEvidence({ businessDate }: { businessDate: string }) {
  const { state, isLoading } = useSheetNativeReferences(businessDate);
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState("all");
  const visible = useMemo(() => {
    const payments = state?.status === "available" ? state.payments : [];
    return payments.filter((item) => {
      if (channel !== "all" && item.channel !== channel) return false;
      const text =
        `${item.customerDisplay ?? ""} ${item.source.sheetName} ${item.channel}`.toLowerCase();
      return text.includes(search.trim().toLowerCase());
    });
  }, [channel, state, search]);

  return (
    <section
      className="rounded-xl border border-[#EAE4DC] bg-white p-4 shadow-sm sm:p-5"
      aria-label="Master Sheet payment evidence"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#1E1916]">Master Sheet payment evidence</h2>
          <p className="mt-1 text-xs text-[#6B5D52]">
            Sheet evidence only — not a recorded CradleHub payment. These values do not affect
            ledger totals.
          </p>
        </div>
        <span className="text-xs text-[#9C8878]">{businessDate}</span>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_170px]">
        <label className="grid gap-1 text-xs font-semibold text-[#6B5D52]">
          Search evidence
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Customer or source"
            className="h-9 rounded-lg border border-[#EAE4DC] px-3 text-sm text-[#1E1916]"
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-[#6B5D52]">
          Channel
          <select
            value={channel}
            onChange={(event) => setChannel(event.target.value)}
            className="h-9 rounded-lg border border-[#EAE4DC] px-2 text-sm text-[#1E1916]"
          >
            <option value="all">All channels</option>
            <option value="Cash">Cash</option>
            <option value="GCash">GCash</option>
            <option value="Bank / QR">Bank / QR</option>
            <option value="Card / terminal">Card / terminal</option>
          </select>
        </label>
      </div>
      <div className="mt-4" aria-live="polite">
        {isLoading ? (
          <p className="text-sm text-[#6B5D52]">Loading Master Sheet evidence…</p>
        ) : state?.status === "unavailable" ? (
          <p className="text-sm text-[#6B5D52]">Master Sheet evidence temporarily unavailable.</p>
        ) : state?.status === "outside_loaded_window" ? (
          <p className="text-sm text-[#6B5D52]">
            Evidence is available for the current and previous week only.
          </p>
        ) : state?.status === "forbidden" ? (
          <p className="text-sm text-[#6B5D52]">Evidence is not available for this branch.</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-[#6B5D52]">
            No Master Sheet payment evidence for this date and filter.
          </p>
        ) : (
          <div className="grid gap-2">
            {visible.map((item) => (
              <article
                key={item.evidenceKey}
                className="grid gap-2 rounded-lg border border-[#F0ECE5] bg-[#FAF8F5] p-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-[#1E1916]">
                    {item.customerDisplay ?? "Customer unknown"} · {item.channel}
                  </p>
                  <p className="mt-1 text-xs text-[#6B5D52]">
                    {item.source.sheetName}, rows {item.source.startRow}–{item.source.endRow} ·{" "}
                    {item.branchLabel} (provisional)
                  </p>
                  <p className="mt-1 text-xs text-[#6B5D52]">
                    Sheet evidence only — not a recorded CradleHub payment
                    {item.ambiguous ? " · ambiguous marker" : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                  <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-900">
                    Master Sheet
                  </span>
                  <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-700">
                    Read only
                  </span>
                  <span className="ml-1 font-semibold tabular-nums text-[#1E1916]">
                    {item.amount === null ? "Amount unknown" : peso(item.amount)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
