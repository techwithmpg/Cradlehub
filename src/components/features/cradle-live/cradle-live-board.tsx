'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  Activity, ArrowUpRight, CalendarDays, CircleAlert, Clock3, ClipboardList,
  Expand, ExternalLink, HeartPulse, Laptop2, MapPin, RefreshCw,
  ShieldAlert, ShieldCheck, Sparkles, Users, Wallet, Waves,
} from 'lucide-react';
import type { ActiveTripData } from '@/lib/actions/live-ops-actions';
import type { LiveBoardData, LiveBooking, LiveStage } from '@/lib/cradle-live/types';
import s from './cradle-live-board.module.css';

const OpsMap = dynamic(() => import('@/components/features/ops-map/ops-map').then(m => m.OpsMap), {
  ssr: false,
  loading: () => <div className={s.mapUnavailable}>Connecting map…</div>,
});
const stages: { key: LiveStage; title: string }[] = [
  { key: 'upcoming', title: 'Upcoming' },
  { key: 'waiting', title: 'Arrived & waiting' },
  { key: 'in_service', title: 'In service' },
  { key: 'ready_to_pay', title: 'Ready to pay' },
  { key: 'completed', title: 'Completed' },
  { key: 'needs_attention', title: 'Needs attention' },
];
const money = (n: number | null) => n == null ? 'Unavailable' : new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(n);
const clock = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' }) : '—';
const timeLabel = (hm: string) => {
  if (!/^\d\d:\d\d/.test(hm)) return hm;
  const [h, m] = hm.split(':').map(Number);
  return `${(h! % 12) || 12}:${String(m ?? 0).padStart(2,'0')} ${h! >= 12 ? 'PM' : 'AM'}`;
};
const stageRows = (bookings: LiveBooking[] | null, stage: LiveStage) => (bookings ?? []).filter(b => b.stage === stage)
  .sort((a, b) => Number(b.attention.length > 0) - Number(a.attention.length > 0) ||
    (stage === 'in_service' ? (a.dueAt ?? '').localeCompare(b.dueAt ?? '') : a.time.localeCompare(b.time)));

function Bubble({ text, urgent }: { text: string; urgent?: boolean }) {
  return <span className={`${s.bubble} ${urgent ? s.bubbleUrgent : ''}`} role="status"><CircleAlert size={11} aria-hidden /> {text}</span>;
}
function Empty({ label }: { label: string }) { return <p className={s.empty}>{label}</p>; }
function Section({ title, icon, href, children, detail, className = '' }: { title: string; icon: React.ReactNode; href?: string; children: React.ReactNode; detail?: string; className?: string }) {
  return <section className={`${s.zone} ${className}`} aria-label={title}>
    <div className={s.sectionHeading}><div className={s.sectionTitle}>{icon}<h2>{title}</h2>{detail && <small>{detail}</small>}</div>{href && <Link className={s.sectionLink} href={href} aria-label={`Open ${title}`}>Open <ArrowUpRight size={12}/></Link>}</div>
    {children}
  </section>;
}
function BookingLine({ booking, now }: { booking: LiveBooking; now: number }) {
  const nextAction: Record<LiveStage, string> = {
    upcoming: 'Prepare for arrival', waiting: 'Start service', in_service: 'Monitor treatment',
    ready_to_pay: 'Collect payment', completed: 'View record', needs_attention: 'Review booking',
  };
  const dueMin = booking.dueAt ? Math.round((Date.parse(booking.dueAt) - now) / 60000) : null;
  const elapsedMin = booking.startedAt ? Math.max(0, Math.round((now - Date.parse(booking.startedAt)) / 60000)) : null;
  const waitMin = booking.arrivalAt ? Math.max(0,Math.round((now - Date.parse(booking.arrivalAt)) / 60000)) : null;
  const isLate = booking.stage === 'in_service' && dueMin != null && dueMin < 0;
  const attention = booking.attention[0] || (booking.stage === 'needs_attention' ? 'Review booking state' : booking.stage === 'waiting' && waitMin != null && waitMin > 10 ? `Waiting ${waitMin} min` : isLate ? `Overtime ${Math.abs(dueMin!)} min` : null);
  return <div className={s.bookingLine}>
    <div className={s.lineTop}><span className={s.time}>{timeLabel(booking.time)}</span><span className={s.lineName}>{booking.name}</span>{booking.stage === 'ready_to_pay' && <span className={s.money}>{money(booking.amountDue)}</span>}</div>
    <div className={s.lineSub}>{booking.service} · {booking.homeService ? 'Home Service' : booking.room ?? 'Spa room pending'}{booking.stage === 'in_service' && elapsedMin != null ? ` · ${elapsedMin}m elapsed` : ''}</div>
    <div className={s.lineNote}>{booking.therapist ?? 'Therapist not assigned'}{booking.source === 'customer_selected' ? ' · requested' : ''}{booking.stage === 'in_service' && booking.dueAt ? ` · Due ${clock(booking.dueAt)}` : ''}{booking.durationMinutes && booking.stage === 'in_service' ? ` · ${booking.durationMinutes}m planned` : ''}</div>
    <div className={s.lineAction}>{booking.stage === 'ready_to_pay' ? 'Payment due · ' : booking.stage === 'completed' ? 'Paid · ' : ''}Next: {nextAction[booking.stage]}</div>
    {attention && <Bubble urgent={attention.toLowerCase().includes('overdue') || attention.toLowerCase().includes('not assigned')} text={attention}/>}
  </div>;
}
function ageLabel(iso: string | null, now: number) {
  if (!iso) return 'No location';
  const elapsed = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  return Number.isFinite(elapsed) ? `${elapsed} min ago` : 'Unknown';
}

export function CradleLiveBoard({ initial }: { initial: LiveBoardData }) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.parse(initial.refreshedAt));
  const [expanded, setExpanded] = useState(false);
  const [windowError, setWindowError] = useState<string | null>(null);
  const [networkOnline, setNetworkOnline] = useState(true);
  const [refreshTimedOut, setRefreshTimedOut] = useState(false);
  const [refreshAttemptAt, setRefreshAttemptAt] = useState<number | null>(null);
  const updateStarted = useRef(false);
  const nextRefresh = useCallback(() => {
    if (initial.scenario === 'fixture') return;
    if (document.visibilityState !== 'visible' || !navigator.onLine || updateStarted.current) return;
    updateStarted.current = true;
    setRefreshTimedOut(false);
    setRefreshAttemptAt(Date.now());
    router.refresh();
    window.setTimeout(() => {
      if (updateStarted.current) {
        updateStarted.current = false;
        setRefreshTimedOut(true);
      }
    }, 15000);
  }, [router, initial.scenario]);
  useEffect(() => {
    updateStarted.current = false;
  }, [initial.refreshedAt]);
  useEffect(() => {
    const onFull = () => setExpanded(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFull);
    return () => document.removeEventListener('fullscreenchange', onFull);
  }, []);
  useEffect(() => {
    if (initial.scenario === 'fixture') return;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    const poll = window.setInterval(nextRefresh, 60000);
    const onNet = () => { setNetworkOnline(navigator.onLine); if (navigator.onLine) nextRefresh(); };
    const onVisible = () => { if (document.visibilityState === 'visible') nextRefresh(); };
    window.addEventListener('online', onNet);
    window.addEventListener('offline', onNet);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(tick); clearInterval(poll);
      window.removeEventListener('online', onNet);
      window.removeEventListener('offline', onNet);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [nextRefresh, initial.scenario]);
  const isStale = initial.scenario !== 'fixture' && (!networkOnline ||
    (refreshTimedOut && (refreshAttemptAt == null || Date.parse(initial.refreshedAt) <= refreshAttemptAt)) ||
    initial.errors.length > 0 || (now - Date.parse(initial.refreshedAt)) > 150000);
  const refreshing = refreshAttemptAt != null && Date.parse(initial.refreshedAt) <= refreshAttemptAt && !refreshTimedOut;
  const bookings = initial.bookings;
  const stageCount = (key: LiveStage) => bookings == null ? '—' : stageRows(bookings,key).length;
  const waitingCount = bookings == null ? null : stageRows(bookings,'waiting').length;
  const readyCount = bookings == null ? null : new Set(stageRows(bookings,'ready_to_pay').map(b=>b.paymentRef)).size;
  const visibleIssues = (() => {
    const seen = new Set<string>();
    const chosen = (initial.issues ?? []).filter(issue => {
      if (seen.has(issue.category)) return false;
      seen.add(issue.category);
      return true;
    }).slice(0, 3);
    if (chosen.length < 3) {
      for (const issue of initial.issues ?? []) {
        if (chosen.length >= 3) break;
        if (!chosen.some(item => item.id === issue.id)) chosen.push(issue);
      }
    }
    return chosen;
  })();
  const issueCategories = (() => {
    const counts = new Map<string, number>();
    for (const issue of initial.issues ?? []) counts.set(issue.category, (counts.get(issue.category) ?? 0) + 1);
    const labels: Record<string, string> = { service: 'Services', schedule: 'Schedules', attendance: 'Attendance',
      staff_identity: 'Profiles', device: 'Devices', resource: 'Rooms', booking: 'Bookings' };
    return [...counts].sort((a, b) => b[1] - a[1]).map(([category, count]) => `${labels[category] ?? category} ${count}`);
  })();
  const mapTripData: ActiveTripData[] = useMemo(() => (initial.trips ?? []).map(t => ({
    id: t.id, booking_date: initial.businessDate, start_time: '', end_time: '',
    status: t.status, booking_progress_status: t.status, customer_name: null,
    service_name: null, therapist_name: null, driver_id: null, driver_name: t.driver,
    hs_address: null, dest_lat: null, dest_lng: null,
    location: t.lat == null || t.lng == null || !t.lastLocationAt ? null : {lat:t.lat,lng:t.lng,recorded_at:t.lastLocationAt}, live_eta: null,
  })), [initial.trips, initial.businessDate]);

  async function toggleFullScreen() {
    setWindowError(null);
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await rootRef.current?.requestFullscreen();
    } catch { setWindowError('Fullscreen was blocked by the browser. Try F11.'); }
  }
  // Popup created synchronously within the click handler to avoid popup blockers.
  // Window-management positioning is best-effort and always permission-gated.
  async function openExternal() {
    setWindowError(null);
    const popup = window.open(window.location.href, 'cradle-live-secondary', 'popup=yes,width=1500,height=900');
    if (!popup) { setWindowError('Popup blocked. Allow popups, then retry.'); return; }
    type Detailed = { isPrimary: boolean; availLeft: number; availTop: number; availWidth: number; availHeight: number };
    const w = window as Window & { getScreenDetails?: () => Promise<{ screens: Detailed[] }> };
    if (!w.getScreenDetails) { setWindowError('Move the new window to the extended monitor, then select Fullscreen.'); return; }
    try {
      const details = await w.getScreenDetails();
      const external = details.screens.find(screen => !screen.isPrimary);
      if (!external) { setWindowError('No extended monitor detected. The wallboard opened in a separate window.'); return; }
      popup.moveTo(external.availLeft, external.availTop);
      popup.resizeTo(external.availWidth, external.availHeight);
      popup.focus();
      setWindowError('Wallboard window opened. Select Fullscreen there to fill the monitor.');
    } catch {
      setWindowError('Display permission was unavailable. Move the new window manually, then select Fullscreen.');
    }
  }

  return <div ref={rootRef} className={`${s.wallboard} ${expanded ? s.expanded : ''}`}>
    <header className={s.header}>
      <div className={s.brand}><Sparkles size={19} /><div><h1 onClick={toggleFullScreen} title="Toggle full screen">Cradle Live</h1><span>Operations wallboard · {initial.branch}</span></div></div>
      <div className={s.headerRight}>
        <span className={s.date}>{new Date(now).toLocaleString('en-PH',{hour:'numeric',minute:'2-digit', timeZone:'Asia/Manila'})}</span>
        <span className={`${s.live} ${isStale ? s.stale : ''}`}><span className={s.liveDot}/>{initial.scenario === 'fixture' ? 'Sample data · 10 AM scenario' : `${isStale ? 'Needs verification' : 'Live'} · ${ageLabel(initial.refreshedAt,now)}`}</span>
        {initial.scenario !== 'fixture' && <button type="button" className={s.minorButton} onClick={nextRefresh} aria-label="Refresh dashboard"><RefreshCw size={15} className={refreshing?s.rotating:''}/></button>}
        <button type="button" className={s.minorButton} onClick={openExternal}><Laptop2 size={15}/> Extended screen</button>
        <button type="button" className={s.primaryButton} onClick={toggleFullScreen}><Expand size={15}/> {expanded?'Exit fullscreen':'Fullscreen'}</button>
      </div>
    </header>
    {windowError && <div className={s.notice} role="status">{windowError}</div>}
    {initial.errors.length > 0 && <div className={s.errors} role="alert"><ShieldAlert size={13}/> Some feeds are unavailable: {initial.errors.join(' · ')}</div>}
    <div className={s.kpis} aria-label="At a glance">
      {[
        {label:'Scheduled Today',value:initial.rosterSummary?.scheduledToday??null, icon:<CalendarDays/>},
        {label:'Present',value:initial.rosterSummary?.present??null, icon:<Users/>},
        {label:'Free Now',value:initial.rosterSummary?.freeNow??null, icon:<Users/>},
        {label:'In Service',value:initial.rosterSummary?.inService??null, icon:<HeartPulse/>},
        {label:'Not Checked In',value:initial.rosterSummary?.notCheckedIn??null, icon:<Clock3/>},
        {label:'Waiting',value:waitingCount, icon:<Users/>},
        {label:'Ready to pay',value:readyCount, icon:<Wallet/>},
        {label:'Rooms with space',value:initial.roomsWithSpace, icon:<Waves/>},
        {label:'Home trips',value:initial.trips?.length??null, icon:<MapPin/>},
        {label:'Needs attention',value:initial.issues?.length??null, icon:<ShieldCheck/>},
      ].map(k=><div className={s.kpi} key={`${k.label}:${k.value ?? 'unknown'}`}><span className={s.kpiIcon}>{k.icon}</span><strong>{k.value ?? '—'}</strong><small>{k.label}</small></div>)}
    </div>

    <div className={s.grid}>
      <Section className={s.lifecycle} title="Booking lifecycle" icon={<Activity size={15}/>} detail={bookings == null ? 'Feed unavailable' : `${bookings.length} service lines · ${initial.businessDate}`} href="/crm/today">
        <div className={s.stageGrid}>{stages.map(step=><div className={s.stage} key={step.key}>
          <div className={`${s.stageHeader} ${s[step.key]}`}><span>{step.title}</span><b>{stageCount(step.key)}</b></div>
          <div className={s.stageList}>{bookings == null ? <Empty label="Not available"/> : stageRows(bookings,step.key).length ? stageRows(bookings,step.key).slice(0,3).map(b=><BookingLine key={b.id} booking={b} now={now}/>) : <Empty label="None right now"/>}</div>
          {(bookings!=null && stageRows(bookings,step.key).length>3) && <span className={s.more}>+{stageRows(bookings,step.key).length-3} more</span>}
        </div>)}</div>
      </Section>
      <Section className={s.staff} title="Therapist availability" icon={<Users size={15}/>} detail={initial.rosterSummary == null ? 'Needs verification' : `${initial.rosterSummary.scheduledToday} scheduled today`} href="/crm/staff-availability">
        <div className={s.scrollList}>{initial.staff == null ? <Empty label="Staff feed unavailable"/> : initial.staff.length === 0 ? <Empty label="No therapists scheduled for this business day"/> : <>{initial.staff.slice(0,4).map(person=><div className={s.staffLine} key={`${person.id}:${person.state}`}><span className={s.avatar}>{person.name.slice(0,1)}</span><div><strong>{person.name}</strong><small>{person.schedule} · {person.detail}</small></div><span className={`${s.status} ${s[person.state]??''}`}>{person.state.replaceAll('_',' ')}</span>{person.attention&&<Bubble text={person.attention}/>}</div>)}{initial.staff.length>4&&<span className={s.more}>+{initial.staff.length-4} more scheduled today</span>}</>}</div>
      </Section>
      <Section className={s.sessions} title="Active treatments" icon={<HeartPulse size={15}/>} href="/crm/today?filter=in_service">
        <div className={s.scrollList}>{bookings == null ? <Empty label="Session feed unavailable"/> : stageRows(bookings,'in_service').slice(0,5).map(b=><BookingLine key={b.id} booking={b} now={now}/>)}</div>
      </Section>
      <Section className={s.rooms} title="Rooms & turnover" icon={<Waves size={15}/>} detail={initial.roomsWithSpace == null ? 'Capacity needs verification' : `${initial.roomsWithSpace} rooms with space · ${initial.availableSpaces} spaces free`} href="/crm/spaces-rules">
        <div className={s.roomsGrid}>{initial.rooms == null ? <Empty label="Room feed unavailable"/> : initial.rooms.slice(0,12).map(room=><div key={room.id} className={`${s.room} ${s[room.state]}`}><b>{room.name}</b><span>{room.state.replaceAll('_',' ')}</span>{room.capacity != null && <small>{room.occupied ?? '—'}/{room.capacity} occupied · {room.reserved ?? '—'} allocated · {room.available ?? '—'} free</small>}{room.state==='needs_cleaning'&&<Bubble text="Cleaning required" urgent/>}{room.state==='cleaning'&&<Bubble text="Cleaning in progress"/>}{room.occupied != null && room.occupied > 0 && ['needs_cleaning','cleaning'].includes(room.state) && <Bubble text="Occupancy conflict" urgent/>}</div>)}</div>
      </Section>
      <Section className={s.payments} title="Collections" icon={<Wallet size={15}/>} href="/crm/cash-flow">
        <div className={s.scrollList}>{bookings == null ? <Empty label="Payment feed unavailable"/> : (()=>{const seen=new Set<string>();return stageRows(bookings,'ready_to_pay').filter(b=>{if(seen.has(b.paymentRef))return false;seen.add(b.paymentRef);return true;}).slice(0,5).map(b=><div className={s.paymentLine} key={b.paymentRef}><div><strong>{b.name}</strong><small>{b.service}</small></div><span>{money(b.amountDue)}</span></div>)})()}</div>
      </Section>
      <Section className={s.dispatch} title="Home Service live" icon={<MapPin size={15}/>} href="/crm/dispatch">
        <div className={s.dispatchBody}>
          <div className={s.miniMap}>{initial.trips == null ? <Empty label="Trip positions unavailable"/> : <OpsMap trips={mapTripData}/>}</div>
          <div className={s.tripList}>{initial.trips == null ? <Empty label="Unavailable"/> : initial.trips.length===0 ? <Empty label="No active trips reported"/> : initial.trips.slice(0,3).map(t=><div key={t.id} className={s.trip}><strong>Trip · {t.id.slice(0,8)}</strong><span>{t.status.replaceAll('_',' ')}</span><small>GPS: {ageLabel(t.lastLocationAt,now)}</small>{(!t.lastLocationAt || now-Date.parse(t.lastLocationAt)>180000)&&<Bubble text="Location needs review" urgent/>}</div>)}</div>
        </div>
      </Section>
      <Section className={s.attendance} title="Attendance" icon={<Clock3 size={15}/>} href="/crm/attendance">
        <div className={s.scrollList}>{initial.attendanceRows == null ? <Empty label="Attendance feed unavailable"/> : initial.attendanceRows.filter(p => p.at || p.block).length === 0 ? <Empty label="No verified scans today"/> : initial.attendanceRows.filter(p => p.at || p.block).slice(0,4).map(p=><div key={p.id} className={s.attendanceLine}><span>{p.name}<small>{p.block ? ` · ${p.block}` : ` · ${p.schedule}`}</small></span><small>{p.state.replaceAll('_',' ')} · {clock(p.at)}</small></div>)}</div>
      </Section>
      <Section className={s.cash} title="Cash drawer" icon={<Wallet size={15}/>} href="/crm/cash-flow"><div className={s.mutedPanel}>
        {initial.cashDrawer == null ? <strong>Session status unavailable</strong> : initial.cashDrawer.openCount === 0 ? <strong>No open drawer session</strong> : <><strong>{initial.cashDrawer.openCount} open drawer {initial.cashDrawer.openCount === 1 ? 'session' : 'sessions'}</strong>{initial.cashDrawer.openCount === 1 && <span>{initial.cashDrawer.custodian ? `Custodian: ${initial.cashDrawer.custodian}` : 'Custodian: see Cash Flow'}</span>}</>}
        <small>Recorded collections: {money(initial.collectionToday)} · Expected physical cash in Cash Flow.</small>
      </div></Section>
      <Section className={s.expenses} title="Expenses" icon={<ClipboardList size={15}/>} href="/crm/cash-flow"><div className={s.mutedPanel}>
        {initial.expenses == null ? <strong>Expense summary unavailable</strong> : <><strong>{money(initial.expenses.amount)} recorded today</strong><span>{initial.expenses.count} posted {initial.expenses.count === 1 ? 'expense' : 'expenses'}</span></>}
        <small>Open Cash Flow for transaction details.</small>
      </div></Section>
      <Section className={s.health} title="Activity & fix center" icon={<ShieldCheck size={15}/>} detail={initial.issues == null ? 'Needs verification' : `${initial.issues.length} unresolved`} href="/crm/operations-center">
        <div className={s.fixList}>{issueCategories.length > 0 && <div className={s.issueCategories}>{issueCategories.slice(0,5).map(category=><span key={category}>{category}</span>)}{issueCategories.length>5&&<span>+{issueCategories.length-5} types</span>}</div>}
          {initial.issues == null ? <Empty label="Issue summary unavailable"/> : initial.issues.length ? visibleIssues.map(i=><Link key={i.id} href={i.href} className={s.fixItem}><Bubble text={i.title} urgent={i.severity==='critical'}/><ArrowUpRight size={12}/></Link>) : <Empty label="No unresolved issues from connected feeds"/>}
          <Link href="/crm/operations-center" className={s.fixItem}><ShieldAlert size={13}/> {initial.issues && initial.issues.length > visibleIssues.length ? `+${initial.issues.length-visibleIssues.length} more · Open issue inbox` : 'Open full issue inbox'} <ArrowUpRight size={12}/></Link>
          <div className={s.eventHeading}>Recent booking activity</div>
          {initial.events == null ? <Empty label="Activity feed unavailable"/> : initial.events.slice(0,2).map(e=><div key={e.id} className={s.event}><span>{clock(e.at)}</span><strong>{e.title}</strong><small>{e.detail}</small></div>)}
        </div>
      </Section>
    </div>
    <div className={s.footer}><span><Activity size={12}/> {initial.scenario === 'fixture' ? 'Synthetic preview · No operational records' : 'Branch-scoped · Read only · Not a source of transaction authority'}</span><span>{initial.scenario === 'fixture' ? 'Fixed example at 10:00 AM' : `Refresh every 60s while visible · ${isStale ? 'Data may be stale' : 'Last confirmed '+clock(initial.refreshedAt)}`}</span><Link href="/crm/operations-center">System health <ExternalLink size={11}/></Link></div>
  </div>;
}
