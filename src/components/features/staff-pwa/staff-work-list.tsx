import Link from "next/link";
import type { StaffWorkResult } from "@/lib/staff-pwa/work-model";

export function StaffWorkList({ result, limit = 150 }: { result: StaffWorkResult; limit?: number }) {
  return <section className="space-y-3">
    {result.errors.map(error => <p key={error} role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>)}
    {!result.items.length && !result.errors.length ? <p className="p-3 text-sm">No work requiring attention in this view.</p> : null}
    {result.items.slice(0, limit).map(item => <article key={`${item.source}:${item.id}`} className="rounded-[20px] border border-[#E9E4DC] bg-white p-4">
      <h2 className="font-bold text-[#24394B]">{item.title}</h2>
      <p className="mt-1 text-sm text-[#66788B]">{item.detail}</p>
      {item.href ? <Link href={item.href} className="mt-2 inline-flex min-h-11 items-center font-semibold text-[#0D6548]">{item.source === "attendance_exceptions" ? "Review attendance issue" : "Review booking"}</Link>
        : <p className="mt-2 text-xs text-[#66788B]">Read-only update</p>}
    </article>)}
  </section>;
}
