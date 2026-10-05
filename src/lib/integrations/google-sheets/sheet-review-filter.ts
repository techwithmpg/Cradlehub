import type { SheetReviewReason } from "./sheet-review";
import type { SheetReviewRecord } from "./sheet-review-projection";

export type SheetReviewFilters = {
  type: "all" | SheetReviewRecord["kind"];
  date: string;
  reason: "all" | SheetReviewReason | "BRANCH_UNKNOWN";
  query: string;
};

/** Searches display text only; it never matches canonical people or records. */
export function filterSheetReviewRecords(
  records: readonly SheetReviewRecord[],
  filters: SheetReviewFilters
): SheetReviewRecord[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return records.filter((record) => {
    if (filters.type !== "all" && record.kind !== filters.type) return false;
    if (filters.date && record.businessDate !== filters.date) return false;
    if (
      filters.reason !== "all" &&
      filters.reason !== "BRANCH_UNKNOWN" &&
      !record.reviewReasons.includes(filters.reason)
    )
      return false;
    if (!query) return true;
    const searchable =
      record.kind === "visit"
        ? [
            record.customerDisplay,
            record.staffDisplay,
            ...record.services.map((service) => service.name),
          ]
        : record.kind === "duty"
          ? [record.staffDisplay, record.dutyLabel]
          : [];
    return searchable.some((value) => value?.toLocaleLowerCase().includes(query));
  });
}
