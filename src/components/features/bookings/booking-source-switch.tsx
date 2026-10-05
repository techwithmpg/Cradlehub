"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export function BookingSourceSwitch({ source }: { source: "cradlehub" | "master_sheet" }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const href = (next: "cradlehub" | "master_sheet") => {
    const params = new URLSearchParams();
    for (const key of ["date", "search", "branch"]) {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
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
