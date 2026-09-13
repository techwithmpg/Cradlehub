"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markStaffNoticeRead, respondToStaffAttendanceNotice } from "@/lib/staff-pwa/notice-actions";
import type { StaffNotice } from "@/lib/staff-pwa/notices-runtime";

export function StaffNoticesList({ items }: { items: StaffNotice[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  function markRead(id: string) {
    startTransition(async () => {
      setError(null);
      try {
        const result = await markStaffNoticeRead(id);
        if (!result.ok) { setError(result.error ?? "Notice update unavailable."); return; }
        router.refresh();
      } catch { setError("Notice update could not be confirmed."); }
    });
  }
  function respond(id: string, form: HTMLFormElement) {
    const response = String(new FormData(form).get("response") ?? "");
    startTransition(async () => {
      setError(null);
      try {
        const result = await respondToStaffAttendanceNotice(id, response);
        if (!result.ok) { setError(result.error ?? "Response unavailable."); return; }
        form.reset(); router.refresh();
      } catch { setError("Response could not be confirmed."); }
    });
  }
  return <section className="space-y-3">
    {error ? <p role="alert" className="text-red-700">{error}</p> : null}
    {items.map(item => <article key={item.id} className="rounded-[20px] border border-[#E9E4DC] bg-white p-4">
      <h2 className="font-bold">{item.title}</h2>
      <p className="mt-1 text-sm">{item.body}</p>
      <p className="mt-1 text-xs text-stone-500">{item.createdAt}</p>
      {item.responseRequired ? <form className="mt-3 space-y-2" onSubmit={event => { event.preventDefault(); respond(item.id, event.currentTarget); }}>
        <label className="block text-sm" htmlFor={`response-${item.id}`}>Your response</label>
        <textarea id={`response-${item.id}`} name="response" required maxLength={1000} className="w-full rounded-lg border p-2" />
        <button type="submit" disabled={pending} className="min-h-11 rounded-lg bg-[#0D6548] px-4 text-sm text-white disabled:opacity-50">Send response</button>
      </form> : null}
      <div className="mt-2 flex gap-4">
        <Link href={item.href} className="inline-flex min-h-11 items-center font-semibold text-[#0D6548]">Review</Link>
        {item.status === "unread" ? <button type="button" disabled={pending} onClick={() => markRead(item.id)} className="min-h-11 text-sm underline disabled:opacity-50">Mark read</button> : <span className="py-3 text-sm text-stone-500">Read</span>}
      </div>
    </article>)}
  </section>;
}
