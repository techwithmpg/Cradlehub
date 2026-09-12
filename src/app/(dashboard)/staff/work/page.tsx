import Link from "next/link";
import {
  ArrowLeft,
  ClipboardList,
  QrCode,
} from "lucide-react";

export const metadata = {
  title: "Work | CradleHub Staff",
};

export default function StaffWorkPage() {
  return (
    <div className="mx-auto max-w-[480px] px-4 pb-4 pt-4">
      <div className="flex items-center gap-3">
        <Link
          href="/staff"
          aria-label="Back to Today"
          className="grid size-9 place-items-center rounded-full border border-[#E4DED5] bg-white text-[#324759]"
        >
          <ArrowLeft size={16} />
        </Link>

        <div>
          <h1 className="text-[21px] font-bold tracking-[-0.03em] text-[#183044]">
            Work
          </h1>

          <p className="text-[10.5px] text-[#758395]">
            CRM / General Staff
          </p>
        </div>
      </div>

      <section className="mt-5 rounded-[22px] border border-[#E9E4DC] bg-white p-5 shadow-[0_6px_22px_rgba(30,41,59,0.05)]">
        <div className="grid size-12 place-items-center rounded-full bg-[#F7EFE0] text-[#8A6028]">
          <ClipboardList size={21} />
        </div>

        <h2 className="mt-4 text-[16px] font-bold text-[#263B4D]">
          Mobile work queue not connected
        </h2>

        <p className="mt-2 text-[11.5px] leading-5 text-[#718092]">
          There is no authoritative CRM task queue connected to
          this Staff PWA yet. Use Today for attendance, Scan for
          authorized QR actions, and Notices for staff updates.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link
            href="/staff"
            className="flex min-h-11 items-center justify-center rounded-[13px] border border-[#D9E4DC] bg-[#F8FAF8] text-[11.5px] font-bold text-[#315747]"
          >
            Back to Today
          </Link>

          <a
            href="/staff/scan"
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-[13px] bg-[#0D6548] text-[11.5px] font-bold text-white"
          >
            <QrCode size={14} />
            Scan
          </a>
        </div>
      </section>
    </div>
  );
}