"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  businessDateInManila,
  isInNativeSheetWindow,
} from "@/lib/integrations/google-sheets/sheet-week";

export function sourceSwitchDates(date: string, today: string, savedCradlehubDate?: string | null) {
  return {
    sheetDate: isInNativeSheetWindow(date, today) ? date : today,
    cradlehubDate: savedCradlehubDate ?? date,
  };
}

export function BookingSourceSwitch({ source }: { source: "cradlehub" | "master_sheet" }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const href = (next: "cradlehub" | "master_sheet") => {
    const params = new URLSearchParams();
    for (const key of ["date", "search", "branch"]) {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    }
    const date = searchParams.get("date") ?? businessDateInManila(new Date());
    const dates = sourceSwitchDates(
      date,
      businessDateInManila(new Date()),
      searchParams.get("cradlehubDate")
    );
    if (next === "master_sheet") {
      params.set("date", dates.sheetDate);
      params.set("cradlehubDate", dates.cradlehubDate);
    } else {
      params.set("date", dates.cradlehubDate);
    }
    params.set("referenceSource", next);
    return `${pathname}?${params.toString()}`;
  };
  return (
    <nav
      aria-label="Booking source"
      className="inline-flex w-fit rounded-lg border border-border bg-muted/50 p-1"
    >
      {(["cradlehub", "master_sheet"] as const).map((value) => (
        <Link
          key={value}
          href={href(value)}
          aria-current={source === value ? "page" : undefined}
          className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
            source === value
              ? "bg-emerald-900 text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {value === "cradlehub" ? "CradleHub" : "Master Sheet"}
        </Link>
      ))}
    </nav>
  );
}
