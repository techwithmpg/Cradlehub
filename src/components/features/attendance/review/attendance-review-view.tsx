"use client";

import { useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  CalendarRange,
  Check,
  CheckCircle2,
  Clock3,
  CopyCheck,
  Eye,
  MoreHorizontal,
  MoreVertical,
  ScanLine,
  Search,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import {
  bulkAcknowledgeAttendanceExceptionsAction,
  quickFixAttendanceExceptionAction,
  reviewAttendanceExceptionAction,
} from "@/app/(dashboard)/crm/attendance/actions";
import {
  AttendanceCorrectionModal,
  type AttendanceCorrectionModalTarget,
} from "@/components/features/attendance/attendance-correction-modal";
import { StaffAvatar } from "@/components/features/attendance/attendance-ui";
import { AttendanceIssueModalRouter } from "@/components/features/attendance/review/attendance-issue-modal-router";
import { AttendancePagination } from "@/components/features/attendance/shared/attendance-pagination";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  classifyReviewIssueBucket,
  findExceptionRecord,
  formatAttendanceRole,
  formatShortClock,
  formatShortShiftDate,
  getReviewIssueHeadline,
  hasAuthorizedCorrectionPath,
  resolveExceptionBusinessDate,
  resolveExceptionTargetCheckinId,
  resolveReviewSeverity,
  type ReviewIssueBucket,
  type ReviewSeverityRank,
} from "@/lib/attendance/crm-attendance-presenter";
import type { AttendanceReviewItem } from "@/lib/attendance/crm-review";
import { buildAttendanceStaffDiagnostics } from "@/lib/attendance/staff-diagnostics";
import type { AttendanceWorkspaceData } from "@/lib/attendance/types";
import { addDaysToYmd } from "@/lib/engine/slot-time";
import { cn } from "@/lib/utils";

type DateWindowPreset = "all" | "today" | "7d" | "14d" | "30d";

function toBranchYmd(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function severityPillClass(severity: ReviewSeverityRank): string {
  if (severity === "critical") return "border-rose-200 bg-rose-50 text-rose-700";
  if (severity === "high") return "border-orange-200 bg-orange-50 text-orange-700";
  if (severity === "medium") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-emerald-200 bg-[#EEF8F2] text-[#1F4E33]";
}

function severityLabel(severity: ReviewSeverityRank): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
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
  const [datePreset, setDatePreset] = useState<DateWindowPreset>("all");
  const [bucketFilter, setBucketFilter] = useState<"all" | ReviewIssueBucket>("all");
  const [issueCategoryFilter, setIssueCategoryFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<"all" | ReviewSeverityRank>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [modalTarget, setModalTarget] = useState<AttendanceCorrectionModalTarget | null>(null);
  const [fullResolverItem, setFullResolverItem] = useState<AttendanceReviewItem | null>(null);
  const [pending, startTransition] = useTransition();

  const staffDiagnostics = useMemo(() => buildAttendanceStaffDiagnostics(data), [data]);
  const staffTypeById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of data.staffOptions) {
      if (s.staff_type) map.set(s.id, s.staff_type);
    }
    return map;
  }, [data.staffOptions]);

  const roleOptions = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      const role = item.exception.staff_id ? staffTypeById.get(item.exception.staff_id) : null;
      if (role) set.add(role);
    }
    return Array.from(set).sort((a, b) => formatAttendanceRole(a).localeCompare(formatAttendanceRole(b)));
  }, [items, staffTypeById]);

  const bucketCounts = useMemo(() => {
    const counts = {
      all: items.length,
      unclosed: 0,
      duplicate_conflict: 0,
      missing_scan: 0,
      other: 0,
    };
    for (const item of items) {
      counts[classifyReviewIssueBucket(item)] += 1;
    }
    return counts;
  }, [items]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const minDate =
      datePreset === "today"
        ? data.businessDate
        : datePreset === "7d"
          ? addDaysToYmd(data.businessDate, -6)
          : datePreset === "14d"
            ? addDaysToYmd(data.businessDate, -13)
            : datePreset === "30d"
              ? addDaysToYmd(data.businessDate, -29)
              : null;

    return items.filter((item) => {
      const bucket = classifyReviewIssueBucket(item);
      if (bucketFilter !== "all" && bucket !== bucketFilter) return false;
      if (issueCategoryFilter !== "all" && item.category !== issueCategoryFilter) return false;

      const role = item.exception.staff_id ? (staffTypeById.get(item.exception.staff_id) ?? "") : "";
      if (roleFilter !== "all" && role !== roleFilter) return false;

      const sev = resolveReviewSeverity(item);
      if (severityFilter !== "all" && sev !== severityFilter) return false;

      if (minDate) {
        const detectedYmd = toBranchYmd(
          item.exception.last_detected_at ?? item.exception.detected_at,
          data.timezone
        );
        if (detectedYmd < minDate) return false;
      }

      if (query) {
        const headline = getReviewIssueHeadline(item, data.timezone);
        const hay = `${item.exception.staff_name ?? ""} ${item.title} ${headline.title} ${headline.description} ${item.exception.message} ${item.exception.staff_id ?? ""}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [
    bucketFilter,
    data.businessDate,
    data.timezone,
    datePreset,
    issueCategoryFilter,
    items,
    roleFilter,
    search,
    severityFilter,
    staffTypeById,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, pageSize, safePage]);

  const pageExceptionIds = useMemo(
    () => paginated.flatMap((item) => item.relatedExceptionIds),
    [paginated]
  );
  const allPageChecked =
    paginated.length > 0 && paginated.every((item) => selectedIds.has(item.id));

  function toggleItem(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageChecked) {
        for (const item of paginated) next.delete(item.id);
      } else {
        for (const item of paginated) next.add(item.id);
      }
      return next;
    });
  }

  function handleAcknowledgeSingle(item: AttendanceReviewItem) {
    startTransition(async () => {
      const form = new FormData();
      form.set("exceptionId", item.exception.id);
      const res = await reviewAttendanceExceptionAction(form);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Issue acknowledged as reviewed (kept open until resolved).");
      onRefresh();
    });
  }

  function handleBulkAcknowledge() {
    const chosenItems =
      selectedIds.size > 0 ? filtered.filter((item) => selectedIds.has(item.id)) : paginated;
    const exceptionIds = chosenItems.flatMap((item) => item.relatedExceptionIds);
    if (exceptionIds.length === 0) {
      toast.error("No open issues selected to acknowledge.");
      return;
    }
    startTransition(async () => {
      const res = await bulkAcknowledgeAttendanceExceptionsAction({ exceptionIds });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setSelectedIds(new Set());
      toast.success(res.message);
      onRefresh();
    });
  }

  function handleQuickSync(item: AttendanceReviewItem) {
    startTransition(async () => {
      const result = await quickFixAttendanceExceptionAction({
        exceptionId: item.exception.id,
        staffId: item.exception.staff_id,
        checkinId: resolveExceptionTargetCheckinId(item.exception),
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

  function openReviewModal(item: AttendanceReviewItem) {
    const matchedRow =
      staffDiagnostics.find((r) => r.staff.staffId === item.exception.staff_id) ?? null;
    setModalTarget({ kind: "review", item, row: matchedRow });
  }

  const kpiCards = [
    {
      label: "Unresolved issues",
      count: bucketCounts.all,
      icon: AlertTriangle,
      tone: "border-[#F2D0D0] bg-[#FDF3F3] text-[#B42318]",
      onClick: () => {
        setBucketFilter("all");
        setPage(1);
      },
    },
    {
      label: "Unclosed shifts",
      count: bucketCounts.unclosed,
      icon: Clock3,
      tone: "border-[#EFE1BE] bg-[#FDF8EC] text-[#94681C]",
      onClick: () => {
        setBucketFilter((b) => (b === "unclosed" ? "all" : "unclosed"));
        setPage(1);
      },
    },
    {
      label: "Duplicate / conflict",
      count: bucketCounts.duplicate_conflict,
      icon: CopyCheck,
      tone: "border-[#EFE1BE] bg-[#FDF8EC] text-[#94681C]",
      onClick: () => {
        setBucketFilter((b) => (b === "duplicate_conflict" ? "all" : "duplicate_conflict"));
        setPage(1);
      },
    },
    {
      label: "Missing scan",
      count: bucketCounts.missing_scan,
      icon: ScanLine,
      tone: "border-[#E8DEC8] bg-[#FAF6EE] text-[#7D5A20]",
      onClick: () => {
        setBucketFilter((b) => (b === "missing_scan" ? "all" : "missing_scan"));
        setPage(1);
      },
    },
    {
      label: "Resolved today",
      count: data.summary.resolvedToday ?? 0,
      icon: CheckCircle2,
      tone: "border-[#CFE5D6] bg-[#EEF7F1] text-[#1F4E33]",
      onClick: undefined,
    },
  ];

  const categoryTabs: Array<{
    key: "all" | ReviewIssueBucket;
    label: string;
    count: number;
    icon?: typeof Clock3;
  }> = [
    { key: "all", label: "All", count: bucketCounts.all },
    { key: "unclosed", label: "Unclosed Shifts", count: bucketCounts.unclosed, icon: Clock3 },
    {
      key: "duplicate_conflict",
      label: "Duplicate / Conflict",
      count: bucketCounts.duplicate_conflict,
      icon: CopyCheck,
    },
    { key: "missing_scan", label: "Missing Scan", count: bucketCounts.missing_scan, icon: ScanLine },
    { key: "other", label: "Other", count: bucketCounts.other, icon: MoreHorizontal },
  ];

  return (
    <>
      <div className="grid min-w-0 gap-4">
        {/* Top Review Summary Header & 5 KPI Chips */}
        <section className="rounded-2xl border border-[var(--cs-border-soft)] bg-white p-4 shadow-2xs sm:p-5">
          <div className="flex flex-col gap-3.5 @[1000px]:flex-row @[1000px]:items-center @[1000px]:justify-between">
            <div className="shrink-0 @[1000px]:max-w-[225px]">
              <h2 className="text-base font-bold text-[var(--cs-text)] sm:text-lg">
                Attendance Review
              </h2>
              <p className="mt-0.5 text-xs text-[var(--cs-text-muted)]">
                Unresolved attendance issues that need your action.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 @[680px]:grid-cols-5 @[1000px]:flex @[1000px]:flex-wrap @[1000px]:items-stretch @[1000px]:justify-end @[1080px]:flex-nowrap">
              {kpiCards.map((card) => {
                const Icon = card.icon;
                const Wrapper = card.onClick ? "button" : "div";
                return (
                  <Wrapper
                    key={card.label}
                    {...(card.onClick ? { type: "button" as const, onClick: card.onClick } : {})}
                    className={cn(
                      "flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition @[1000px]:min-w-fit",
                      card.tone,
                      card.onClick ? "hover:shadow-xs focus-visible:ring-2 focus-visible:ring-[#1F4E33]" : ""
                    )}
                  >
                    <span className="flex size-7.5 shrink-0 items-center justify-center rounded-lg bg-white/85 shadow-2xs">
                      <Icon className="size-3.5" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-base font-extrabold leading-none text-[var(--cs-text)] tabular-nums">
                        {card.count}
                      </div>
                      <div className="mt-0.5 whitespace-nowrap text-[0.7rem] font-semibold leading-tight text-[var(--cs-text-secondary)]">
                        {card.label}
                      </div>
                    </div>
                  </Wrapper>
                );
              })}
            </div>
          </div>

          {/* Search & Filter Toolbar (Horizontal on Desktop) */}
          <div className="mt-4 grid grid-cols-1 gap-2 border-t border-[var(--cs-border-soft)] pt-3.5 sm:grid-cols-2 @[700px]:flex @[700px]:items-center">
            <label className="relative block min-w-0 sm:col-span-2 @[700px]:flex-1">
              <span className="sr-only">Search staff name, ID, or issue</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--cs-text-muted)]" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search staff name, ID, or issue..."
                className="h-9 rounded-lg border-[var(--cs-border)] bg-white pl-9 text-xs"
              />
            </label>

            <div className="relative min-w-0 @[700px]:w-[152px] @[700px]:shrink-0">
              <CalendarRange className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--cs-text-muted)]" />
              <select
                aria-label="Filter by date range"
                value={datePreset}
                onChange={(e) => {
                  setDatePreset(e.target.value as DateWindowPreset);
                  setPage(1);
                }}
                className="h-9 w-full rounded-lg border border-[var(--cs-border)] bg-white pl-8 pr-2.5 text-xs font-semibold text-[var(--cs-text)] outline-none focus:border-[#1F4E33]"
              >
                <option value="all">All open dates</option>
                <option value="today">Today only</option>
                <option value="7d">Last 7 days</option>
                <option value="14d">Last 14 days</option>
                <option value="30d">Last 30 days</option>
              </select>
            </div>

            <select
              aria-label="Filter by issue category"
              value={issueCategoryFilter}
              onChange={(e) => {
                setIssueCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="h-9 w-full min-w-0 rounded-lg border border-[var(--cs-border)] bg-white px-2.5 text-xs font-semibold text-[var(--cs-text)] outline-none focus:border-[#1F4E33] @[700px]:w-[128px] @[700px]:shrink-0"
            >
              <option value="all">All issues</option>
              <option value="clock">Clock &amp; Scan</option>
              <option value="schedule">Schedule</option>
              <option value="phone">Phone Setup</option>
              <option value="branch">Branch Check</option>
              <option value="technical">Technical</option>
            </select>

            <select
              aria-label="Filter by staff role"
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="h-9 w-full min-w-0 rounded-lg border border-[var(--cs-border)] bg-white px-2.5 text-xs font-semibold text-[var(--cs-text)] outline-none focus:border-[#1F4E33] @[700px]:w-[122px] @[700px]:shrink-0"
            >
              <option value="all">All roles</option>
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {formatAttendanceRole(role)}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by severity"
              value={severityFilter}
              onChange={(e) => {
                setSeverityFilter(e.target.value as "all" | ReviewSeverityRank);
                setPage(1);
              }}
              className="h-9 w-full min-w-0 rounded-lg border border-[var(--cs-border)] bg-white px-2.5 text-xs font-semibold text-[var(--cs-text)] outline-none focus:border-[#1F4E33] @[700px]:w-[122px] @[700px]:shrink-0"
            >
              <option value="all">All severity</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Category Pill Bar & Bulk Acknowledge Action */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Issue type filters">
              {categoryTabs.map((tab) => {
                const active = bucketFilter === tab.key;
                const TabIcon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setBucketFilter(tab.key);
                      setPage(1);
                    }}
                    style={
                      active
                        ? {
                            backgroundColor: "#1F4E33",
                            borderColor: "#1F4E33",
                            color: "#FFFFFF",
                          }
                        : undefined
                    }
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold whitespace-nowrap transition",
                      active
                        ? "!border-[#1F4E33] !bg-[#1F4E33] !text-white shadow-2xs"
                        : "border-[var(--cs-border)] bg-white text-[var(--cs-text-secondary)] hover:border-[#1F4E33]/50"
                    )}
                  >
                    {TabIcon ? <TabIcon className="size-3.5 shrink-0" aria-hidden="true" /> : null}
                    <span>{tab.label}</span>{" "}
                    <span
                      style={active ? { color: "#FFFFFF" } : undefined}
                      className={cn(
                        "rounded px-1 text-[0.68rem] tabular-nums",
                        active ? "bg-white/20 text-white" : "bg-stone-100 text-[var(--cs-text-muted)]"
                      )}
                    >
                      ({tab.count})
                    </span>
                  </button>
                );
              })}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => {
                const dupIds = items
                  .filter(
                    (it) =>
                      it.diagnostic.code === "duplicate_scan" ||
                      it.diagnostic.code === "request_replayed"
                  )
                  .flatMap((it) => it.relatedExceptionIds);
                if (dupIds.length === 0) {
                  toast.info("No duplicate or replayed scan noise to auto-clear.");
                  return;
                }
                startTransition(async () => {
                  const res = await bulkAcknowledgeAttendanceExceptionsAction({
                    exceptionIds: dupIds,
                  });
                  if (res.ok) {
                    toast.success(`Cleared ${dupIds.length} duplicate/replay scan item(s).`);
                    onRefresh();
                  } else {
                    toast.error(res.message);
                  }
                });
              }}
              className="h-8 rounded-lg border-stone-200 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-50"
            >
              <Sparkles className="mr-1.5 size-3.5 text-emerald-700" />
              Auto-Clear Duplicates
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending || pageExceptionIds.length === 0}
              onClick={handleBulkAcknowledge}
              className="h-8 rounded-lg border-[#CFE5D6] bg-[#EEF7F1] px-3 text-xs font-bold text-[#1F4E33] hover:bg-[#DCEFE3]"
            >
              <Check className="mr-1.5 size-3.5" />
              {selectedIds.size > 0
                ? `Mark Selected (${selectedIds.size}) as Acknowledged`
                : "Mark Selected as Acknowledged"}
            </Button>
          </div>
        </section>

        {/* Main 7-Column Review Issue Table */}
        <section className="overflow-hidden rounded-2xl border border-[var(--cs-border-soft)] bg-white shadow-2xs">
          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-[#EEF7F1] text-[#1F4E33]">
                <ShieldCheck className="size-5" />
              </div>
              <p className="mt-3 text-sm font-bold text-[var(--cs-text)]">
                No attendance issues match your filters
              </p>
              <p className="mt-1 text-xs text-[var(--cs-text-muted)]">
                Try clearing a filter or check back when new scans arrive.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop 7-Column Table */}
              <div className="hidden overflow-x-auto @[760px]:block">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="border-b border-[var(--cs-border-soft)] bg-[#FAF8F5] text-[0.68rem] font-bold uppercase tracking-wider text-[var(--cs-text-muted)]">
                    <tr>
                      <th className="w-10 px-4 py-2.5">
                        <input
                          type="checkbox"
                          aria-label="Select all visible issues"
                          checked={allPageChecked}
                          onChange={toggleAllVisible}
                          className="size-4 rounded border-stone-300 accent-[#1F4E33]"
                        />
                      </th>
                      <th className="px-3 py-2.5">Staff Member</th>
                      <th className="px-3 py-2.5">Issue / Description</th>
                      <th className="px-3 py-2.5">Severity</th>
                      <th className="px-3 py-2.5">Date</th>
                      <th className="px-3 py-2.5">Details</th>
                      <th className="px-4 py-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--cs-border-soft)]">
                    {paginated.map((item) => {
                      const staffName = item.exception.staff_name ?? "Staff member";
                      const rawRole = item.exception.staff_id
                        ? staffTypeById.get(item.exception.staff_id)
                        : null;
                      const headline = getReviewIssueHeadline(item, data.timezone);
                      const severity = resolveReviewSeverity(item);
                      const detectedIso =
                        item.exception.last_detected_at ?? item.exception.detected_at;
                      const detectedYmd = toBranchYmd(detectedIso, data.timezone);
                      const record = findExceptionRecord(
                        item.exception,
                        data.records,
                        data.exceptionRecords
                      );
                      const originalYmd = resolveExceptionBusinessDate(
                        item.exception,
                        record,
                        data.timezone
                      );
                      const canQuickFix = hasAuthorizedCorrectionPath(item, Boolean(record));
                      const diag = staffDiagnostics.find(
                        (d) => d.staff.staffId === item.exception.staff_id
                      );
                      const isReviewed = item.exception.resolution_status === "reviewed";

                      return (
                        <tr
                          key={item.id}
                          className={cn(
                            "transition hover:bg-[#FAF8F5]",
                            selectedIds.has(item.id) ? "bg-[#F4FAF6]" : ""
                          )}
                        >
                          <td className="px-4 py-2.5 align-middle">
                            <input
                              type="checkbox"
                              aria-label={`Select issue for ${staffName}`}
                              checked={selectedIds.has(item.id)}
                              onChange={() => toggleItem(item.id)}
                              className="size-4 rounded border-stone-300 accent-[#1F4E33]"
                            />
                          </td>
                          <td className="px-3 py-2.5 align-middle">
                            <div className="flex items-center gap-2.5">
                              <StaffAvatar
                                name={staffName}
                                className="size-8.5 bg-[#2D6A45] text-[0.7rem] font-bold text-white"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="truncate text-xs font-bold text-[var(--cs-text)] sm:text-[13px]">
                                    {staffName}
                                  </span>
                                  {isReviewed ? (
                                    <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[0.62rem] font-semibold text-stone-600">
                                      Reviewed
                                    </span>
                                  ) : null}
                                </div>
                                <div className="truncate text-[11px] text-[var(--cs-text-muted)]">
                                  {formatAttendanceRole(rawRole)}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="max-w-[270px] px-3 py-2.5 align-middle">
                            <div className="flex items-start gap-2">
                              <AlertTriangle
                                className={cn(
                                  "mt-0.5 size-4 shrink-0",
                                  severity === "critical"
                                    ? "text-rose-600"
                                    : severity === "high"
                                      ? "text-orange-600"
                                      : "text-amber-600"
                                )}
                              />
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-[var(--cs-text)]">
                                  {headline.title}
                                </div>
                                <div
                                  title={headline.description}
                                  className="mt-0.5 line-clamp-1 text-[11px] text-[var(--cs-text-muted)]"
                                >
                                  {headline.description}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 align-middle">
                            <span
                              className={cn(
                                "inline-flex rounded-md border px-2 py-0.5 text-xs font-bold",
                                severityPillClass(severity)
                              )}
                            >
                              {severityLabel(severity)}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 align-middle text-xs">
                            <div className="font-semibold text-[var(--cs-text)]">
                              {formatShortShiftDate(originalYmd)}
                            </div>
                            {detectedYmd !== originalYmd ? (
                              <div className="text-[0.68rem] text-[var(--cs-text-muted)]">
                                (detected {formatShortShiftDate(detectedYmd).replace(/, \d{4}$/, "")})
                              </div>
                            ) : null}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 align-middle text-xs text-[var(--cs-text-secondary)]">
                            {record ? (
                              <div className="space-y-0.5 tabular-nums">
                                <div>
                                  <span className="text-[var(--cs-text-muted)]">In:</span>{" "}
                                  <span className="font-semibold text-[var(--cs-text)]">
                                    {formatShortClock(record.checked_in_at, data.timezone)}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[var(--cs-text-muted)]">Out:</span>{" "}
                                  <span className="font-semibold text-[var(--cs-text)]">
                                    {record.checked_out_at
                                      ? formatShortClock(record.checked_out_at, data.timezone)
                                      : "—"}
                                  </span>
                                </div>
                              </div>
                            ) : originalYmd === data.businessDate && diag?.staff.scheduledStart ? (
                              <div className="space-y-0.5 tabular-nums">
                                <div>
                                  <span className="text-[var(--cs-text-muted)]">Schedule:</span>{" "}
                                  <span className="font-semibold text-[var(--cs-text)]">
                                    {formatShortClock(diag.staff.scheduledStart, data.timezone)}–
                                    {diag.staff.scheduledEnd
                                      ? formatShortClock(diag.staff.scheduledEnd, data.timezone)
                                      : "—"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[var(--cs-text-muted)]">Scans:</span> None
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-0.5 tabular-nums">
                                <div>
                                  <span className="text-[var(--cs-text-muted)]">Scan:</span>{" "}
                                  <span className="font-semibold text-[var(--cs-text)]">
                                    {formatShortClock(detectedIso, data.timezone)}
                                  </span>
                                </div>
                                {item.recurrenceCount > 1 ? (
                                  <div className="text-[0.68rem] text-[var(--cs-text-muted)]">
                                    {item.recurrenceCount} occurrences
                                  </div>
                                ) : null}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2.5 align-middle">
                            <div className="flex items-center justify-end gap-1.5">
                              {canQuickFix ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => openReviewModal(item)}
                                  className="h-8 rounded-lg !bg-[#1F4E33] px-3 text-xs font-semibold !text-white hover:!bg-[#163B26]"
                                  style={{ backgroundColor: "#1F4E33", color: "#FFFFFF" }}
                                >
                                  <Wrench className="mr-1.5 size-3" />
                                  Review &amp; Fix
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setFullResolverItem(item)}
                                  className="h-8 rounded-lg border-[var(--cs-border)] px-2.5 text-xs font-semibold text-[var(--cs-text)] hover:bg-[#FAF8F5]"
                                >
                                  <Eye className="mr-1.5 size-3" />
                                  Inspect
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={pending}
                                onClick={() => handleAcknowledgeSingle(item)}
                                className="h-8 rounded-lg border-[var(--cs-border)] px-2.5 text-xs font-semibold text-[var(--cs-text-secondary)] hover:bg-[#FAF8F5]"
                              >
                                <Check className="mr-1 size-3" />
                                Acknowledge
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  render={
                                    <Button
                                      type="button"
                                      size="icon-sm"
                                      variant="ghost"
                                      aria-label={`More actions for ${staffName}`}
                                    />
                                  }
                                >
                                  <MoreVertical className="size-4" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setFullResolverItem(item)}>
                                    Open full issue resolver
                                  </DropdownMenuItem>
                                  {item.category !== "phone" ? (
                                    <DropdownMenuItem onClick={() => handleQuickSync(item)}>
                                      <Sparkles className="mr-1.5 size-3.5 text-emerald-700" />
                                      Approve &amp; sync saved scans
                                    </DropdownMenuItem>
                                  ) : null}
                                  {item.exception.staff_id ? (
                                    <DropdownMenuItem
                                      onClick={() => onManagePhone(item.exception.staff_id)}
                                    >
                                      Manage staff phone
                                    </DropdownMenuItem>
                                  ) : null}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card Stack */}
              <div className="divide-y divide-[var(--cs-border-soft)] @[760px]:hidden">
                {paginated.map((item) => {
                  const staffName = item.exception.staff_name ?? "Staff member";
                  const headline = getReviewIssueHeadline(item, data.timezone);
                  const severity = resolveReviewSeverity(item);
                  const record = findExceptionRecord(
                    item.exception,
                    data.records,
                    data.exceptionRecords
                  );
                  const canQuickFix = hasAuthorizedCorrectionPath(item, Boolean(record));
                  const detectedYmd = toBranchYmd(
                    item.exception.last_detected_at ?? item.exception.detected_at,
                    data.timezone
                  );
                  const originalYmd = resolveExceptionBusinessDate(
                    item.exception,
                    record,
                    data.timezone
                  );
                  return (
                    <div key={item.id} className="grid gap-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            aria-label={`Select issue for ${staffName}`}
                            checked={selectedIds.has(item.id)}
                            onChange={() => toggleItem(item.id)}
                            className="size-4 rounded border-stone-300 accent-[#1F4E33]"
                          />
                          <StaffAvatar
                            name={staffName}
                            className="size-9 bg-[#2D6A45] text-xs font-bold text-white"
                          />
                          <div>
                            <div className="text-sm font-bold text-[var(--cs-text)]">{staffName}</div>
                            <div className="text-xs text-[var(--cs-text-muted)]">
                              {formatShortShiftDate(originalYmd)}
                              {detectedYmd !== originalYmd
                                ? ` (detected ${formatShortShiftDate(detectedYmd).replace(/, \d{4}$/, "")})`
                                : ""}
                            </div>
                          </div>
                        </div>
                        <span
                          className={cn(
                            "rounded-md border px-2 py-0.5 text-xs font-bold",
                            severityPillClass(severity)
                          )}
                        >
                          {severityLabel(severity)}
                        </span>
                      </div>
                      <div className="rounded-xl bg-[#FAF8F5] p-3">
                        <div className="text-xs font-bold text-[var(--cs-text)]">
                          {headline.title}
                        </div>
                        <p className="mt-0.5 text-xs text-[var(--cs-text-muted)]">
                          {headline.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {canQuickFix ? (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => openReviewModal(item)}
                            className="h-9 flex-1 rounded-lg !bg-[#1F4E33] text-xs font-semibold !text-white"
                            style={{ backgroundColor: "#1F4E33", color: "#FFFFFF" }}
                          >
                            Review &amp; Fix
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setFullResolverItem(item)}
                            className="h-9 flex-1 rounded-lg text-xs font-semibold"
                          >
                            Inspect
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={pending}
                          onClick={() => handleAcknowledgeSingle(item)}
                          className="h-9 rounded-lg text-xs font-semibold"
                        >
                          Acknowledge
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <AttendancePagination
                page={safePage}
                pageSize={pageSize}
                totalItems={filtered.length}
                itemLabel="issues"
                onPageChange={setPage}
                onPageSizeChange={(next) => {
                  setPageSize(next);
                  setPage(1);
                }}
              />
            </>
          )}
        </section>
      </div>

      <AttendanceCorrectionModal
        data={data}
        target={modalTarget}
        onClose={() => setModalTarget(null)}
        onSaved={onRefresh}
        onOpenPhone={onManagePhone}
        onOpenFullIssueDialog={(item) => setFullResolverItem(item)}
      />

      <AttendanceIssueModalRouter
        data={data}
        item={fullResolverItem}
        onClose={() => setFullResolverItem(null)}
        onRefresh={onRefresh}
        onManagePhone={onManagePhone}
      />
    </>
  );
}


