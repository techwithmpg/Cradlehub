"use client";

import { useState, useTransition } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { saveAttendancePreventionPlanAction } from "@/app/(dashboard)/crm/attendance/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AttendanceReviewItem } from "@/lib/attendance/crm-review";

const OWNERS = [
  ["staff", "Staff"],
  ["crm", "CRM"],
  ["manager", "Manager"],
  ["system", "System automation"],
  ["technical_support", "Technical support"],
] as const;

export function AttendancePreventionCard({
  item,
  onSaved,
}: {
  item: AttendanceReviewItem;
  onSaved?: () => void;
}) {
  const diagnostic = item.diagnostic;
  const [owner, setOwner] = useState(diagnostic.preventionOwner);
  const [action, setAction] = useState(diagnostic.preventionAction);
  const [followUp, setFollowUp] = useState(item.recurrenceCount >= 2 ? "next_shift" : "none");
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await saveAttendancePreventionPlanAction({
        exceptionId: item.exception.id,
        rootCause: diagnostic.rootCause,
        preventionAction: action,
        preventionOwner: owner,
        followUp,
        verification: diagnostic.verification,
      });
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      onSaved?.();
    });
  }

  return (
    <section className="grid gap-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
      <div className="flex gap-3">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-blue-700" aria-hidden="true" />
        <div>
          <p className="text-sm font-bold text-blue-950">Prevent this from happening again</p>
          <p className="mt-1 text-sm leading-6 text-blue-900">
            <strong>Root cause:</strong> {diagnostic.rootCause}
          </p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
            {item.recurrenceLabel} · {item.recurrenceCount} occurrence
            {item.recurrenceCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`prevention-${item.exception.id}`}>Prevention action</Label>
        <Textarea
          id={`prevention-${item.exception.id}`}
          value={action}
          maxLength={1000}
          onChange={(event) => setAction(event.target.value)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`prevention-owner-${item.exception.id}`}>Responsible owner</Label>
          <select
            id={`prevention-owner-${item.exception.id}`}
            value={owner}
            onChange={(event) => setOwner(event.target.value as typeof owner)}
            className="h-10 rounded-lg border border-blue-200 bg-white px-3 text-sm"
          >
            {OWNERS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`prevention-follow-up-${item.exception.id}`}>Follow-up</Label>
          <select
            id={`prevention-follow-up-${item.exception.id}`}
            value={followUp}
            onChange={(event) => setFollowUp(event.target.value)}
            className="h-10 rounded-lg border border-blue-200 bg-white px-3 text-sm"
          >
            <option value="none">No follow-up</option>
            <option value="next_shift">Verify next shift</option>
            <option value="tomorrow">Verify tomorrow</option>
            <option value="manager">Manager coaching required</option>
          </select>
        </div>
      </div>

      <div className="rounded-lg bg-white/80 p-3 text-sm text-blue-950">
        <strong>Verification:</strong> {diagnostic.verification}
      </div>

      <Button
        type="button"
        onClick={save}
        disabled={pending || action.trim().length < 5}
        className="justify-self-start"
      >
        <ShieldCheck data-icon="inline-start" />
        {pending ? "Saving prevention…" : "Save prevention plan"}
      </Button>
    </section>
  );
}
