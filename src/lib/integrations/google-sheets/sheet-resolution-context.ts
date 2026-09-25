import type { Database } from "@/types/supabase";
import type {
  IndividualScheduleSourceRow,
  ScheduleOverrideSourceRow,
} from "@/lib/schedule/resolve-staff-schedule";
import type { SheetApprovedAlias, SheetCapturedRow } from "./sheet-ingestion-types";
import { normalizeSheetText } from "./sheet-source-identity";

type Tables = Database["public"]["Tables"];
export type SheetStaff = Pick<
  Tables["staff"]["Row"],
  | "id"
  | "full_name"
  | "nickname"
  | "branch_id"
  | "is_active"
  | "staff_type"
  | "system_role"
  | "archived_at"
  | "merged_into_staff_id"
  | "metadata"
>;
export type SheetService = Pick<
  Tables["services"]["Row"],
  "id" | "name" | "is_active" | "duration_minutes" | "buffer_before" | "buffer_after"
>;
export type SheetCustomer = Pick<
  Tables["customers"]["Row"],
  "id" | "full_name" | "phone" | "email"
>;
export type SheetBranchService = {
  service_id: string;
  branch_id: string;
  is_active: boolean;
  available_in_spa: boolean;
  available_home_service: boolean;
  visibility: "public" | "internal" | "hidden";
  booking_visibility: "public" | "csr_only" | "vip";
  custom_duration_minutes: number | null;
};
export type SheetContext = {
  status: "available" | "unavailable";
  target: "LOCAL" | "TEST" | "STAGING" | "PRODUCTION" | null;
  unavailableReason: string | null;
  branch: { id: string; is_active: boolean } | null;
  staff: SheetStaff[];
  services: SheetService[];
  branchServices: SheetBranchService[];
  capabilities: { staff_id: string; service_id: string }[];
  customers: SheetCustomer[];
  schedules: (IndividualScheduleSourceRow & { staff_id: string; day_of_week: number })[];
  overrides: (NonNullable<ScheduleOverrideSourceRow> & {
    staff_id: string;
    override_date: string;
  })[];
  bookings: {
    id: string;
    staff_id: string;
    booking_date: string;
    start_time: string;
    end_time: string;
    status: string;
    hold_expires_at: string | null;
  }[];
  rules: {
    home_service_enabled: boolean;
    in_spa_start_time: string;
    in_spa_end_time: string;
    home_service_start_time: string;
    home_service_end_time: string;
    max_advance_booking_days: number;
  } | null;
  aliases: SheetApprovedAlias[];
  contacts: { name: string; phone: string | null; email: string | null; source: string }[];
  // No inferred default. A future approved worksheet profile may supply one.
  deliveryPolicy: { value: "in_spa"; approvedBy: string; approvedAt: string } | null;
};
export function unavailableSheetContext(reason: string): SheetContext {
  return {
    status: "unavailable",
    target: null,
    unavailableReason: reason,
    branch: null,
    staff: [],
    services: [],
    branchServices: [],
    capabilities: [],
    customers: [],
    schedules: [],
    overrides: [],
    bookings: [],
    rules: null,
    aliases: [],
    contacts: [],
    deliveryPolicy: null,
  };
}
export type SheetContextNeeds = {
  dates: string[];
  staffLabels: string[];
  serviceLabels: string[];
  customerLabels: string[];
};
export function collectSheetContextNeeds(rows: SheetCapturedRow[]): SheetContextNeeds {
  const unique = (values: (string | null)[]) =>
    [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
  return {
    dates: unique(rows.map((row) => row.parsed.businessDate)),
    staffLabels: unique(rows.map((row) => normalizeSheetText(row.parsed.attendant))),
    serviceLabels: unique(rows.map((row) => normalizeSheetText(row.parsed.service))),
    customerLabels: unique(rows.map((row) => normalizeSheetText(row.parsed.client))),
  };
}
function indexBy<T>(rows: T[], key: (row: T) => string) {
  const result = new Map<string, T[]>();
  for (const row of rows) {
    const value = key(row);
    if (value) result.set(value, [...(result.get(value) ?? []), row]);
  }
  return result;
}
export function buildSheetContextIndexes(context: SheetContext) {
  return {
    context,
    staffNames: indexBy(context.staff, (s) => normalizeSheetText(s.full_name)),
    staffNicknames: indexBy(context.staff, (s) => normalizeSheetText(s.nickname)),
    serviceNames: indexBy(context.services, (s) => normalizeSheetText(s.name)),
    customerNames: indexBy(context.customers, (c) => normalizeSheetText(c.full_name)),
    customerPhones: indexBy(context.customers, (c) => normalizeContactPhone(c.phone)),
    customerEmails: indexBy(context.customers, (c) => normalizeSheetText(c.email)),
    contactNames: indexBy(context.contacts, (c) => normalizeSheetText(c.name)),
    staffById: new Map(context.staff.map((s) => [s.id, s])),
    serviceById: new Map(context.services.map((s) => [s.id, s])),
    customerById: new Map(context.customers.map((c) => [c.id, c])),
    capabilities: new Set(context.capabilities.map((c) => `${c.staff_id}:${c.service_id}`)),
    schedules: indexBy(context.schedules, (s) => `${s.staff_id}:${s.day_of_week}`),
    overrides: indexBy(context.overrides, (s) => `${s.staff_id}:${s.override_date}`),
    bookings: indexBy(context.bookings, (b) => `${b.staff_id}:${b.booking_date}`),
  };
}
export type SheetContextIndexes = ReturnType<typeof buildSheetContextIndexes>;
export function normalizeContactPhone(value: string | null): string {
  const digits = String(value ?? "").replace(/[^\d]/g, "");
  if (/^09\d{9}$/.test(digits)) return `63${digits.slice(1)}`;
  return digits.length >= 10 && digits.length <= 15 ? digits : "";
}
