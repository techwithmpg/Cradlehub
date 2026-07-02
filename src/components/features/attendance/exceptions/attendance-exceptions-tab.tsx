"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, Panel, StatusPill, formatAttendanceDateTime, humanizeAttendanceValue } from "@/components/features/attendance/attendance-ui";
import { resolveAttendanceExceptionAction, type AttendanceActionResult } from "@/app/(dashboard)/crm/attendance/actions";
import type { AttendanceException, AttendanceWorkspaceData } from "@/lib/attendance/types";

export function AttendanceExceptionsTab({
  data,
  onActionResult,
}: {
  data: AttendanceWorkspaceData;
  onActionResult: (result: AttendanceActionResult) => void;
}) {
  const [filter, setFilter] = useState("open");
  const [selectedException, setSelectedException] = useState<AttendanceException | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [isPending, startTransition] = useTransition();

  const rows = useMemo(() => {
    return data.exceptions.filter((exception) => {
      if (filter === "all") return true;
      if (filter === "attendance") return !["unknown_device", "revoked_device", "room_conflict"].includes(exception.exception_type);
      if (filter === "devices") return ["unknown_device", "revoked_device", "wrong_branch"].includes(exception.exception_type);
      if (filter === "sessions") return exception.exception_type.includes("service") || exception.exception_type.includes("room");
      return exception.status === filter;
    });
  }, [data.exceptions, filter]);

  function resolveSelectedException() {
    if (!selectedException) return;
    const formData = new FormData();
    formData.set("exceptionId", selectedException.id);
    formData.set("resolutionNote", resolutionNote);
    startTransition(async () => {
      const result = await resolveAttendanceExceptionAction(formData);
      onActionResult(result);
      if (result.ok) {
        setSelectedException(null);
        setResolutionNote("");
      }
    });
  }

  return (
    <div className="grid gap-4">
      <Panel title="Exception Resolution">
        <div className="flex flex-wrap gap-2">
          {["all", "attendance", "devices", "sessions", "open", "resolved", "dismissed"].map((value) => (
            <Button key={value} type="button" variant={filter === value ? "default" : "outline"} size="sm" onClick={() => setFilter(value)}>
              {humanizeAttendanceValue(value)}
            </Button>
          ))}
        </div>
      </Panel>

      <Panel title={`Exceptions (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyState title="No exceptions in this view." detail="Original scan and attendance evidence is retained for auditability." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b bg-stone-50 text-left text-xs text-muted-foreground">
                  {["Severity", "Exception Type", "Staff", "Branch", "Related Record", "Occurred", "Status", "Action"].map((heading) => (
                    <th key={heading} className="px-3 py-2 font-semibold">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((exception) => (
                  <tr key={exception.id} className="border-b last:border-b-0">
                    <td className="px-3 py-3"><StatusPill value={exception.severity} tone={exception.severity === "critical" ? "bad" : "warn"} /></td>
                    <td className="px-3 py-3 capitalize">{humanizeAttendanceValue(exception.exception_type)}</td>
                    <td className="px-3 py-3 font-semibold">{exception.staff_name ?? "Unassigned"}</td>
                    <td className="px-3 py-3">{data.branchName}</td>
                    <td className="px-3 py-3 text-muted-foreground">{exception.id.slice(0, 8)}</td>
                    <td className="px-3 py-3">{formatAttendanceDateTime(exception.detected_at)}</td>
                    <td className="px-3 py-3"><StatusPill value={exception.status} /></td>
                    <td className="px-3 py-3">
                      <Button type="button" variant="outline" size="sm" onClick={() => setSelectedException(exception)}>
                        {exception.status === "open" ? "Resolve" : "Review"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Dialog open={selectedException !== null} onOpenChange={(open) => !open && setSelectedException(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedException ? humanizeAttendanceValue(selectedException.exception_type) : "Exception"}</DialogTitle>
            <DialogDescription>Resolution keeps the original scan and attendance evidence intact.</DialogDescription>
          </DialogHeader>
          {selectedException ? (
            <div className="grid gap-3 text-sm">
              <p className="m-0 text-muted-foreground">{selectedException.message}</p>
              <textarea
                value={resolutionNote}
                onChange={(event) => setResolutionNote(event.target.value)}
                className="min-h-28 rounded-lg border border-border bg-background p-3 outline-none"
                placeholder="Resolution reason and corrective action..."
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSelectedException(null)}>Cancel</Button>
            <Button type="button" disabled={isPending || !selectedException || selectedException.status !== "open"} onClick={resolveSelectedException}>
              {isPending ? "Resolving..." : "Resolve Exception"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
