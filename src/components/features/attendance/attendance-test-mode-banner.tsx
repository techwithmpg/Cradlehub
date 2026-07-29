"use client";

import { FlaskConical } from "lucide-react";

export function AttendanceTestModeBanner({ reason }: { reason?: string | null }) {
  return (
    <div
      role="status"
      className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950"
    >
      <div className="flex items-start gap-3">
        <FlaskConical className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden="true" />
        <div>
          <p className="font-bold">Attendance Test Mode is active</p>
          <p className="mt-0.5 text-sm">
            Scans are recorded as test data and do not affect live Attendance.
          </p>
          {reason ? <p className="mt-1 text-xs text-amber-800">Reason: {reason}</p> : null}
        </div>
      </div>
    </div>
  );
}
