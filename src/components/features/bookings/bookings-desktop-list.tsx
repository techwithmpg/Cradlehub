"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BookingListRow } from "./booking-list-row";
import type { WorkspaceBookingRow } from "./booking-workspace-types";
import { cn } from "@/lib/utils";

const ROW_OPTIONS = [8, 10, 20] as const;

function pageButtons(totalPages: number, currentPage: number): number[] {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index);
  const start = Math.max(0, Math.min(currentPage - 2, totalPages - 5));
  return Array.from({ length: 5 }, (_, index) => start + index);
}

function updatePageQuery(pageIndex: number) {
  const params = new URLSearchParams(window.location.search);
  if (pageIndex === 0) params.delete("page");
  else params.set("page", String(pageIndex + 1));
  const query = params.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
}

export function BookingsDesktopList({
  bookings,
  selectedId,
  initialPage = 1,
  onSelect,
}: {
  bookings: WorkspaceBookingRow[];
  selectedId: string | null;
  initialPage?: number;
  onSelect: (booking: WorkspaceBookingRow) => void;
}) {
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [pageIndex, setPageIndex] = useState(() => Math.max(0, initialPage - 1));
  const totalPages = Math.max(1, Math.ceil(bookings.length / rowsPerPage));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const startIndex = safePageIndex * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, bookings.length);
  const pageRows = useMemo(
    () => bookings.slice(startIndex, endIndex),
    [bookings, endIndex, startIndex]
  );

  function goToPage(nextPage: number) {
    const safePage = Math.min(Math.max(nextPage, 0), totalPages - 1);
    setPageIndex(safePage);
    updatePageQuery(safePage);
  }

  if (bookings.length === 0) {
    return (
      <div className="flex min-h-[360px] items-center justify-center px-6 text-center">
        <div>
          <p className="text-sm font-semibold text-[var(--cs-text)]">No bookings found</p>
          <p className="mt-1 text-sm text-[var(--cs-text-muted)]">Adjust the quick filter, search, or exact filters.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <table className="w-full table-fixed border-separate border-spacing-0">
          <thead className="sticky top-0 z-10 bg-[var(--cs-surface-warm)]">
            <tr>
              {[
                ["Time", "w-[23%]"],
                ["Customer", "w-[47%]"],
                ["Status", "w-[30%]"],
              ].map(([label, width]) => (
                <th key={label} className={cn("border-b border-[var(--cs-border-soft)] px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--cs-text-muted)]", width)}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((booking) => (
              <BookingListRow
                key={booking.id}
                booking={booking}
                selected={booking.id === selectedId}
                onSelect={() => onSelect(booking)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--cs-border-soft)] bg-white px-4 py-3">
        <span className="text-xs text-[var(--cs-text-muted)]">
          Showing {startIndex + 1} to {endIndex} of {bookings.length} bookings
        </span>
        <nav className="flex items-center gap-2" aria-label="Booking pagination">
          <button type="button" aria-label="Previous page" disabled={safePageIndex === 0} onClick={() => goToPage(safePageIndex - 1)} className="flex size-8 items-center justify-center rounded-lg border border-[var(--cs-border)] bg-white disabled:opacity-40">
            <ChevronLeft className="size-4" />
          </button>
          {pageButtons(totalPages, safePageIndex).map((index) => (
            <button key={index} type="button" aria-current={index === safePageIndex ? "page" : undefined} onClick={() => goToPage(index)} className={cn("flex size-8 items-center justify-center rounded-lg border text-xs font-semibold", index === safePageIndex ? "border-emerald-900 bg-emerald-900 text-white" : "border-[var(--cs-border)] bg-white text-[var(--cs-text)]")}>
              {index + 1}
            </button>
          ))}
          <button type="button" aria-label="Next page" disabled={safePageIndex >= totalPages - 1} onClick={() => goToPage(safePageIndex + 1)} className="flex size-8 items-center justify-center rounded-lg border border-[var(--cs-border)] bg-white disabled:opacity-40">
            <ChevronRight className="size-4" />
          </button>
        </nav>
        <label className="inline-flex items-center gap-2 text-xs text-[var(--cs-text-muted)]">
          Rows per page
          <select value={rowsPerPage} onChange={(event) => { setRowsPerPage(Number(event.target.value)); setPageIndex(0); updatePageQuery(0); }} className="h-8 rounded-lg border border-[var(--cs-border)] bg-white px-2 text-[var(--cs-text)]">
            {ROW_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
      </footer>
    </div>
  );
}
