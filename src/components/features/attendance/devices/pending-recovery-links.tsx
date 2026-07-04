"use client";

import { RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StaffAvatar, formatAttendanceDateTime } from "@/components/features/attendance/attendance-ui";
import { formatDeviceReason } from "@/lib/attendance/device-display";
import type { PendingDeviceRecoveryLink } from "@/lib/attendance/types";

function expiresIn(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return "Expired";
  const minutes = Math.ceil(ms / 60000);
  return minutes < 60 ? `${minutes}m` : `${Math.ceil(minutes / 60)}h`;
}

export function PendingRecoveryLinks({
  links,
  onRevoke,
  onReplace,
}: {
  links: PendingDeviceRecoveryLink[];
  onRevoke: (link: PendingDeviceRecoveryLink) => void;
  onReplace: (link: PendingDeviceRecoveryLink) => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-stone-200 bg-white">
      <div className="flex items-center gap-2 border-b border-stone-200 px-4 py-3">
        <h2 className="text-base font-bold text-stone-950">Pending Recovery Links</h2>
        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-bold text-stone-600">{links.length}</span>
      </div>
      {links.length === 0 ? (
        <div className="px-4 py-5 text-sm text-stone-500">No pending recovery links.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-stone-50 text-left text-xs font-semibold text-stone-500">
              <tr>
                {["Staff", "Branch", "Reason", "Expires In", "Expires At", "Created", "Actions"].map((heading) => (
                  <th key={heading} className="px-4 py-2">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {links.map((link) => (
                <tr key={link.id} className="border-t border-stone-100">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <StaffAvatar name={link.staffName} />
                      <div>
                        <div className="font-semibold text-stone-950">{link.staffName}</div>
                        <div className="text-xs text-stone-500">{link.staffNickname ?? "Staff"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{link.branchName}</td>
                  <td className="px-4 py-3 capitalize">{formatDeviceReason(link.reason)}</td>
                  <td className="px-4 py-3 font-semibold text-amber-700">{expiresIn(link.expiresAt)}</td>
                  <td className="px-4 py-3">{formatAttendanceDateTime(link.expiresAt)}</td>
                  <td className="px-4 py-3">{formatAttendanceDateTime(link.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => onRevoke(link)}>
                        <XCircle data-icon="inline-start" />
                        Revoke
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => onReplace(link)}>
                        <RotateCcw data-icon="inline-start" />
                        Replace
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
