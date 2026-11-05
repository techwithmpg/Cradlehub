"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  ArrowLeftRight, ArrowRight, Building2, CalendarClock, CheckCircle2,
  Clock3, Hourglass, Plus, Send, ShieldCheck, UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  decideStaffAssistanceAction, loadStaffAssistanceAction,
  loadStaffAssistanceCandidatesAction, submitStaffAssistanceAction,
  type AssistanceCandidateView, type AssistanceDashboard, type AssistanceView,
} from "@/app/(dashboard)/crm/schedule/assistance-actions";
import type { AssistanceRole, AssistanceVisitType } from "@/lib/staff/interbranch-assistance-contract";

type Filter = "all" | "outgoing" | "incoming" | "active" | "completed";
const STATUS_LABEL: Record<AssistanceView["status"], string> = {
  requested: "Awaiting Approval",
  approved_pending_arrival: "Approved · Not Yet Bookable",
  declined: "Declined",
  cancelled: "Cancelled",
};
const ROLE_LABEL: Record<AssistanceRole, string> = {
  therapist: "Therapist",
  nail_tech: "Nail Technician",
  aesthetician: "Aesthetician (Facialist)",
};
const fmt = (value: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", ...options }).format(new Date(value));
function period(row: AssistanceView) {
  return `${fmt(row.start_at, { month: "short", day: "numeric" })} · ${fmt(row.start_at, { hour: "numeric", minute: "2-digit" })} – ${fmt(row.end_at, { hour: "numeric", minute: "2-digit" })}`;
}
function badgeClass(status: AssistanceView["status"]) {
  if (status === "approved_pending_arrival") return "bg-emerald-50 text-emerald-800";
  if (status === "requested") return "bg-amber-50 text-amber-800";
  return "bg-stone-100 text-stone-600";
}

export function StaffAssistanceTab({ branchId, branchName, date }: {
  branchId: string;
  branchName: string;
  date: string;
}) {
  const [snapshot, setSnapshot] = useState<AssistanceDashboard | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, begin] = useTransition();
  const [filter, setFilter] = useState<Filter>("all");
  const [requestOpen, setRequestOpen] = useState(false);
  const [reviewing, setReviewing] = useState<AssistanceView | null>(null);
  const [candidates, setCandidates] = useState<AssistanceCandidateView[]>([]);
  const [candidateError, setCandidateError] = useState<string | null>(null);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [decisionNote, setDecisionNote] = useState("");
  const [lendingBranch, setLendingBranch] = useState("");
  const [role, setRole] = useState<AssistanceRole>("therapist");
  const [quantity, setQuantity] = useState(1);
  const [visitType, setVisitType] = useState<AssistanceVisitType>("in_spa");
  const [requestDate, setRequestDate] = useState(date);
  const [startTime, setStartTime] = useState("15:00");
  const [endTime, setEndTime] = useState("22:00");
  const [notes, setNotes] = useState("");

  const refresh = useCallback(async () => {
    const result = await loadStaffAssistanceAction();
    if (!result.success) {
      setLoadError(result.error);
      setSnapshot(null);
    } else {
      setSnapshot(result.data);
      setLoadError(null);
    }
    setLoading(false);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const requests = snapshot?.requests ?? [];
  const outgoing = requests.filter((r) => r.requesting_branch_id === branchId);
  const incoming = requests.filter((r) => r.lending_branch_id === branchId);
  const pending = incoming.filter((r) => r.status === "requested");
  const approved = requests.filter((r) => r.status === "approved_pending_arrival");
  const visible = useMemo(() => {
    if (filter === "outgoing") return outgoing;
    if (filter === "incoming") return incoming;
    if (filter === "active") return approved;
    if (filter === "completed") return requests.filter((r) => ["cancelled", "declined"].includes(r.status));
    return requests;
  }, [filter, incoming, outgoing, requests, approved]);
  const otherBranches = (snapshot?.branches ?? []).filter((b) => b.id !== branchId);
  const selectedLender = otherBranches.find((b) => b.id === lendingBranch)?.id ?? otherBranches[0]?.id ?? "";
  const manager = snapshot && ["owner", "manager", "assistant_manager", "store_manager"].includes(snapshot.role);

  function handleRequest() {
    if (!selectedLender) return toast.error("No other active branch is available.");
    const startAt = `${requestDate}T${startTime}:00+08:00`;
    const startMs = Date.parse(startAt);
    let endMs = Date.parse(`${requestDate}T${endTime}:00+08:00`);
    if (endMs <= startMs) endMs += 86400000;
    begin(async () => {
      const result = await submitStaffAssistanceAction({
        requestingBranchId: branchId,
        lendingBranchId: selectedLender,
        role, count: quantity, visitType,
        startAt, endAt: new Date(endMs).toISOString(), notes: notes.trim(),
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setRequestOpen(false);
      setNotes("");
      toast.success("Request sent to the other branch.");
      await refresh();
      setFilter("outgoing");
    });
  }

  async function openReview(request: AssistanceView) {
    setReviewing(request);
    setSelectedStaff([]);
    setDecisionNote("");
    setCandidates([]);
    setCandidateError(null);
    setLoadingCandidates(true);
    const result = await loadStaffAssistanceCandidatesAction(request.id);
    if (result.success) setCandidates(result.data);
    else setCandidateError(result.error);
    setLoadingCandidates(false);
  }

  function decide(decision: "approve" | "decline" | "cancel", request: AssistanceView) {
    begin(async () => {
      const result = await decideStaffAssistanceAction({
        requestId: request.id, decision,
        staffIds: decision === "approve" ? selectedStaff : [],
        reason: decisionNote,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(decision === "approve" ? "Decision saved; staff are not yet bookable." : "Request updated.");
      setReviewing(null);
      await refresh();
    });
  }

  const filterOptions: Array<{ key: Filter; label: string; count: number }> = [
    { key: "all", label: "All Requests", count: requests.length },
    { key: "outgoing", label: "Outgoing", count: outgoing.length },
    { key: "incoming", label: "Incoming", count: incoming.length },
    { key: "active", label: "Approved", count: approved.length },
    { key: "completed", label: "Closed", count: requests.filter((r) => ["cancelled", "declined"].includes(r.status)).length },
  ];

  return (
    <section className="min-w-0 space-y-4" aria-label="Inter-branch staff assistance">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-4 sm:p-5">
        <div>
          <div className="mb-1 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-emerald-800">
            <ArrowLeftRight className="size-4" /> Branch collaboration
          </div>
          <h2 className="text-xl font-extrabold text-[var(--cs-text)]">Staff Assistance</h2>
          <p className="mt-1 text-xs text-[var(--cs-text-muted)]">
            Request temporary therapists, nail technicians, or aestheticians from another branch.
          </p>
          <p className="mt-1 text-xs text-[var(--cs-text-secondary)]">Your branch: {branchName}</p>
        </div>
        <button type="button" onClick={() => setRequestOpen(true)} disabled={!snapshot}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#155f43] px-4 py-2 text-sm font-bold text-white hover:bg-[#104934] disabled:opacity-50">
          <Plus className="size-4" /> Request Staff Assistance
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[
          { title: "My Requests", count: outgoing.length, icon: <Send className="size-5" />, tone: "bg-emerald-50 text-emerald-800" },
          { title: "Awaiting My Branch", count: pending.length, icon: <Hourglass className="size-5" />, tone: "bg-amber-50 text-amber-800" },
          { title: "Approved", count: approved.length, icon: <UsersRound className="size-5" />, tone: "bg-teal-50 text-teal-800" },
          { title: "Closed", count: requests.filter((r) => ["cancelled", "declined"].includes(r.status)).length, icon: <CheckCircle2 className="size-5" />, tone: "bg-stone-100 text-stone-700" },
        ].map((metric) => (
          <div key={metric.title} className="rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-3 sm:p-4">
            <span className={`mb-2 inline-flex size-9 items-center justify-center rounded-full ${metric.tone}`}>{metric.icon}</span>
            <p className="text-xs font-semibold text-[var(--cs-text-secondary)]">{metric.title}</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums">{metric.count}</p>
          </div>
        ))}
      </div>

      <div role="note" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        <p>Stage B: requests and manager decisions only. Approved staff are <strong>not automatically bookable</strong> and attendance does not transfer yet.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Assistance request filters" className="flex max-w-full gap-1 overflow-x-auto rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-1">
          {filterOptions.map((option) => (
            <button type="button" key={option.key} role="tab" aria-selected={filter === option.key}
              onClick={() => setFilter(option.key)}
              className={`whitespace-nowrap rounded-md px-3 py-2 text-xs font-semibold ${filter === option.key ? "bg-[#155f43] text-white" : "text-[var(--cs-text-secondary)] hover:bg-[var(--cs-surface-warm)]"}`}>
              {option.label} <span className="ml-1 tabular-nums">{option.count}</span>
            </button>
          ))}
        </div>
        <button type="button" onClick={() => { setLoading(true); void refresh(); }}
          className="min-h-9 rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] px-3 text-xs font-semibold">Refresh</button>
      </div>

      {loading ? <p className="rounded-lg bg-[var(--cs-surface)] p-6 text-sm text-[var(--cs-text-muted)]">Loading assistance requests…</p> :
       loadError ? <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{loadError}</p> :
       visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--cs-border-soft)] bg-[var(--cs-surface)] px-4 py-10 text-center">
          <UsersRound className="mx-auto mb-3 size-8 text-emerald-700" />
          <h3 className="text-sm font-bold">No requests in this view</h3>
          <p className="mt-1 text-xs text-[var(--cs-text-muted)]">Use Request Staff Assistance whenever your branch needs extra coverage.</p>
        </div>
       ) : (
        <div className="space-y-2">
          {visible.map((request) => {
            const canReview = Boolean(manager && (snapshot?.role === "owner" || request.lending_branch_id === branchId) && request.status === "requested");
            const canCancel = request.requesting_branch_id === branchId && request.status === "requested";
            return (
              <article key={request.id} className="flex flex-col gap-3 rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-sm text-[var(--cs-text)]">{request.quantity} {ROLE_LABEL[request.requested_role]}{request.quantity > 1 ? "s" : ""} needed</strong>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${badgeClass(request.status)}`}>{STATUS_LABEL[request.status]}</span>
                  </div>
                  <p className="text-xs text-[var(--cs-text-secondary)]">{request.requesting_branch_name} <ArrowRight className="inline size-3" /> requesting from {request.lending_branch_name}</p>
                  <p className="flex flex-wrap items-center gap-2 text-xs text-[var(--cs-text-muted)]">
                    <Clock3 className="size-3.5" /> {period(request)}
                    <span>· {request.visit_type === "home_service" ? "Home Service" : "In-spa"}</span>
                  </p>
                  {request.notes && <p className="text-xs text-[var(--cs-text-muted)]">Note: {request.notes}</p>}
                  {request.selected_staff_names.length > 0 &&
                    <p className="text-xs font-semibold text-emerald-800">Selected: {request.selected_staff_names.join(", ")}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {canReview && <button type="button" onClick={() => void openReview(request)}
                    className="min-h-9 rounded-lg bg-[#155f43] px-4 text-xs font-bold text-white">Review Request</button>}
                  {canCancel && <button type="button" onClick={() => decide("cancel", request)} disabled={busy}
                    className="min-h-9 rounded-lg border border-[var(--cs-border-soft)] px-3 text-xs font-semibold text-[var(--cs-text-secondary)]">Cancel</button>}
                </div>
              </article>
            );
          })}
        </div>
       )}

      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="max-h-[92dvh] w-[min(96vw,560px)] max-w-none overflow-y-auto rounded-2xl p-5 sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg"><ArrowLeftRight className="size-5 text-emerald-700" /> Request Staff Assistance</DialogTitle>
            <DialogDescription>Request temporary service staff from the other branch.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="mb-1 block text-xs font-semibold">Requesting branch</label>
                <div className="flex min-h-10 items-center gap-2 rounded-lg border bg-stone-50 px-3 text-sm"><Building2 className="size-4 text-stone-500" /> {branchName}</div></div>
              <div><label htmlFor="assistance-lender" className="mb-1 block text-xs font-semibold">Request from</label>
                <select id="assistance-lender" value={selectedLender} onChange={(e) => setLendingBranch(e.target.value)} className="min-h-10 w-full rounded-lg border px-3 text-sm">
                  {otherBranches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label htmlFor="assistance-role" className="mb-1 block text-xs font-semibold">Staff type</label>
                <select id="assistance-role" value={role} onChange={(e) => setRole(e.target.value as AssistanceRole)}
                  className="min-h-10 w-full rounded-lg border px-2 text-sm">
                  {Object.entries(ROLE_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select></div>
              <div><label htmlFor="assistance-qty" className="mb-1 block text-xs font-semibold">Quantity</label>
                <select id="assistance-qty" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))}
                  className="min-h-10 w-full rounded-lg border px-3 text-sm">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} {n === 1 ? "person" : "people"}</option>)}
                </select></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><label htmlFor="assistance-date" className="mb-1 block text-xs font-semibold">Date</label>
                <input id="assistance-date" type="date" value={requestDate} onChange={(e) => setRequestDate(e.target.value)}
                  className="min-h-10 w-full rounded-lg border px-2 text-xs" /></div>
              <div><label htmlFor="assistance-start" className="mb-1 block text-xs font-semibold">From</label>
                <input id="assistance-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                  className="min-h-10 w-full rounded-lg border px-2 text-xs" /></div>
              <div><label htmlFor="assistance-end" className="mb-1 block text-xs font-semibold">Until</label>
                <input id="assistance-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                  className="min-h-10 w-full rounded-lg border px-2 text-xs" /></div>
            </div>
            <p className="text-[11px] text-[var(--cs-text-muted)]">The lending manager confirms the actual staff shift. An end time earlier than the start time means the next day.</p>
            <fieldset className="rounded-lg border border-[var(--cs-border-soft)] p-3">
              <legend className="px-1 text-xs font-semibold">Work location</legend>
              <label className="flex items-center gap-2 py-1 text-sm"><input type="radio" checked={visitType === "in_spa"} onChange={() => setVisitType("in_spa")}/> In-spa at {branchName}</label>
              {snapshot?.branchAllowsHomeService &&
                <label className="flex items-center gap-2 py-1 text-sm"><input type="radio" checked={visitType === "home_service"} onChange={() => setVisitType("home_service")}/> Home Service (Main only)</label>}
            </fieldset>
            <div><label htmlFor="assistance-note" className="mb-1 block text-xs font-semibold">Notes (optional)</label>
              <textarea id="assistance-note" value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 200))}
                placeholder="e.g. Fully booked this afternoon" rows={3}
                className="w-full resize-none rounded-lg border p-3 text-sm" />
              <p className="text-right text-[11px] text-[var(--cs-text-muted)]">{notes.length}/200</p></div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              The lending branch manager decides which staff can be released. Approval does not yet activate cross-branch bookings or attendance.
            </div>
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={() => setRequestOpen(false)} className="min-h-10 rounded-lg border px-4 text-sm">Cancel</button>
              <button type="button" disabled={busy || !selectedLender || !requestDate} onClick={handleRequest}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#155f43] px-4 text-sm font-semibold text-white disabled:opacity-50"><Send className="size-4" /> {busy ? "Sending…" : "Send Request"}</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(reviewing)} onOpenChange={(open) => { if (!open) setReviewing(null); }}>
        <DialogContent className="max-h-[92dvh] w-[min(96vw,570px)] max-w-none overflow-y-auto rounded-2xl p-5 sm:max-w-[570px]">
          <DialogHeader>
            <DialogTitle>Review Assistance Request</DialogTitle>
            <DialogDescription>Only the lending branch manager can select and approve staff.</DialogDescription>
          </DialogHeader>
          {reviewing && <div className="space-y-3 pt-2">
            <p className="text-sm font-semibold">{reviewing.requesting_branch_name} requests {reviewing.quantity} {ROLE_LABEL[reviewing.requested_role]}{reviewing.quantity > 1 ? "s" : ""}</p>
            <p className="text-xs text-[var(--cs-text-secondary)]">{period(reviewing)}</p>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              Verify each person's shift, qualifications and your own branch coverage before approving. This is a provisional decision; no live transfer or bookability is activated.
            </div>
            <p className="text-xs font-bold">Select {reviewing.quantity} staff ({selectedStaff.length} selected)</p>
            {loadingCandidates ? <p className="p-4 text-sm">Checking staff availability…</p> :
              candidateError ? <p role="alert" className="text-sm text-red-700">{candidateError}</p> :
              candidates.length === 0 ? <p className="text-sm text-[var(--cs-text-muted)]">No matching active staff at the lending branch.</p> :
              <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border p-2">
                {candidates.map((candidate) => {
                  const blocked = candidate.hasBookingConflict || candidate.hasAssistanceConflict;
                  const checked = selectedStaff.includes(candidate.id);
                  return <label key={candidate.id} className={`flex items-center gap-3 rounded-lg p-2 text-sm ${blocked ? "opacity-60" : "hover:bg-stone-50"}`}>
                    <input type="checkbox" disabled={blocked || (!checked && selectedStaff.length >= reviewing.quantity)}
                      checked={checked} onChange={(e) => setSelectedStaff((ids) => e.target.checked ? [...ids, candidate.id] : ids.filter((id) => id !== candidate.id))}/>
                    <span className="flex-1">{candidate.name}</span>
                    <span className="text-[11px] text-[var(--cs-text-muted)]">{candidate.hasBookingConflict ? "Booking conflict" : candidate.hasAssistanceConflict ? "Already requested" : "No booking conflict found"}</span>
                  </label>;
                })}
              </div>}
            <div><label htmlFor="assistance-decision-note" className="mb-1 block text-xs font-semibold">Manager note (optional)</label>
              <textarea id="assistance-decision-note" value={decisionNote} onChange={(e) => setDecisionNote(e.target.value.slice(0, 200))}
                rows={2} className="w-full resize-none rounded-lg border p-2 text-sm" placeholder="Optional reason or instructions"/></div>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setReviewing(null)} className="min-h-10 rounded-lg border px-3 text-sm">Close</button>
              <button type="button" disabled={busy} onClick={() => decide("decline", reviewing)}
                className="min-h-10 rounded-lg border border-amber-300 px-3 text-sm font-semibold text-amber-900">Decline</button>
              <button type="button" disabled={busy || loadingCandidates || Boolean(candidateError) || selectedStaff.length !== reviewing.quantity}
                onClick={() => decide("approve", reviewing)}
                className="min-h-10 rounded-lg bg-[#155f43] px-3 text-sm font-semibold text-white disabled:opacity-50">Approve Staff</button>
            </div>
          </div>}
        </DialogContent>
      </Dialog>
    </section>
  );
}
