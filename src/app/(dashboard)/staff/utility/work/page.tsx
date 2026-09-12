import Link from "next/link";
import { ArrowLeft, ClipboardList } from "lucide-react";

export const metadata = {
  title: "Work | CradleHub Staff",
};

export default function UtilityWorkPage() {
  return (
    <div className="mx-auto max-w-lg p-4 sm:p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#163A2B] text-[#C8A96B]">
          <ClipboardList size={20} aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-[#1E293B]">Work</h1>
          <p className="text-xs text-[#64748B]">Utility Operations</p>
        </div>
      </div>

      <div className="rounded-2xl border border-[#EAE4DC] bg-white p-6 shadow-xs text-center">
        <h2 className="text-base font-bold text-[#1E293B] mb-2">
          Work is unavailable
        </h2>
        <p className="text-xs text-[#475569] leading-relaxed mb-6">
          There is no supported work information for this workspace yet. Use the available Attendance, Schedule or Scan options from Today.
        </p>

        <Link
          href="/staff/utility"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#163A2B] px-5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#10261D] active:scale-95"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Back to Today</span>
        </Link>
      </div>
    </div>
  );
}
