"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays, CheckCircle2, ChevronDown, ChevronRight, Clock3, Play,
  Plus, Search, Users, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { firstBookingRelation, getBookingDurationMinutes } from "@/lib/bookings/booking-display";
import { groupCrmBookings, getBookingPaymentDisplayState, type CrmBookingGroup } from "@/lib/bookings/crm-booking-groups";
import { bookingGuestCount } from "@/lib/bookings/bookings-presentation";
import { resolveBookingLifecycleState } from "@/lib/bookings/operational-booking-eligibility";
import { formatTime12h } from "@/lib/utils/time-format";
import { crmStartServiceAction, markBookingArrivedAction, recordBookingFollowupAction } from "@/app/(dashboard)/crm/bookings/actions";
import { AnimatedSessionTimer } from "./animated-session-timer";
import { BookingsModalStack, type BookingModalState } from "./bookings-modal-stack";
import { BookingSourceSwitch } from "./booking-source-switch";
import { ServiceStartActionDialog, type ServiceStartActionDetails } from "./service-start-action-dialog";
import { useGlobalServiceStartActions } from "./global-service-start-provider";
import { serviceTransitionEventId } from "@/lib/bookings/service-transition-event";
import type { BookingActionFn, WorkspaceBookingRow } from "./booking-workspace-types";

type Tab = "today" | "upcoming" | "in_service" | "completed";
type Entry = { group: CrmBookingGroup; line: WorkspaceBookingRow; grouped: boolean };
type Option = { id: string; name: string };

function recipient(line: WorkspaceBookingRow): string {
  return firstBookingRelation(line.booking_attendees)?.display_name?.trim()
    || firstBookingRelation(line.customers)?.full_name?.trim() || "Guest";
}

function lifecycle(line: WorkspaceBookingRow) {
  const state = resolveBookingLifecycleState(line);
  switch (state) {
    case "in_service": return { text: "In Service", color: "bg-emerald-100 text-emerald-900", icon: Play };
    case "checked_in": return { text: "Arrived · Waiting", color: "bg-emerald-50 text-emerald-800", icon: Users };
    case "completed": return { text: "Completed", color: "bg-slate-100 text-slate-700", icon: CheckCircle2 };
    case "cancelled": return { text: "Cancelled", color: "bg-slate-100 text-slate-600", icon: Clock3 };
    case "no_show": return { text: "No Show", color: "bg-slate-100 text-slate-600", icon: Clock3 };
    case "expired": return { text: "Expired", color: "bg-slate-100 text-slate-600", icon: Clock3 };
    default: return { text: "Scheduled", color: "bg-violet-100 text-violet-900", icon: CalendarDays };
  }
}

function Status({ line }: { line: WorkspaceBookingRow }) {
  const status = lifecycle(line);
  const Icon = status.icon;
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${status.color}`}>
    <Icon className="size-3.5" aria-hidden="true" />{status.text}
  </span>;
}

function scheduledMinutes(line: WorkspaceBookingRow, now: number): number {
  const start = Date.parse(`${line.booking_date}T${line.start_time.slice(0, 8)}+08:00`);
  return Number.isFinite(start) ? Math.ceil((start - now) / 60000) : Number.POSITIVE_INFINITY;
}

function ServiceActions({
  groups, businessDate, onOpen, onRefresh,
}: {
  groups: CrmBookingGroup[];
  businessDate: string;
  onOpen: (group: CrmBookingGroup, line: WorkspaceBookingRow) => void;
  onRefresh?: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [action, setAction] = useState<Entry | null>(null);
  const [busy, setBusy] = useState(false);
  const globalActions = useGlobalServiceStartActions();
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  const items = useMemo(() => groups.flatMap((group) =>
    group.lines.filter((line) => line.booking_date === businessDate).map((line) => ({ group, line, grouped: false }))
  ), [groups, businessDate]);
  const due = items.filter(({ line }) => {
    const minutes = scheduledMinutes(line, now);
    return resolveBookingLifecycleState(line) === "upcoming" && minutes >= 0 && minutes <= 60;
  }).sort((a, b) => a.line.start_time.localeCompare(b.line.start_time));
  const waiting = items.filter(({ line }) => resolveBookingLifecycleState(line) === "checked_in");
  const overdue = items.filter(({ line }) => {
    const minutes = scheduledMinutes(line, now);
    return resolveBookingLifecycleState(line) === "upcoming" && minutes < 0;
  });
  const paymentDue = items.filter(({ group, line }) =>
    resolveBookingLifecycleState(line) === "completed" &&
    ["unpaid", "partial"].includes(getBookingPaymentDisplayState(group.payment, line).status)
  ).filter((item, index, rows) => rows.findIndex((row) => row.group.displayId === item.group.displayId) === index);
  const paymentReview = items.filter(({ group, line }) =>
    resolveBookingLifecycleState(line) === "completed" &&
    getBookingPaymentDisplayState(group.payment, line).isPaymentReview
  ).filter((item, index, rows) => rows.findIndex((row) => row.group.displayId === item.group.displayId) === index);
  const categories = [
    { label: "Due Soon", rows: due, tone: "amber" },
    { label: "Arrived — Waiting", rows: waiting, tone: "green" },
    { label: "Overdue", rows: overdue, tone: "red" },
    { label: "Payment Due", rows: paymentDue, tone: "neutral" },
    { label: "Payment Review", rows: paymentReview, tone: "neutral" },
  ] as const;
  const count = due.length + waiting.length + overdue.length + paymentDue.length + paymentReview.length;
  const dialogAction: ServiceStartActionDetails | null = action ? {
    bookingId: action.line.id,
    recipientName: recipient(action.line),
    serviceName: firstBookingRelation(action.line.services)?.name || "Service",
    durationMinutes: getBookingDurationMinutes(action.line),
    scheduledStart: action.line.start_time,
    therapistName: firstBookingRelation(action.line.staff)?.full_name || "Unassigned",
    roomName: firstBookingRelation(action.line.branch_resources)?.name || "No room assigned",
    groupReference: action.group.lines.length > 1 ? action.group.orderNumber || action.group.displayId : null,
  } : null;

  async function startService() {
    if (!action || busy) return;
    setBusy(true);
    try {
      const result = await crmStartServiceAction({ bookingId: action.line.id });
      if (result.success) {
        if (!result.alreadyStarted) toast.success("Service Started", {
          ...(result.startedAt ? { id: serviceTransitionEventId("started", action.line.id, result.startedAt) } : {}),
        });
        setAction(null);
        onRefresh?.();
      } else {
        toast.error(result.error || "Service could not be started.");
      }
    } catch {
      toast.error("Service could not be started.");
    } finally {
      setBusy(false);
    }
  }

  async function markArrived() {
    if (!action || busy) return;
    setBusy(true);
    try {
      const result = await markBookingArrivedAction({ bookingId: action.line.id });
      if (result.success) {
        toast.success("Customer marked arrived and waiting.");
        setAction(null);
        onRefresh?.();
      } else toast.error(result.error || "Arrival could not be recorded.");
    } catch {
      toast.error("Arrival could not be recorded.");
    } finally { setBusy(false); }
  }

  async function markNotArrived() {
    if (!action || busy) return;
    setBusy(true);
    try {
      const result = await recordBookingFollowupAction({
        bookingId: action.line.id,
        result: "not_arrived",
        note: "Customer not yet arrived for scheduled service.",
      });
      if (result.success) {
        toast.success("Absence recorded. Booking remains active for follow-up.");
        setAction(null);
        onRefresh?.();
      } else toast.error(result.error || "Absence could not be recorded.");
    } catch {
      toast.error("Absence could not be recorded.");
    } finally { setBusy(false); }
  }

  return <>
    <aside className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm" aria-label="Service Actions">
      <div className="flex items-start gap-3 border-b border-neutral-100 px-2 pb-4 pt-1">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-800"><Zap className="size-5" /></span>
        <div className="min-w-0 flex-1"><h2 className="text-lg font-bold text-neutral-950">Service Actions</h2><p className="text-xs text-neutral-500">Services that need your action now.</p></div>
        {count > 0 && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-900">{count}</span>}
      </div>
      <div className="mt-3 space-y-3">
        {categories.filter((category) => category.rows.length > 0).map((category) =>
          <section key={category.label} className={`overflow-hidden rounded-xl border ${category.tone === "amber" ? "border-amber-200" : category.tone === "green" ? "border-emerald-200" : category.tone === "red" ? "border-red-200" : "border-neutral-200"}`}>
            <h3 className={`flex items-center gap-2 px-3 py-2 text-sm font-bold ${category.tone === "amber" ? "bg-amber-50 text-amber-950" : category.tone === "green" ? "bg-emerald-50 text-emerald-950" : category.tone === "red" ? "bg-red-50 text-red-950" : "bg-neutral-50 text-neutral-900"}`}>
              <Clock3 className="size-4" />{category.label}<span className="ml-auto rounded-full bg-white/80 px-1.5 text-xs">{category.rows.length}</span>
            </h3>
            <ul className="divide-y divide-neutral-100">
              {category.rows.slice(0, 5).map(({ group, line }) => {
                const minutes = scheduledMinutes(line, now);
                const subtitle = category.label === "Due Soon" ? `Due in ${minutes} min`
                  : category.label === "Overdue" ? `Overdue ${Math.abs(minutes)} min`
                  : lifecycle(line).text;
                return <li key={line.id}>
                  <button type="button" onClick={() => {
                    const actionWindow = category.label === "Due Soon" && minutes <= 2
                      || category.label === "Overdue" && minutes >= -15;
                    if (!actionWindow) { onOpen(group, line); return; }
                    if (globalActions?.queue.some((entry) => entry.bookingId === line.id)) globalActions.openAction(line.id);
                    else setAction({ group, line, grouped: false });
                  }}
                    className="flex min-h-16 w-full items-center gap-2 px-3 py-2 text-left hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-emerald-700">
                    <Clock3 className="size-4 shrink-0 text-slate-500" aria-hidden="true" />
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-neutral-900">{recipient(line)}</span>
                      <span className="block truncate text-xs text-neutral-600">{firstBookingRelation(line.services)?.name || "Service"} · {formatTime12h(line.start_time)}</span>
                      <span className="block truncate text-[11px] text-neutral-500">{firstBookingRelation(line.staff)?.full_name || "Unassigned"} · {firstBookingRelation(line.branch_resources)?.name || "No room"}</span>
                    </span>
                    <span className="shrink-0 text-[11px] font-semibold text-amber-800">{subtitle}</span>
                    <ChevronRight className="size-4 shrink-0 text-slate-500" />
                  </button>
                </li>;
              })}
            </ul>
          </section>
        )}
        {count === 0 && <p className="px-2 py-5 text-sm text-neutral-600">No service actions for this date.</p>}
      </div>
    </aside>
    <ServiceStartActionDialog
      action={dialogAction}
      dueLabel={action ? scheduledMinutes(action.line, now) >= 0
        ? `Due in ${scheduledMinutes(action.line, now)} min`
        : `Overdue ${Math.abs(scheduledMinutes(action.line, now))} min` : ""}
      busy={busy}
      onClose={() => setAction(null)}
      onStart={() => void startService()}
      onArrived={() => void markArrived()}
      onNotArrived={() => void markNotArrived()}
    />
  </>;
}

export function CrmBookingsOperationsGrid({
  bookings, date, businessDate, initialQuickFilter, initialSelectedId,
  services, staff, rooms, onNewBooking, onChanged, onRefresh, isRefreshing, paymentAction, hasSheetReferences,
}: {
  bookings: WorkspaceBookingRow[];
  date: string;
  businessDate?: string;
  initialQuickFilter: string;
  initialSelectedId?: string;
  services: Option[];
  staff: Option[];
  rooms: Option[];
  onNewBooking: () => void;
  onChanged?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  paymentAction?: BookingActionFn;
  hasSheetReferences?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab: Tab = searchParams.get("tab") === "completed" ? "completed"
    : searchParams.get("tab") === "active" ? "in_service"
    : initialQuickFilter === "upcoming" ? "upcoming" : "today";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [staffFilter, setStaffFilter] = useState("all");
  const [roomFilter, setRoomFilter] = useState("all");
  const [sort, setSort] = useState("asc");
  const [mode, setMode] = useState<"individual" | "grouped">("individual");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [modal, setModal] = useState<BookingModalState>(null);
  const groups = useMemo(() => groupCrmBookings(bookings, true), [bookings]);
  const entries = useMemo(() => {
    const base = groups.flatMap<Entry>((group) => mode === "grouped" && group.lines.length > 1
      ? [{ group, line: group.lines[0]!, grouped: true }]
      : group.lines.map((line) => ({ group, line, grouped: false })));
    const query = search.trim().toLowerCase();
    return base.filter(({ group, line, grouped }) => {
      const candidates = grouped ? group.lines : [line];
      return candidates.some((candidate) => {
        const state = resolveBookingLifecycleState(candidate);
        if (tab === "today" && candidate.booking_date !== date) return false;
        if (tab === "upcoming" && state !== "upcoming" && state !== "checked_in") return false;
        if (tab === "in_service" && state !== "in_service") return false;
        if (tab === "completed" && state !== "completed") return false;
        if (statusFilter !== "all" && state !== statusFilter) return false;
        if (serviceFilter !== "all" && firstBookingRelation(candidate.services)?.id !== serviceFilter) return false;
        if (staffFilter !== "all" && candidate.staff_id !== staffFilter) return false;
        if (roomFilter !== "all" && candidate.resource_id !== roomFilter) return false;
        if (!query) return true;
        return [recipient(candidate), group.organizerName, firstBookingRelation(candidate.services)?.name, group.orderNumber, firstBookingRelation(candidate.customers)?.phone]
          .some((value) => value?.toLowerCase().includes(query));
      });
    }).sort((a, b) => {
      const order = a.line.booking_date.localeCompare(b.line.booking_date) || a.line.start_time.localeCompare(b.line.start_time);
      return sort === "desc" ? -order : order;
    });
  }, [groups, mode, search, tab, date, statusFilter, serviceFilter, staffFilter, roomFilter, sort]);

  function chooseTab(next: Tab) {
    setTab(next); setExpanded(null);
    const params = new URLSearchParams(window.location.search);
    if (next === "today") params.delete("tab");
    else params.set("tab", next === "in_service" ? "active" : next);
    const url = `${window.location.pathname}?${params.toString()}`;
    if (next === "upcoming" || tab === "upcoming") router.push(url);
    else window.history.replaceState(null, "", url);
  }
  function openDetails(group: CrmBookingGroup, line: WorkspaceBookingRow) {
    setModal({ type: "details", group, selectedLineId: line.id });
  }
  function changeDate(value: string) {
    const params = new URLSearchParams(window.location.search);
    params.set("date", value);
    router.push(`${window.location.pathname}?${params.toString()}`);
  }
  return <div className="mx-auto w-full max-w-[1660px] px-4 py-5 sm:px-6 lg:px-7">
    <header className="mb-5">
      <h1 className="text-3xl font-bold tracking-tight text-neutral-950">Bookings</h1>
      <p className="mt-1 text-sm text-neutral-600">Manage today&apos;s bookings, check-ins and service flow.</p>
      {hasSheetReferences && <div className="mt-3"><BookingSourceSwitch source="cradlehub" /></div>}
    </header>
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-neutral-200">
      <div className="flex gap-2" role="tablist" aria-label="Booking views">
        {(["today", "upcoming", "in_service", "completed"] as const).map((item) =>
          <button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => chooseTab(item)}
            className={`min-h-11 border-b-[3px] px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-emerald-700 ${tab === item ? "border-emerald-700 bg-emerald-50 text-neutral-950" : "border-transparent text-neutral-700 hover:bg-neutral-50"}`}>
            {item === "in_service" ? "In Service" : item[0]!.toUpperCase() + item.slice(1)}
          </button>)}
      </div>
      <label className="mb-1 flex items-center gap-2 text-xs font-medium text-neutral-700"><CalendarDays className="size-4" />Date
        <input aria-label="Bookings date" type="date" value={date} onChange={(event) => changeDate(event.target.value)}
          className="h-9 rounded-lg border border-neutral-200 bg-white px-2 text-xs focus-visible:outline-2 focus-visible:outline-emerald-700" />
      </label>
    </div>
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_290px]">
      <section className="min-w-0" aria-label="Booking schedule">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="relative min-w-[155px] flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <span className="sr-only">Search bookings</span>
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer, service, or booking no."
              className="h-10 w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-3 text-sm focus-visible:outline-2 focus-visible:outline-emerald-700" />
          </label>
          <select aria-label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 rounded-lg border border-neutral-200 bg-white px-2 text-xs">
            <option value="all">Status</option><option value="upcoming">Scheduled</option><option value="checked_in">Arrived</option><option value="in_service">In Service</option><option value="completed">Completed</option>
          </select>
          <select aria-label="Services" value={serviceFilter} onChange={(event) => setServiceFilter(event.target.value)} className="h-10 w-[86px] rounded-lg border border-neutral-200 bg-white px-2 text-xs">
            <option value="all">Services</option>{services.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select aria-label="Therapist" value={staffFilter} onChange={(event) => setStaffFilter(event.target.value)} className="h-10 w-[94px] rounded-lg border border-neutral-200 bg-white px-2 text-xs">
            <option value="all">Therapist</option>{staff.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select aria-label="Rooms" value={roomFilter} onChange={(event) => setRoomFilter(event.target.value)} className="h-10 w-[75px] rounded-lg border border-neutral-200 bg-white px-2 text-xs">
            <option value="all">Rooms</option>{rooms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select aria-label="Sort bookings" value={sort} onChange={(event) => setSort(event.target.value)} className="h-10 w-[118px] rounded-lg border border-neutral-200 bg-white px-2 text-xs">
            <option value="asc">Time (earliest)</option><option value="desc">Time (latest)</option>
          </select>
          <button type="button" onClick={onNewBooking} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-emerald-800 px-4 text-xs font-semibold text-white hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"><Plus className="size-4" />New Booking</button>
        </div>
        <div className="mb-2 flex items-center justify-between gap-2 text-xs text-neutral-600">
          <span role="status">{entries.length} {mode === "grouped" ? entries.length === 1 ? "booking" : "bookings" : entries.length === 1 ? "session" : "sessions"}</span>
          <div className="flex items-center gap-2">
            <div role="group" aria-label="Booking display mode" className="inline-flex rounded-lg border border-neutral-200 bg-white p-0.5">
              {(["individual", "grouped"] as const).map((item) => <button key={item} type="button" aria-pressed={mode === item} onClick={() => { setMode(item); setExpanded(null); }}
                className={`min-h-8 rounded-md px-3 text-xs font-semibold ${mode === item ? "bg-emerald-50 text-emerald-900" : "text-neutral-600"}`}>{item === "individual" ? "Individual" : "Grouped"}</button>)}
            </div>
            <button type="button" onClick={onRefresh} disabled={isRefreshing} className="min-h-8 rounded-md px-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50">{isRefreshing ? "Refreshing…" : "Refresh"}</button>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[700px] table-fixed border-collapse text-left text-sm">
              <colgroup><col className="w-[11%]" /><col className="w-[18%]" /><col className="w-[23%]" /><col className="w-[17%]" /><col className="w-[12%]" /><col className="w-[14%]" /><col className="w-[5%]" /></colgroup>
              <thead className="bg-neutral-100 text-xs font-bold text-neutral-900"><tr>
                <th scope="col" className="px-4 py-3">Time</th><th scope="col" className="px-4 py-3">Customer</th><th scope="col" className="px-4 py-3">Service</th>
                <th scope="col" className="px-4 py-3">Therapist</th><th scope="col" className="px-4 py-3">Room</th><th scope="col" className="px-4 py-3">Status</th><th scope="col" className="w-10"><span className="sr-only">Expand</span></th>
              </tr></thead>
              <tbody>
                {entries.map(({ group, line, grouped }) => {
                  const id = grouped ? group.displayId : line.id;
                  const open = expanded === id;
                  const service = firstBookingRelation(line.services);
                  const therapist = firstBookingRelation(line.staff);
                  const room = firstBookingRelation(line.branch_resources);
                  const payment = getBookingPaymentDisplayState(group.payment, line);
                  return <FragmentRow key={id} entry={{ group, line, grouped }} open={open} paymentLabel={payment.label}
                    onToggle={() => setExpanded(open ? null : id)} onDetails={() => openDetails(group, line)}
                    customer={grouped ? group.organizerName : recipient(line)} service={grouped ? `${group.lines.length} services · ${bookingGuestCount(group)} guests` : `${service?.name || "Service"} (${getBookingDurationMinutes(line)} min)`}
                    therapist={grouped ? "Multiple" : therapist?.full_name || therapist?.nickname || "Unassigned"}
                    room={grouped ? "Multiple" : room?.name || (line.delivery_type === "home_service" ? "Home Service" : "Unassigned")} />;
                })}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-neutral-100 md:hidden">
            {entries.map(({ group, line, grouped }) => {
              const id = grouped ? group.displayId : line.id;
              const open = expanded === id;
              const customer = grouped ? group.organizerName : recipient(line);
              const service = grouped
                ? `${group.lines.length} services · ${bookingGuestCount(group)} guests`
                : `${firstBookingRelation(line.services)?.name || "Service"} (${getBookingDurationMinutes(line)} min)`;
              const therapist = grouped ? "Multiple" : firstBookingRelation(line.staff)?.full_name || "Unassigned";
              const room = grouped ? "Multiple" : firstBookingRelation(line.branch_resources)?.name || "Unassigned";
              return <article key={id} className={open ? "bg-amber-50/40 p-3" : "p-3"}>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-neutral-600">{formatTime12h(line.start_time)}{grouped && " · Group"}</p>
                    <button type="button" onClick={() => openDetails(group, line)} className="mt-1 text-left font-bold text-neutral-950 underline-offset-2 hover:underline">{customer}</button>
                    <p className="mt-0.5 text-sm text-neutral-700">{service}</p>
                    <p className="mt-1 text-xs text-neutral-500">{therapist} · {room}</p>
                  </div>
                  <button type="button" onClick={() => setExpanded(open ? null : id)} aria-expanded={open} aria-label={open ? `Collapse ${customer} preview` : `Expand ${customer} preview`}
                    className="grid size-10 shrink-0 place-items-center rounded-lg border border-neutral-200 bg-white focus-visible:outline-2 focus-visible:outline-emerald-700"><ChevronDown className={`size-4 ${open ? "rotate-180" : ""}`} /></button>
                </div>
                <div className="mt-3"><Status line={line} /></div>
                {open && <section aria-label={`Service summary for ${customer}`} className="mt-3 rounded-xl border border-emerald-200 bg-white p-3">
                  <div className="flex items-center gap-4">
                    {resolveBookingLifecycleState(line) === "in_service" || resolveBookingLifecycleState(line) === "completed"
                      ? <AnimatedSessionTimer session={{ ...line, durationMinutes: getBookingDurationMinutes(line) }} />
                      : <span className="grid size-16 shrink-0 place-items-center rounded-full border-4 border-emerald-200 text-center text-[11px] font-semibold text-emerald-900">Not started</span>}
                    <dl className="space-y-1 text-xs"><div><dt className="text-neutral-500">Planned duration</dt><dd className="font-semibold">{getBookingDurationMinutes(line)} min</dd></div>
                      <div><dt className="text-neutral-500">Payment</dt><dd className="font-semibold">{getBookingPaymentDisplayState(group.payment, line).label}</dd></div></dl>
                  </div>
                  <button type="button" onClick={() => openDetails(group, line)} className="mt-3 min-h-10 w-full rounded-lg bg-emerald-800 px-4 text-sm font-semibold text-white">View Details</button>
                </section>}
              </article>;
            })}
          </div>
          {entries.length === 0 && <div className="px-6 py-16 text-center text-sm text-neutral-600">No bookings match this view.</div>}
        </div>
      </section>
      <div className="min-w-0"><ServiceActions groups={groups} businessDate={businessDate || date}
        onOpen={(group, line) => openDetails(group, line)}
        onRefresh={onChanged} /></div>
    </div>
    <BookingsModalStack state={modal} onStateChange={setModal} onChanged={onChanged} onArrived={() => onChanged?.()} paymentAction={paymentAction} />
    {initialSelectedId && <span className="sr-only">Selected booking loaded</span>}
  </div>;
}

function FragmentRow({
  entry, open, paymentLabel, onToggle, onDetails, customer, service, therapist, room,
}: {
  entry: Entry; open: boolean; paymentLabel: string; onToggle: () => void; onDetails: () => void;
  customer: string; service: string; therapist: string; room: string;
}) {
  const { line, grouped } = entry;
  return <>
    <tr className={`border-t border-neutral-100 ${open ? "bg-amber-50/50" : "hover:bg-neutral-50"}`}>
      <td className="whitespace-nowrap px-4 py-3 font-medium">{formatTime12h(line.start_time)}</td>
      <td className="min-w-0 px-4 py-3"><button type="button" onClick={onDetails} title={customer} className="block w-full truncate text-left font-semibold text-neutral-950 hover:text-emerald-800 hover:underline focus-visible:outline-2 focus-visible:outline-emerald-700">{customer}</button>{grouped && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-900">Group</span>}</td>
      <td className="truncate px-4 py-3" title={service}>{service}</td>
      <td className="truncate px-4 py-3" title={therapist}>{therapist}</td>
      <td className="truncate px-4 py-3" title={room}>{room}</td>
      <td className="whitespace-nowrap px-4 py-3"><Status line={line} /></td>
      <td className="pr-3"><button type="button" onClick={onToggle} aria-expanded={open} aria-label={open ? `Collapse ${customer} preview` : `Expand ${customer} preview`}
        className="grid size-9 place-items-center rounded-lg hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-emerald-700"><ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} /></button></td>
    </tr>
    {open && <tr className="border-t border-amber-100 bg-amber-50/40"><td colSpan={7} className="p-2">
      <section aria-label={`Service summary for ${customer}`} className="grid gap-3 rounded-xl border border-emerald-200 bg-white p-3 shadow-sm md:grid-cols-[minmax(230px,0.8fr)_minmax(0,1.2fr)]">
        <div className="flex items-center gap-4 rounded-lg bg-emerald-50/60 p-3">
          {resolveBookingLifecycleState(line) === "in_service" || resolveBookingLifecycleState(line) === "completed"
            ? <AnimatedSessionTimer session={{ ...line, durationMinutes: getBookingDurationMinutes(line) }} />
            : <span className="grid size-20 shrink-0 place-items-center rounded-full border-4 border-emerald-200 text-center text-xs font-semibold text-emerald-900">Not started</span>}
          <dl className="space-y-2 text-xs"><div><dt className="text-neutral-500">Scheduled</dt><dd className="font-semibold">{formatTime12h(line.start_time)}</dd></div>
            <div><dt className="text-neutral-500">Planned duration</dt><dd className="font-semibold">{getBookingDurationMinutes(line)} min</dd></div></dl>
        </div>
        <div className="min-w-0 p-2"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-2"><h3 className="font-bold text-neutral-950">{service}</h3><Status line={line} /></div>
          <dl className="grid gap-2 py-3 text-xs sm:grid-cols-3">
            <div><dt className="text-neutral-500">Therapist</dt><dd className="font-semibold">{therapist}</dd></div>
            <div><dt className="text-neutral-500">Room</dt><dd className="font-semibold">{room}</dd></div>
            <div><dt className="text-neutral-500">Payment</dt><dd className="font-semibold">{paymentLabel}</dd></div>
          </dl>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-3"><p className="text-xs text-neutral-500">Detailed editing and booking history are in Booking Details.</p>
            <button type="button" onClick={onDetails} className="min-h-9 rounded-lg border border-emerald-700 px-4 text-xs font-semibold text-emerald-800 hover:bg-emerald-50">View Details</button></div>
        </div>
      </section>
    </td></tr>}
  </>;
}
