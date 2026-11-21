"use client";

import { memo, useState, type ReactNode } from "react";
import Link from "next/link";
import { BedDouble, CircleAlert, ArrowUpRight, UsersRound } from "lucide-react";
import type { LiveBoardData, LiveBooking, LiveStage } from "@/lib/cradle-live/types";
import s from "./cradle-live-board.module.css";

export function Panel({
  title,
  detail,
  href,
  children,
}: {
  title: string;
  detail?: ReactNode;
  href?: string;
  children: ReactNode;
}) {
  return (
    <section className={s.panel} aria-label={title}>
      <div className={s.heading}>
        <h2>
          {href ? (
            <Link prefetch={false} href={href}>
              {title}
              <ArrowUpRight size={11} />
            </Link>
          ) : (
            title
          )}
        </h2>
        {detail && <small>{detail}</small>}
      </div>
      {children}
    </section>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <p className={s.empty}>{children}</p>;
}
export const clock = (at: string | null) =>
  at
    ? new Date(at).toLocaleTimeString("en-PH", {
        timeZone: "Asia/Manila",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";
const moneyFormat = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const money = (amount: number | null | undefined) =>
  amount == null ? "Unavailable" : moneyFormat.format(amount);
const bookingHref = (id: string) => "/crm/bookings?bookingId=" + encodeURIComponent(id);
const label = (state: string) => state.replaceAll("_", " ");
const initials = (name: string) => {
  const clean = name.replace(/\([^)]*\)/g, " ").trim();
  const parts = clean.split(/\s+/).filter((w) => /^[A-Za-zÀ-ÖØ-öø-ÿ]/.test(w));
  const first = parts[0];
  const last = parts[parts.length - 1];
  if (!first) return "—";
  if (!last || parts.length === 1) return first.slice(0, 2).toUpperCase();
  return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase();
};
const spanTime = (ms: number) => {
  const seconds = Math.floor(Math.abs(ms) / 1000);
  return Math.floor(seconds / 60) + "m " + String(seconds % 60).padStart(2, "0") + "s";
};
const groupBadge = (
  <span className={s.badge}>
    <UsersRound size={10} /> Group
  </span>
);
const busy = new Set(["busy", "in_service", "in_service_verify_attendance", "on_home_service"]);

export const People = memo(function People({ data }: { data: LiveBoardData }) {
  const [filter, setFilter] = useState("All");
  const staff = data.staff;
  const available = staff?.filter(
    (p) => p.state === "free_now" && p.presence === "present" && !p.attention
  );
  const ranked = available
    ?.filter((p) => p.queuePosition != null)
    .sort((a, b) => a.queuePosition! - b.queuePosition!);
  const first = ranked?.[0];
  const nextUp = ranked?.slice(1, 4) ?? [];
  const rows = staff?.filter(
    (p) =>
      filter === "All" ||
      (filter === "Available"
        ? available?.includes(p)
        : filter === "Busy"
          ? busy.has(p.state)
          : Boolean(p.attention))
  );
  return (
    <>
      <Panel
        title="Therapist queue"
        href="/crm/schedule"
        detail={`${available?.length ?? "—"} available · ${staff?.length ?? "—"} scheduled`}
      >
        <div className={s.feature}>
          <h3>Next in check-in order</h3>
          <div className={s.person}>
            <b className={s.avatar}>{first ? initials(first.name) : "—"}</b>
            <div>
              <strong>
                {first?.name ?? (staff ? "No ranked therapist" : "Queue unavailable")}
              </strong>
              <small>
                {first
                  ? "Available · clocked in " + clock(first.checkedInAt)
                  : "Verified availability required"}
              </small>
            </div>
            {first && <b className={s.rank}>#{first.queuePosition}</b>}
          </div>
          {nextUp.length > 0 && (
            <div className={s.upNextList} aria-label="Up next in rotation">
              {nextUp.map((therapist) => (
                <div key={therapist.id} className={s.upNextItem}>
                  <em>#{therapist.queuePosition}</em>
                  <span>{therapist.name}</span>
                  <time>{clock(therapist.checkedInAt)}</time>
                </div>
              ))}
            </div>
          )}
          <p>Booking assignments also require service eligibility and a suitable room.</p>
        </div>
        <div className={s.filters} aria-label="Therapist filters">
          {["All", "Available", "Busy", "Issues"].map((f) => (
            <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>
        <div className={s.scroll}>
          {rows?.map((p) => (
            <div className={s.person} key={p.id}>
              <b className={s.avatar}>{initials(p.name)}</b>
              <div>
                <strong>
                  {p.name} {p.queuePosition != null && <em>#{p.queuePosition}</em>}
                </strong>
                <small>
                  {p.detail} · {p.schedule}
                </small>
              </div>
              <span
                key={p.state}
                className={s.pill}
                data-tone={p.attention ? "warning" : p.state === "free_now" ? "green" : "blue"}
              >
                {p.attention ? "Review" : p.state === "free_now" ? "Available" : label(p.state)}
              </span>
            </div>
          ))}
          {!rows?.length && (
            <Empty>{staff ? "No therapists in this view" : "Roster unavailable"}</Empty>
          )}
        </div>
        <Link className={s.foot} href="/crm/bookings">
          Check eligibility for a booking ↗
        </Link>
      </Panel>
      <Panel title="Staff presence" href="/crm/attendance" detail="Scheduled providers">
        <div className={s.counters}>
          {[
            ["Scheduled", staff?.length],
            ["Verified", staff?.filter((p) => p.presence === "present").length],
            ["On duty", staff?.filter((p) => p.onDuty).length],
            ["Not in", staff?.filter((p) => p.presence === "not_checked_in").length],
            ["Review", staff?.filter((p) => p.presence === "needs_review").length],
          ].map(([name, n]) => (
            <Link key={name} href="/crm/attendance">
              <b>{n ?? "—"}</b>
              <small>{name}</small>
            </Link>
          ))}
        </div>
      </Panel>
    </>
  );
});

export const Rooms = memo(function Rooms({ data }: { data: LiveBoardData }) {
  return (
    <Panel
      title="Rooms & beds"
      href="/crm/spaces-rules"
      detail={`${data.availableSpaces ?? "—"} free`}
    >
      <p className={s.sub}>Room capacity · slots represent spaces within each room</p>
      <div className={s.roomGrid}>
        {data.rooms?.map((r) => {
          const known =
            r.available != null &&
            r.capacity != null &&
            r.occupied != null &&
            !["unavailable", "status_unavailable"].includes(r.state);
          const slots =
            known && r.capacity! <= 12
              ? Array.from({ length: r.capacity! }, (_, i) =>
                  i < r.occupied!
                    ? "Occupied"
                    : ["cleaning", "needs_cleaning"].includes(r.state)
                      ? "Cleaning"
                      : i < r.capacity! - r.available!
                        ? "Reserved"
                        : "Free"
                )
              : [];
          return (
            <div className={s.room} key={r.id}>
              <div className={s.line}>
                <strong>{r.name}</strong>
                <small>{known ? `${r.occupied}/${r.capacity}` : label(r.state)}</small>
              </div>
              <div className={s.slots}>
                {slots.map((state, i) => (
                  <div key={i} data-state={state}>
                    <i />
                    <span>
                      <BedDouble size={13} />
                      {state}
                    </span>
                  </div>
                ))}
              </div>
              {(!slots.length || r.state === "needs_cleaning") && <small>{label(r.state)}</small>}
            </div>
          );
        })}
      </div>
      {!data.rooms?.length && (
        <Empty>{data.rooms ? "No configured rooms" : "Room feed unavailable"}</Empty>
      )}
    </Panel>
  );
});

export function Treatments({ rows, now }: { rows: LiveBooking[] | null; now: number }) {
  const treatments = rows?.filter((b) => b.stage === "in_service");
  return (
    <Panel title="Active treatments" detail={`${treatments?.length ?? "—"} running`}>
      <div className={s.scroll}>
        {treatments?.map((b) => {
          const start = b.startedAt ? Date.parse(b.startedAt) : NaN,
            end = b.dueAt ? Date.parse(b.dueAt) : NaN;
          const measured = end > start,
            pct = measured ? Math.max(0, Math.round((100 * (now - start)) / (end - start))) : null;
          const overdue = measured && now > end;
          return (
            <Link
              prefetch={false}
              href={bookingHref(b.id)}
              className={s.treatment}
              key={b.id}
              data-late={overdue}
            >
              <span className={s.ring}>
                <svg viewBox="0 0 40 40" aria-hidden>
                  <circle cx="20" cy="20" r="16" />
                  <circle
                    cx="20"
                    cy="20"
                    r="16"
                    pathLength="100"
                    strokeDasharray={`${Math.min(100, pct ?? 0)} 100`}
                  />
                </svg>
                <b>{pct == null ? "—" : pct + "%"}</b>
              </span>
              <div className={s.copy}>
                <strong>
                  {b.service} {b.group && groupBadge}
                </strong>
                <small>
                  {[b.therapist, b.room].filter(Boolean).join(" · ") || "Assignment unavailable"}
                </small>
                <small title={"Scheduled " + b.date + " " + b.time}>
                  {b.time.slice(0, 5)} sched · {clock(b.startedAt)} start
                  {b.durationMinutes ? " · " + b.durationMinutes + "m" : ""}
                </small>
              </div>
              <div className={s.countdown}>
                <b>
                  {measured
                    ? (overdue ? "+" : "") + spanTime(end - now)
                    : Number.isFinite(start)
                      ? spanTime(now - start)
                      : "—"}
                </b>
                <small>{overdue ? "Overdue" : measured ? "Remaining" : "Elapsed"}</small>
              </div>
            </Link>
          );
        })}
        {!treatments?.length && (
          <Empty>{rows ? "No active treatments" : "Treatment feed unavailable"}</Empty>
        )}
      </div>
    </Panel>
  );
}
export const Alerts = memo(function Alerts({ data }: { data: LiveBoardData }) {
  return (
    <Panel
      title="Ops alerts"
      href="/crm/operations-center"
      detail={`${data.issues?.length ?? "—"} open`}
    >
      <div className={s.alertList}>
        {data.issues?.map((i) => (
          <Link
            prefetch={false}
            key={i.id}
            className={s.alert}
            data-tone={i.severity}
            href={i.href}
          >
            <CircleAlert size={16} />
            <div>
              <strong>{i.title}</strong>
              <small>
                {label(i.category)}
                {i.at && " · " + clock(i.at)}
              </small>
            </div>
          </Link>
        ))}
        {!data.issues?.length && (
          <Empty>
            {data.issues ? "No open alerts from connected feeds" : "Issue summary unavailable"}
          </Empty>
        )}
      </div>
      <h3 className={s.subhead}>Live activity</h3>
      <div className={s.scroll}>
        {data.events?.map((e) => (
          <div key={e.id} className={s.event}>
            <time>{clock(e.at)}</time>
            <span>
              {e.title} · {e.detail}
            </span>
          </div>
        ))}
        {!data.events?.length && (
          <Empty>{data.events ? "No recent events" : "Activity unavailable"}</Empty>
        )}
      </div>
    </Panel>
  );
});

const columns: [LiveStage, string, string][] = [
  ["upcoming", "Upcoming", "Prepare for arrival"],
  ["waiting", "Arrived", "Review assignment"],
  ["in_service", "In service", "Monitor treatment"],
  ["ready_to_pay", "Ready to pay", "Present bill"],
  ["completed", "Completed", "View record"],
];
export function Lifecycle({ data, now }: { data: LiveBoardData; now: number }) {
  const [attention, setAttention] = useState(false);
  const all = data.bookings,
    needs = all?.filter((b) => b.stage === "needs_attention" || b.attention.length > 0);
  const stages = attention
    ? [["needs_attention", "Needs attention", "Review booking"] as const]
    : columns;
  return (
    <Panel
      title="Booking lifecycle"
      detail={
        <button
          aria-pressed={attention}
          className={s.attention}
          onClick={() => setAttention(!attention)}
        >
          {attention ? "Back to lifecycle" : (needs?.length ?? "—") + " need attention"}
        </button>
      }
    >
      <p className={s.sub}>{all?.length ?? "—"} service lines on the board</p>
      <div className={s.lanes}>
        {stages.map(([stage, name, next]) => {
          const rows = attention ? needs : all?.filter((b) => b.stage === stage);
          return (
            <div key={stage} className={s.lane}>
              <h3>
                {name}
                <em>{rows?.length ?? "—"}</em>
              </h3>
              <div className={s.scroll}>
                {rows?.map((b) => (
                  <Link prefetch={false} className={s.booking} href={bookingHref(b.id)} key={b.id}>
                    <div className={s.line}>
                      <time>
                        {b.date !== data.businessDate ? b.date + " · " : ""}
                        {b.time.slice(0, 5)}
                      </time>
                      {b.group && groupBadge}
                      {b.amountDue != null && <b>{money(b.amountDue)}</b>}
                    </div>
                    <strong>{b.name}</strong>
                    <span>{b.service}</span>
                    <small>{[b.therapist, b.room].filter(Boolean).join(" · ")}</small>
                    {b.stage === "waiting" && b.arrivalAt && (
                      <small>Waiting {spanTime(Math.max(0, now - Date.parse(b.arrivalAt)))}</small>
                    )}
                    {b.stage === "in_service" && b.dueAt && (
                      <small>
                        {now > Date.parse(b.dueAt) ? "Overdue " : "Due "}
                        {clock(b.dueAt)}
                      </small>
                    )}
                    {attention && <small>{b.attention[0]}</small>}
                    <small>Next · {next}</small>
                  </Link>
                ))}
                {!rows?.length && <Empty>{all ? "No bookings" : "Unavailable"}</Empty>}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
export const Finance = memo(function Finance({ data }: { data: LiveBoardData }) {
  const bills = new Map(
    data.bookings?.filter((b) => b.stage === "ready_to_pay").map((b) => [b.paymentRef, b.amountDue])
  );
  const amounts = [...bills.values()];
  const due =
    data.bookings && amounts.every((n): n is number => n != null)
      ? amounts.reduce((a, b) => a + b, 0)
      : null;
  return (
    <Panel title="Financials · read-only" href="/crm/cash-flow" detail="PHP">
      <div className={s.finance}>
        {[
          ["Ready to pay", money(due), data.bookings ? bills.size + " bills" : "Bills unavailable"],
          ["Today's collections", money(data.collectionToday), "Posted payments & deposits"],
          [
            "Cash drawer",
            data.cashDrawer ? "Needs reconciliation" : "Unavailable",
            data.cashDrawer
              ? data.cashDrawer.openCount + " open sessions"
              : "Session feed unavailable",
          ],
          ["Outstanding", money(data.outstanding), "Today's booking balances"],
          ["Expenses", money(data.expenses?.amount), "Posted operational expenses"],
        ].map(([title, value, note]) => (
          <Link key={title} href="/crm/cash-flow">
            <small>{title}</small>
            <strong>{value}</strong>
            <small>{note}</small>
          </Link>
        ))}
      </div>
    </Panel>
  );
});




