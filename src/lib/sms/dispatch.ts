import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBranchBusinessDate } from "@/lib/engine/slot-time";
import {
  businessDate, isSmsDue, smsDedupeKey, smsMessage, smsPhoneE164,
  type SmsKind, type SmsVisit,
} from "./policy";
import { readTwilioSms, sendTwilioSms, TwilioRejected, type TwilioMessageState } from "./twilio-provider";

/**
 * Feature-gated appointment SMS worker.
 *
 * DATABASE BOUNDARY: The two new tables live ONLY in the unexecuted
 * customer-sms-foundation-DRAFT.sql until separate approval and schema
 * verification. This adapter is intentionally untyped until regenerated
 * Supabase types are available; keep it on the server under service role.
 */
type SmsDb = SupabaseClient;
type BookingRow = {
  id: string;
  order_id: string | null;
  customer_id: string;
  branch_id: string;
  service_id: string;
  booking_date: string;
  start_time: string;
  status: string;
  booking_progress_status: string | null;
  session_started_at: string | null;
  delivery_type: string | null;
  type: string;
};
type ConfirmationEvent = { booking_id: string; created_at: string };
type SmsCandidate = { kind: SmsKind; visit: SmsVisit; confirmationAt?: string };
type ConsentRow = {
  customer_id: string;
  consented_phone_e164: string | null;
  transactional_opt_in_at: string | null;
  opted_out_at: string | null;
};
type SmsLog = {
  id: string;
  provider_sid: string | null;
  state: string;
};

const QUERY_LIMIT = 1000;
const EVENTS_LIMIT = 500;
const SEND_LIMIT_PER_RUN = 25;
const POLL_LIMIT_PER_RUN = 40;
const CONFIRMATION_WINDOW_MS = 2 * 60 * 60_000;
const COOLDOWN_MS = 30 * 60_000;

function db(): SmsDb {
  // Service role is never exported to a client component or returned to a caller.
  return createAdminClient() as unknown as SmsDb;
}

function ensureEnabled(now: Date): number {
  if (process.env.CRADLE_SMS_ENABLED !== "true") {
    throw new Error("Customer SMS disabled");
  }
  const launchAt = Date.parse(process.env.CRADLE_SMS_LAUNCH_AT ?? "");
  if (!Number.isFinite(launchAt) || launchAt > now.getTime()) {
    throw new Error("Customer SMS activation date not configured");
  }
  return launchAt;
}

function checkedCap(): number {
  const n = Number(process.env.CRADLE_SMS_DAILY_CAP);
  if (!Number.isInteger(n) || n < 1 || n > 500) {
    throw new Error("CRADLE_SMS_DAILY_CAP must be an integer from 1 to 500");
  }
  return n;
}

function requireRows<T>(data: T[] | null, error: { message: string } | null): T[] {
  if (error) throw new Error("SMS database query failed: " + error.message);
  return data ?? [];
}

function chunk<T>(items: T[], size = 75): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function findBookingCandidates(client: SmsDb, now: Date, launchAt: number) {
  const from = new Date(Math.max(launchAt, now.getTime() - CONFIRMATION_WINDOW_MS));
  const eventResult = await client
    .from("booking_events")
    .select("booking_id,created_at")
    .eq("to_status", "confirmed")
    .gte("created_at", from.toISOString())
    .lte("created_at", now.toISOString())
    .order("created_at", { ascending: false })
    .limit(EVENTS_LIMIT);
  const events = requireRows(eventResult.data as ConfirmationEvent[] | null, eventResult.error);
  if (events.length === EVENTS_LIMIT) throw new Error("SMS confirmation scan saturated; no send");

  const dates = new Set<string>([businessDate(now)]);
  const rows = new Map<string, BookingRow>();
  for (const date of dates) {
    const result = await client
      .from("bookings")
      .select("id,order_id,customer_id,branch_id,service_id,booking_date,start_time,status,booking_progress_status,session_started_at,delivery_type,type")
      .eq("booking_date", date)
      .limit(QUERY_LIMIT);
    const daily = requireRows(result.data as BookingRow[] | null, result.error);
    if (daily.length === QUERY_LIMIT) throw new Error("SMS daily booking scan saturated; no send");
    for (const row of daily) rows.set(row.id, row);
  }

  const missingIds = [...new Set(events.map((event) => event.booking_id))]
    .filter((id) => !rows.has(id));
  for (const ids of chunk(missingIds)) {
    const result = await client
      .from("bookings")
      .select("id,order_id,customer_id,branch_id,service_id,booking_date,start_time,status,booking_progress_status,session_started_at,delivery_type,type")
      .in("id", ids);
    for (const row of requireRows(result.data as BookingRow[] | null, result.error)) {
      rows.set(row.id, row);
    }
  }

  // Group siblings must be loaded, including pending/cancelled lines. Never
  // infer an order is confirmed from just its first service line.
  const orderIds = [...new Set([...rows.values()]
    .map((row) => row.order_id).filter((id): id is string => Boolean(id)))];
  for (const ids of chunk(orderIds)) {
    const result = await client
      .from("bookings")
      .select("id,order_id,customer_id,branch_id,service_id,booking_date,start_time,status,booking_progress_status,session_started_at,delivery_type,type")
      .in("order_id", ids)
      .limit(QUERY_LIMIT);
    const siblings = requireRows(result.data as BookingRow[] | null, result.error);
    if (siblings.length === QUERY_LIMIT) throw new Error("SMS booking group scan saturated; no send");
    for (const row of siblings) rows.set(row.id, row);
  }

  const all = [...rows.values()];
  const customerIds = [...new Set(all.map((row) => row.customer_id))];
  const branchIds = [...new Set(all.map((row) => row.branch_id))];
  const serviceIds = [...new Set(all.map((row) => row.service_id))];
  const [customers, branches, services, preferences] = await Promise.all([
    loadById(client, "customers", "id,full_name,phone", customerIds),
    loadById(client, "branches", "id,name", branchIds),
    loadById(client, "services", "id,name", serviceIds),
    loadById(client, "customer_sms_preferences", "customer_id,consented_phone_e164,transactional_opt_in_at,opted_out_at", customerIds, "customer_id"),
  ]);

  const people = new Map(customers.map((row) => [String(row.id), row]));
  const locations = new Map(branches.map((row) => [String(row.id), row]));
  const catalog = new Map(services.map((row) => [String(row.id), row]));
  const permission = new Map(preferences.map((row) =>
    [String(row.customer_id), row as unknown as ConsentRow]));
  const groups = new Map<string, BookingRow[]>();
  for (const row of all) {
    const key = row.order_id ?? row.id;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const eventForBooking = new Map<string, string>();
  for (const event of events) {
    const existing = eventForBooking.get(event.booking_id);
    if (!existing || existing < event.created_at) eventForBooking.set(event.booking_id, event.created_at);
  }

  const candidates: SmsCandidate[] = [];
  for (const [key, group] of groups) {
    if (group.length === 0) continue;
    const first = [...group].sort((a, b) =>
      a.booking_date.localeCompare(b.booking_date) ||
      a.start_time.localeCompare(b.start_time) || a.id.localeCompare(b.id))[0];
    // All group lines must share the intended date, branch and organizer.
    if (group.some((line) => line.booking_date !== first.booking_date ||
      line.branch_id !== first.branch_id || line.customer_id !== first.customer_id)) continue;
    const customer = people.get(first.customer_id);
    const branch = locations.get(first.branch_id);
    const consent = permission.get(first.customer_id);
    const phone = smsPhoneE164(String(customer?.phone ?? ""));
    if (!customer || !branch || !phone || !consent ||
      !consent.transactional_opt_in_at || consent.opted_out_at ||
      consent.consented_phone_e164 !== phone) continue;
    const visit: SmsVisit = {
      key,
      bookingId: first.id,
      orderId: first.order_id,
      customerId: first.customer_id,
      customerName: String(customer.full_name ?? ""),
      phone,
      branchName: String(branch.name ?? ""),
      serviceNames: [...new Set(group.map((line) =>
        String(catalog.get(line.service_id)?.name ?? "service")))],
      date: first.booking_date,
      startTime: first.start_time,
      homeService: group.some((line) => line.delivery_type === "home_service" ||
        line.type === "home_service"),
      statuses: group.map((line) => line.status),
      progress: group.map((line) => line.booking_progress_status),
      sessionStarted: group.some((line) => Boolean(line.session_started_at)),
    };
    const eventTimes = group.map((line) => eventForBooking.get(line.id))
      .filter((value): value is string => Boolean(value));
    const confirmedEventAt = eventTimes.sort().at(-1);
    if (confirmedEventAt && isSmsDue("confirmation", visit, now, confirmedEventAt)) {
      candidates.push({ kind: "confirmation", visit, confirmationAt: confirmedEventAt });
    }
    if (isSmsDue("morning", visit, now)) candidates.push({ kind: "morning", visit });
    if (isSmsDue("one_hour", visit, now)) candidates.push({ kind: "one_hour", visit });
  }
  return candidates.sort((a, b) => {
    const priority: Record<SmsKind, number> = { one_hour: 0, confirmation: 1, morning: 2 };
    return priority[a.kind] - priority[b.kind] ||
      a.visit.date.localeCompare(b.visit.date) ||
      a.visit.startTime.localeCompare(b.visit.startTime);
  });
}

async function loadById(
  client: SmsDb,
  table: string,
  fields: string,
  ids: string[],
  column = "id"
): Promise<Record<string, unknown>[]> {
  const output: Record<string, unknown>[] = [];
  for (const idsPart of chunk(ids)) {
    const result = await client.from(table).select(fields).in(column, idsPart);
    output.push(...requireRows(result.data as Record<string, unknown>[] | null, result.error));
  }
  return output;
}

function localDayStartUtc(now: Date): string {
  return businessDate(now) + "T00:00:00+08:00";
}

function smsState(state: TwilioMessageState): string {
  if (state === "delivered" || state === "sent" ||
      state === "failed" || state === "undelivered") return state;
  if (state === "canceled") return "failed";
  return "accepted";
}

async function recentSiblingSent(client: SmsDb, item: SmsCandidate, now: Date): Promise<boolean> {
  const keys = (["confirmation", "morning", "one_hour"] as SmsKind[])
    .filter((kind) => kind !== item.kind)
    .map((kind) => smsDedupeKey(kind, item.visit));
  const result = await client.from("booking_sms_messages")
    .select("id")
    .in("dedupe_key", keys)
    .in("state", ["accepted", "sent", "delivered"])
    .gte("submitted_at", new Date(now.getTime() - COOLDOWN_MS).toISOString())
    .limit(1);
  return requireRows(result.data, result.error).length > 0;
}

async function remainsEligible(client: SmsDb, item: SmsCandidate, now: Date) {
  // Re-read booking state and consent immediately before the claim/send.
  const { visit, kind } = item;
  const result = visit.orderId
    ? await client.from("bookings")
      .select("id,status,booking_date,start_time,booking_progress_status,session_started_at,customer_id,branch_id,delivery_type")
      .eq("order_id", visit.orderId)
    : await client.from("bookings")
      .select("id,status,booking_date,start_time,booking_progress_status,session_started_at,customer_id,branch_id,delivery_type")
      .eq("id", visit.bookingId);
  const lines = requireRows(result.data, result.error);
  if (!lines.length || lines.some((line) => line.status !== "confirmed" ||
    line.booking_date !== visit.date || line.customer_id !== visit.customerId ||
    line.session_started_at ||
    (line.booking_progress_status &&
      !["confirmed", "not_started"].includes(line.booking_progress_status)))) return false;
  // The earliest line is the visit time that was used to prepare the SMS.
  const firstTime = [...lines].sort((a, b) =>
    String(a.start_time).localeCompare(String(b.start_time)))[0]?.start_time;
  if (String(firstTime).slice(0, 5) !== visit.startTime.slice(0, 5)) return false;
  if (!isSmsDue(kind, visit, now, item.confirmationAt)) return false;
  const customer = await client.from("customers").select("phone").eq("id", visit.customerId).single();
  if (customer.error || smsPhoneE164(String(customer.data?.phone ?? "")) !== visit.phone) return false;
  const opt = await client.from("customer_sms_preferences")
    .select("consented_phone_e164,transactional_opt_in_at,opted_out_at")
    .eq("customer_id", visit.customerId).maybeSingle();
  if (opt.error) throw new Error("SMS consent recheck failed");
  return opt.data?.consented_phone_e164 === visit.phone &&
    Boolean(opt.data.transactional_opt_in_at) && !opt.data.opted_out_at;
}

async function pollDeliveryStates(client: SmsDb): Promise<number> {
  const result = await client.from("booking_sms_messages")
    .select("id,provider_sid,state")
    .in("state", ["accepted", "sent"])
    .not("provider_sid", "is", null)
    .order("submitted_at", { ascending: false })
    .limit(POLL_LIMIT_PER_RUN);
  const logs = requireRows(result.data as SmsLog[] | null, result.error);
  let checked = 0;
  for (const log of logs) {
    if (!log.provider_sid) continue;
    try {
      const message = await readTwilioSms(log.provider_sid);
      const next = smsState(message.state);
      if (next !== log.state &&
        // Provider can report delayed callbacks; never downgrade sent to queued.
        !(log.state === "sent" && next === "accepted")) {
        const changed = await client.from("booking_sms_messages")
          .update({ state: next, provider_error_code: message.errorCode,
            updated_at: new Date().toISOString() })
          .eq("id", log.id).eq("provider_sid", message.sid)
          .eq("state", log.state);
        if (changed.error) throw new Error("SMS delivery state update failed");
      }
      checked++;
    } catch {
      // Missing or temporarily unavailable provider status must not resend SMS.
      // Keep the previous state for a subsequent status poll.
    }
  }
  return checked;
}

export async function dispatchCustomerSms(now = new Date()) {
  const launchAt = ensureEnabled(now);
  const dailyCap = checkedCap();
  const client = db();
  const start = localDayStartUtc(now);
  const existing = await client.from("booking_sms_messages")
    .select("id", { head: true, count: "exact" })
    .gte("created_at", new Date(start).toISOString());
  if (existing.error || existing.count === null)
    throw new Error("SMS daily cap ledger unavailable");
  let remaining = Math.max(0, dailyCap - existing.count);
  const candidates = await findBookingCandidates(client, now, launchAt);
  const summary = { eligible: candidates.length, claimed: 0, accepted: 0, failed: 0,
    unknown: 0, suppressed: 0, polled: 0 };
  for (const item of candidates) {
    if (summary.claimed >= SEND_LIMIT_PER_RUN || remaining <= 0) break;
    if (await recentSiblingSent(client, item, now) ||
      !(await remainsEligible(client, item, new Date()))) {
      summary.suppressed++;
      continue;
    }
    const { visit, kind } = item;
    const claimed = await client.from("booking_sms_messages").insert({
      dedupe_key: smsDedupeKey(kind, visit),
      booking_id: visit.bookingId,
      order_id: visit.orderId,
      customer_id: visit.customerId,
      kind,
      appointment_date: visit.date,
      appointment_time: visit.startTime,
      state: "claimed",
    }).select("id").single();
    if (claimed.error?.code === "23505") continue; // concurrent/repeated cron claim
    if (claimed.error || !claimed.data)
      throw new Error("SMS send claim failed; no Twilio request performed");
    summary.claimed++;
    remaining--;
    // No automatic retry after claim: unknown provider outcome must be reviewed.
    try {
      const message = await sendTwilioSms(visit.phone, smsMessage(kind, visit));
      const state = smsState(message.state);
      const result = await client.from("booking_sms_messages")
        .update({ provider_sid: message.sid, state,
          provider_error_code: message.errorCode, submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString() })
        .eq("id", claimed.data.id).eq("state", "claimed");
      if (result.error) throw new Error("SMS accepted but ledger update failed");
      summary.accepted++;
    } catch (error) {
      const rejected = error instanceof TwilioRejected;
      const state = rejected ? "failed" : "unknown";
      const code = rejected ? error.providerCode : "UNCERTAIN_OUTCOME";
      await client.from("booking_sms_messages")
        .update({ state, provider_error_code: code, updated_at: new Date().toISOString() })
        .eq("id", claimed.data.id).eq("state", "claimed");
      if (rejected) summary.failed++; else summary.unknown++;
    }
  }
  summary.polled = await pollDeliveryStates(client);
  return summary; // counts only; no customer PII in cron response
}
