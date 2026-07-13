"use client";

import { ShieldCheck } from "lucide-react";

export function ApprovedExceptionsPanel() {
  return (
    <section className="rounded-lg border border-[#e3dccf] bg-white p-5 shadow-sm">
      <h3 className="text-sm font-bold text-[#181713]">Approved Exceptions</h3>
      <p className="mt-1 text-xs text-[#615c52]">Special cases and approvals attached to this staff schedule.</p>
      <div className="mt-5 flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed border-[#ddd4c5] bg-[#fbfaf7] px-6 text-center">
        <ShieldCheck className="size-7 text-[#0f6b43]" />
        <p className="mt-3 text-sm font-semibold text-[#181713]">No persistent approved exceptions found.</p>
        <p className="mt-2 max-w-md text-xs leading-5 text-[#615c52]">
          CradleHub currently records live conflict acknowledgements inside the Conflict Center session. No durable
          schedule-exception table was found, so this panel stays honest instead of inventing approval records.
        </p>
      </div>
    </section>
  );
}
