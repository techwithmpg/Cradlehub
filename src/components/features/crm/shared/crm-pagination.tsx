"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildPaginationRange } from "@/lib/attendance/crm-attendance-presenter";
import { cn } from "@/lib/utils";

/**
 * Shared accessible pagination bar used across CRM modules (Attendance,
 * Bookings, Cash Flow Ledger, Customers, Services).
 */
export function CrmPagination({
  page,
  pageSize,
  totalItems,
  itemLabel,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
  showPageSizeSelector = true,
  totalPagesOverride,
  summaryText,
}: {
  page: number;
  pageSize: number;
  totalItems: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  showPageSizeSelector?: boolean;
  totalPagesOverride?: number;
  summaryText?: string;
}) {
  const totalPages = Math.max(1, totalPagesOverride ?? Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(totalItems, safePage * pageSize);
  const range = buildPaginationRange(safePage, totalPages);

  return (
    <div className="flex flex-col gap-3 border-t border-[var(--cs-border-soft)] bg-[#FAF8F5] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-xs font-medium text-[var(--cs-text-muted)]">
        {summaryText ?? (
          <>
            Showing <span className="font-semibold text-[var(--cs-text)]">{start}</span> –{" "}
            <span className="font-semibold text-[var(--cs-text)]">{end}</span> of{" "}
            <span className="font-semibold text-[var(--cs-text)]">{totalItems}</span> {itemLabel}
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {showPageSizeSelector && onPageSizeChange ? (
          <label className="inline-flex items-center gap-1.5 text-xs text-[var(--cs-text-muted)]">
            <span className="sr-only">Rows per page</span>
            <select
              aria-label="Rows per page"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 rounded-lg border border-[var(--cs-border)] bg-white px-2.5 text-xs font-semibold text-[var(--cs-text)] outline-none focus:border-[#1F4E33]"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} per page
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <nav aria-label={`${itemLabel} pagination`} className="inline-flex items-center gap-1">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            aria-label="Previous"
            className="inline-flex size-8 items-center justify-center rounded-lg border border-[var(--cs-border)] bg-white text-[var(--cs-text-secondary)] transition hover:bg-[var(--cs-surface-warm)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
          </button>

          {range.map((entry, idx) =>
            entry === "ellipsis" ? (
              <span
                key={`ellipsis-${idx}`}
                className="px-1.5 text-xs font-semibold text-[var(--cs-text-muted)]"
              >
                …
              </span>
            ) : (
              <button
                key={entry}
                type="button"
                onClick={() => onPageChange(entry)}
                aria-current={entry === safePage ? "page" : undefined}
                className={cn(
                  "inline-flex size-8 items-center justify-center rounded-lg border text-xs font-bold transition",
                  entry === safePage
                    ? "border-[#1F4E33] bg-[#1F4E33] text-white"
                    : "border-[var(--cs-border)] bg-white text-[var(--cs-text-secondary)] hover:border-[#1F4E33]/50 hover:text-[var(--cs-text)]"
                )}
              >
                {entry}
              </button>
            )
          )}

          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
            aria-label="Next"
            className="inline-flex size-8 items-center justify-center rounded-lg border border-[var(--cs-border)] bg-white text-[var(--cs-text-secondary)] transition hover:bg-[var(--cs-surface-warm)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="size-4" />
          </button>
        </nav>
      </div>
    </div>
  );
}
