"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCheck, Clock, Search, Smartphone, Sparkles, Wrench } from "lucide-react";
import { toast } from "sonner";
import {
  bulkResolveAttendanceExceptionsAction,
  quickFixAttendanceExceptionAction,
} from "@/app/(dashboard)/crm/attendance/actions";
import { AttendanceIssueModalRouter } from "@/components/features/attendance/review/attendance-issue-modal-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AttendanceReviewItem } from "@/lib/attendance/crm-review";
import type { AttendanceWorkspaceData } from "@/lib/attendance/types";

function friendlyIssueSummary(item: AttendanceReviewItem): {
  categoryLabel: string;
  plainTitle: string;
  plainDescription: string;
  buttonLabel: string;
  isPhoneIssue: boolean;
} {
  const code = (item.diagnostic.code || "").toUpperCase();
  const staffName =
    item.exception.staff_name ??
    item.title.replace(/ has an .*$/i, "").replace(/ scan needs .*$/i, "");

  if (code.includes("DEVICE") || code.includes("PHONE")) {
    return {
      categoryLabel: "Phone Setup",
      plainTitle: `${staffName} needs phone reconnection`,
      plainDescription: "Scanned from a new or unlinked phone. Reset their phone to send a 1-tap connect link.",
      buttonLabel: "Reset Phone",
      isPhoneIssue: true,
    };
  }
  if (code.includes("MISMATCH")) {
    return {
      categoryLabel: "Unclosed Shift / Scan Check",
      plainTitle: `${staffName} — Unclosed earlier shift or scan check`,
      plainDescription: "Forgot to clock out earlier or scanned out of order. Confirm Clock-In, Clock-Out, or Sync.",
      buttonLabel: "Quick Fix",
      isPhoneIssue: false,
    };
  }
  if (code.includes("SCHEDULE")) {
    return {
      categoryLabel: "Unscheduled Scan",
      plainTitle: `${staffName} scanned outside scheduled hours`,
      plainDescription: "Approve their shift for today or update their weekly schedule.",
      buttonLabel: "Approve Shift",
      isPhoneIssue: false,
    };
  }
  return {
    categoryLabel: "Attendance Check",
    plainTitle: item.title,
    plainDescription: item.diagnostic.crmSummary || "Review and confirm this staff member's attendance.",
    buttonLabel: "Quick Fix",
    isPhoneIssue: false,
  };
}

export function AttendanceReviewView({
  data,
  items,
  onRefresh,
  onManagePhone,
}: {
  data: AttendanceWorkspaceData;
  items: AttendanceReviewItem[];
  onRefresh: () => void;
  onManagePhone: (staffId: string | null) => void;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AttendanceReviewItem | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter(
      (item) =>
        !query ||
        `${item.title} ${item.exception.staff_name ?? ""} ${item.exception.message}`
          .toLowerCase()
          .includes(query)
    );
  }, [items, search]);

  function handleBulkClear() {
    startTransition(async () => {
      const result = await bulkResolveAttendanceExceptionsAction({ onlyMismatches: false });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      onRefresh();
    });
  }

  function handleInstantApprove(item: AttendanceReviewItem) {
    startTransition(async () => {
      const result = await quickFixAttendanceExceptionAction({
        exceptionId: item.exception.id,
        staffId: item.exception.staff_id,
        checkinId: item.exception.checkin_id,
        scanTimeIso: item.exception.last_detected_at ?? item.exception.detected_at,
        mode: "sync_and_close",
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      onRefresh();
    });
  }

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-[var(--cs-border)] bg-white shadow-xs">
        <div className="flex flex-col gap-3 border-b border-[var(--cs-border-soft)] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-[var(--cs-text)]">
              Staff Attendance Help Queue ({filtered.length})
            </h2>
            <p className="mt-0.5 text-xs text-[var(--cs-text-muted)]">
              Fix forgotten clock-outs, confirm scans, or reset a staff member's phone in one click.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {items.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={handleBulkClear}
                className="border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
              >
                <CheckCheck className="mr-1.5 size-4" />
                {pending ? "Clearing…" : `Clear All Past Alerts (${items.length})`}
              </Button>
            ) : null}
            <label className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--cs-text-muted)]" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full pl-9 sm:w-64"
                placeholder="Search staff name..."
              />
            </label>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold text-[var(--cs-text)]">
              All attendance checks are clear!
            </p>
            <p className="mt-1 text-xs text-[var(--cs-text-muted)]">
              Any forgotten clock-outs or phone reset requests will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--cs-border-soft)]">
            {filtered.map((item) => {
              const info = friendlyIssueSummary(item);
              const detectedLabel = new Intl.DateTimeFormat("en-US", {
                timeZone: data.timezone,
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              }).format(new Date(item.exception.last_detected_at ?? item.exception.detected_at));

              return (
                <div
                  key={item.id}
                  className="flex flex-col justify-between gap-4 p-4 transition hover:bg-[var(--cs-surface-warm)] sm:flex-row sm:items-center"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          info.isPhoneIssue
                            ? "border-amber-300 bg-amber-50 text-amber-900"
                            : "border-stone-300 bg-stone-100 text-stone-800"
                        }
                      >
                        {info.isPhoneIssue ? (
                          <Smartphone className="mr-1 size-3" />
                        ) : (
                          <Clock className="mr-1 size-3" />
                        )}
                        {info.categoryLabel}
                      </Badge>
                      <span className="text-xs text-[var(--cs-text-muted)]">{detectedLabel}</span>
                    </div>
                    <p className="text-sm font-bold text-[var(--cs-text)]">{info.plainTitle}</p>
                    <p className="text-xs text-[var(--cs-text-secondary)]">
                      {info.plainDescription}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {!info.isPhoneIssue ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() => handleInstantApprove(item)}
                        className="text-xs"
                      >
                        <Sparkles className="mr-1.5 size-3.5 text-emerald-700" />
                        Approve & Clear
                      </Button>
                    ) : null}
                    <Button size="sm" onClick={() => setSelected(item)} className="text-xs">
                      <Wrench className="mr-1.5 size-3.5" />
                      {info.buttonLabel}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <AttendanceIssueModalRouter
        data={data}
        item={selected}
        onClose={() => setSelected(null)}
        onRefresh={onRefresh}
        onManagePhone={onManagePhone}
      />
    </>
  );
}
