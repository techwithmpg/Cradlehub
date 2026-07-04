import { createAdminClient } from "@/lib/supabase/admin";
import type { AvailabilitySlot } from "@/types";
import { SlotUnavailableError } from "@/types/errors";
import {
  canActAsBookingServiceProvider,
  staffTypeCanPerformService,
  type ServiceCapabilityContext,
} from "@/lib/staff/service-providers";
import {
  BRANCH_TIMEZONE,
  filterPastSlotsForDate,
  getBranchBusinessDate,
  getDayOfWeekFromYmd,
  rangesOverlap,
  timeToMinutes,
} from "./slot-time";
import { bookingBlocksAvailability } from "@/lib/bookings/hold-status";
import {
  doesDurationFitWithinScheduleWindow,
  getScheduleGroupKeyForStaffType,
  resolveScheduleForStaffDay,
  type GroupScheduleRuleSourceRow,
  type IndividualScheduleSourceRow,
} from "@/lib/schedule/resolve-staff-schedule";

type StaffProviderRow = {
  id: string;
  branch_id: string;
  is_active: boolean;
  staff_type: string | null;
  system_role: string | null;
};

type StaffServiceRow = {
  staff_id: string;
  service_id: string;
};

type AdminClient = ReturnType<typeof createAdminClient>;

type CategoryRelation = { name: string | null } | { name: string | null }[] | null;

type ServiceTiming = ServiceCapabilityContext & {
  id: string;
  durationMinutes: number;
  bufferBefore: number;
  bufferAfter: number;
};

type StaffScheduleRow = {
  staff_id: string;
  shift_type: string | null;
  start_time: string;
  end_time: string;
  is_active: boolean;
};

type ScheduleOverrideRow = {
  staff_id: string;
  shift_type: string | null;
  start_time: string | null;
  end_time: string | null;
  is_day_off: boolean;
};

type BlockingBookingRow = {
  staff_id: string;
  start_time: string;
  end_time: string;
  status: string | null;
  hold_expires_at: string | null;
};

const AVAILABILITY_RPC_ROW_LIMIT = 10000;

function isMissingStaffProviderColumnError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("staff_type") &&
    (lower.includes("does not exist") ||
      lower.includes("schema cache") ||
      lower.includes("could not find"))
  );
}

function isMissingBranchServiceDurationColumnError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("custom_duration_minutes") &&
    (lower.includes("does not exist") ||
      lower.includes("schema cache") ||
      lower.includes("could not find"))
  );
}

function firstCategoryName(value: CategoryRelation | undefined): string | null {
  if (!value) return null;
  const category = Array.isArray(value) ? value[0] : value;
  return category?.name ?? null;
}

function uniqueSlotsByStaffAndTime(slots: AvailabilitySlot[]): AvailabilitySlot[] {
  const seen = new Set<string>();
  const out: AvailabilitySlot[] = [];

  for (const slot of slots) {
    const key = `${slot.staff_id}:${slot.slot_time}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(slot);
  }

  return out;
}

async function getServiceTimings(
  supabase: AdminClient,
  branchId: string,
  serviceIds: string[]
): Promise<Map<string, ServiceTiming>> {
  if (serviceIds.length === 0) return new Map();

  const { data: services, error } = await supabase
    .from("services")
    .select(
      "id, name, duration_minutes, buffer_before, buffer_after, service_categories ( name )"
    )
    .in("id", serviceIds);

  if (error) throw new Error(`Failed to fetch service timings: ${error.message}`);

  let customDurations = new Map<string, number>();
  const overrides = await supabase
    .from("branch_services")
    .select("service_id, custom_duration_minutes")
    .eq("branch_id", branchId)
    .in("service_id", serviceIds);

  if (!overrides.error) {
    customDurations = new Map(
      ((overrides.data ?? []) as unknown as Array<{
        service_id: string;
        custom_duration_minutes?: number | null;
      }>)
        .filter((row) => typeof row.custom_duration_minutes === "number")
        .map((row) => [row.service_id, row.custom_duration_minutes as number])
    );
  } else if (!isMissingBranchServiceDurationColumnError(overrides.error.message)) {
    throw new Error(`Failed to fetch branch service durations: ${overrides.error.message}`);
  }

  return new Map(
    ((services ?? []) as Array<{
      id: string;
      name: string;
      duration_minutes: number;
      buffer_before: number;
      buffer_after: number;
      service_categories?: CategoryRelation;
    }>).map((service) => [
      service.id,
      {
        id: service.id,
        name: service.name,
        categoryName: firstCategoryName(service.service_categories),
        durationMinutes:
          customDurations.get(service.id) ?? service.duration_minutes,
        bufferBefore: service.buffer_before,
        bufferAfter: service.buffer_after,
      },
    ])
  );
}

function totalBlockMinutes(
  serviceIds: string[],
  serviceTimings: Map<string, ServiceTiming>
): number {
  return serviceIds.reduce((sum, serviceId) => {
    const timing = serviceTimings.get(serviceId);
    if (!timing) return sum;
    return sum + timing.durationMinutes + timing.bufferBefore + timing.bufferAfter;
  }, 0);
}

/**
 * Post-filter: confirms that each slot fits fully inside at least one valid
 * working window for that staff member.
 *
 * Window priority (matches the SQL RPC):
 *   1. schedule_override with explicit times → single override window
 *   2. schedule_override is_day_off = TRUE   → slot dropped
 *   3. individual staff_schedules rows        → one window per shift_type
 *   4. group schedule rules (fallback)        → one window per shift_type rule
 *   5. no window                              → slot dropped
 *
 * Multi-window: a slot passes if it fits inside ANY one window. This correctly
 * handles opening (09:00–17:00) + closing (14:00–22:30) scenarios where a slot
 * might only fit the closing window.
 */
async function filterSlotsToWorkingWindows(params: {
  supabase: AdminClient;
  date: string;
  slots: AvailabilitySlot[];
  totalBlockMinutes: number;
  branchId: string;
}): Promise<AvailabilitySlot[]> {
  if (params.slots.length === 0) return params.slots;
  if (params.totalBlockMinutes <= 0) return uniqueSlotsByStaffAndTime(params.slots);

  const staffIds = Array.from(new Set(params.slots.map((slot) => slot.staff_id)));
  const dayOfWeek = getDayOfWeekFromYmd(params.date);

  const [schedulesResult, overridesResult] = await Promise.all([
    params.supabase
      .from("staff_schedules")
      .select("staff_id, shift_type, start_time, end_time, is_active")
      .in("staff_id", staffIds)
      .eq("day_of_week", dayOfWeek),
    params.supabase
      .from("schedule_overrides")
      .select("staff_id, shift_type, start_time, end_time, is_day_off")
      .in("staff_id", staffIds)
      .eq("override_date", params.date),
  ]);

  if (schedulesResult.error) {
    throw new Error(`Staff schedule query failed: ${schedulesResult.error.message}`);
  }
  if (overridesResult.error) {
    throw new Error(`Schedule override query failed: ${overridesResult.error.message}`);
  }

  const individualRowsByStaff = new Map<string, IndividualScheduleSourceRow[]>();
  for (const row of (schedulesResult.data ?? []) as StaffScheduleRow[]) {
    const rows = individualRowsByStaff.get(row.staff_id) ?? [];
    rows.push({
      shift_type: row.shift_type ?? "single",
      start_time: row.start_time,
      end_time: row.end_time,
      is_active: row.is_active,
    });
    individualRowsByStaff.set(row.staff_id, rows);
  }

  const overridesByStaff = new Map<string, ScheduleOverrideRow>();
  for (const row of (overridesResult.data ?? []) as ScheduleOverrideRow[]) {
    overridesByStaff.set(row.staff_id, row);
  }

  // Group fallback: only needed for staff who have no individual schedule rows and
  // no day-off override. These staff members got their slots from the RPC's
  // group-rule branch; the TypeScript filter must honour the same source.
  const staffNeedingGroupLookup = staffIds.filter(
    (id) => !individualRowsByStaff.has(id) && !overridesByStaff.get(id)?.is_day_off
  );

  const groupRulesByStaff = new Map<string, GroupScheduleRuleSourceRow[]>();

  if (staffNeedingGroupLookup.length > 0) {
    const staffTypeResult = await params.supabase
      .from("staff")
      .select("id, staff_type")
      .in("id", staffNeedingGroupLookup);

    if (!staffTypeResult.error && staffTypeResult.data) {
      type StaffTypeRow = { id: string; staff_type: string | null };
      const staffTypeRows = staffTypeResult.data as StaffTypeRow[];
      const staffTypeMap = new Map<string, string | null>(
        staffTypeRows.map((s) => [s.id, s.staff_type])
      );
      const staffTypesNeeded = [
        ...new Set(
          staffTypeRows
            .flatMap((s) => [getScheduleGroupKeyForStaffType(s.staff_type), s.staff_type])
            .filter((t): t is string => t !== null)
        ),
      ];

      if (staffTypesNeeded.length > 0) {
        const groupsResult = await params.supabase
          .from("staff_schedule_groups")
          .select("id, group_key")
          .eq("branch_id", params.branchId)
          .eq("is_active", true)
          .in("group_key", staffTypesNeeded);

        if (!groupsResult.error && groupsResult.data && groupsResult.data.length > 0) {
          type GroupRow = { id: string; group_key: string };
          const groupRows = groupsResult.data as GroupRow[];
          const groupIds = groupRows.map((g) => g.id);
          const groupKeyById = new Map(groupRows.map((g) => [g.id, g.group_key]));

          const rulesResult = await params.supabase
            .from("staff_group_schedule_rules")
            .select("group_id, shift_type, start_time, end_time, is_active, is_day_off")
            .in("group_id", groupIds)
            .eq("day_of_week", dayOfWeek)
            .eq("is_active", true);

          if (!rulesResult.error && rulesResult.data) {
            type GroupRuleRow = {
              group_id: string;
              shift_type: string | null;
              start_time: string | null;
              end_time: string | null;
              is_active: boolean | null;
              is_day_off: boolean;
            };
            const ruleRows = rulesResult.data as GroupRuleRow[];

            for (const [staffId, staffType] of staffTypeMap) {
              const candidateKeys = [
                getScheduleGroupKeyForStaffType(staffType),
                staffType,
              ].filter((value): value is string => Boolean(value));
              const matchingRules = ruleRows
                .filter((r) => candidateKeys.includes(groupKeyById.get(r.group_id) ?? ""))
                .map((r) => ({
                  shift_type: r.shift_type ?? "single",
                  start_time: r.start_time,
                  end_time: r.end_time,
                  is_active: r.is_active,
                  is_day_off: r.is_day_off,
                }));

              if (matchingRules.length > 0) {
                groupRulesByStaff.set(staffId, matchingRules);
              }
            }
          }
        }
      }
    }
  }

  return uniqueSlotsByStaffAndTime(
    params.slots.filter((slot) => {
      const resolved = resolveScheduleForStaffDay({
        override: overridesByStaff.get(slot.staff_id) ?? null,
        individualRows: individualRowsByStaff.get(slot.staff_id) ?? [],
        groupRules: groupRulesByStaff.get(slot.staff_id) ?? [],
      });

      if (!resolved.isWorking) return false;

      return resolved.windows.some((window) =>
        doesDurationFitWithinScheduleWindow({
          slotStartTime: slot.slot_time,
          durationMinutes: params.totalBlockMinutes,
          window,
        })
      );
    })
  );
}

async function getActiveStaffProviderRows(branchId: string): Promise<StaffProviderRow[]> {
  const supabase = createAdminClient();
  const primary = await supabase
    .from("staff")
    .select("id, branch_id, is_active, staff_type, system_role")
    .eq("branch_id", branchId)
    .eq("is_active", true);

  if (!primary.error) {
    return (primary.data ?? []) as StaffProviderRow[];
  }

  if (!isMissingStaffProviderColumnError(primary.error.message)) {
    throw new Error(`Staff provider query failed: ${primary.error.message}`);
  }

  const fallback = await supabase
    .from("staff")
    .select("id, branch_id, is_active, system_role")
    .eq("branch_id", branchId)
    .eq("is_active", true);

  if (fallback.error) {
    throw new Error(`Staff provider fallback query failed: ${fallback.error.message}`);
  }

  return ((fallback.data ?? []) as Array<Omit<StaffProviderRow, "staff_type">>).map(
    (member) => ({
      ...member,
      staff_type: null,
    })
  );
}

async function fetchAvailableSlotsFromRpc(
  supabase: AdminClient,
  rpcArgs: {
    p_branch_id: string;
    p_service_id: string;
    p_staff_id?: string;
    p_date: string;
  }
): Promise<AvailabilitySlot[]> {
  const { data, error } = await supabase
    .rpc("get_available_slots", rpcArgs)
    .range(0, AVAILABILITY_RPC_ROW_LIMIT - 1);

  if (error) throw new Error(`Availability query failed: ${error.message}`);
  return (data ?? []) as AvailabilitySlot[];
}

function serviceCapabilitySets(rows: StaffServiceRow[]) {
  const staffIdsByService = new Map<string, Set<string>>();
  const serviceIdsByStaff = new Map<string, Set<string>>();

  for (const row of rows) {
    const staffSet = staffIdsByService.get(row.service_id) ?? new Set<string>();
    staffSet.add(row.staff_id);
    staffIdsByService.set(row.service_id, staffSet);

    const serviceSet = serviceIdsByStaff.get(row.staff_id) ?? new Set<string>();
    serviceSet.add(row.service_id);
    serviceIdsByStaff.set(row.staff_id, serviceSet);
  }

  return { staffIdsByService, serviceIdsByStaff };
}

async function filterSlotsForQualifiedProviders(params: {
  branchId: string;
  serviceIds: string[];
  slots: AvailabilitySlot[];
  serviceTimings: Map<string, ServiceTiming>;
}): Promise<AvailabilitySlot[]> {
  if (params.slots.length === 0 || params.serviceIds.length === 0) return params.slots;

  const supabase = createAdminClient();
  const [staffRows, capabilityResult] = await Promise.all([
    getActiveStaffProviderRows(params.branchId),
    supabase
      .from("staff_services")
      .select("staff_id, service_id")
      .in("service_id", params.serviceIds),
  ]);

  if (capabilityResult.error) {
    throw new Error(`Staff service capability query failed: ${capabilityResult.error.message}`);
  }

  const staffById = new Map(staffRows.map((member) => [member.id, member]));
  const slotStaffIds = new Set(params.slots.map((slot) => slot.staff_id));
  const scopedCapabilityRows = ((capabilityResult.data ?? []) as StaffServiceRow[]).filter(
    (row) => {
      const staff = staffById.get(row.staff_id);
      if (!staff) return false;
      if (!canActAsBookingServiceProvider(staff, true)) return false;

      return staff.staff_type
        ? staffTypeCanPerformService(staff.staff_type, params.serviceTimings.get(row.service_id))
        : true;
    }
  );
  const { staffIdsByService, serviceIdsByStaff } = serviceCapabilitySets(
    scopedCapabilityRows
  );
  const constrainedServiceIds = new Set(
    params.serviceIds.filter((serviceId) => {
      const mappedStaffIds = staffIdsByService.get(serviceId);
      return !!mappedStaffIds && Array.from(mappedStaffIds).some((staffId) => slotStaffIds.has(staffId));
    })
  );

  return params.slots.filter((slot) => {
    const staff = staffById.get(slot.staff_id);
    if (!staff) return false;

    const staffServiceIds = serviceIdsByStaff.get(slot.staff_id) ?? new Set<string>();
    const hasMatchingCapability = params.serviceIds.some((serviceId) =>
      staffServiceIds.has(serviceId)
    );

    if (!canActAsBookingServiceProvider(staff, hasMatchingCapability)) {
      return false;
    }

    return params.serviceIds.every((serviceId) => {
      const qualifiedStaffIds = staffIdsByService.get(serviceId);
      if (constrainedServiceIds.has(serviceId)) {
        return !!qualifiedStaffIds?.has(slot.staff_id);
      }

      const service = params.serviceTimings.get(serviceId);
      return staff.staff_type
        ? staffTypeCanPerformService(staff.staff_type, service)
        : hasMatchingCapability;
    });
  });
}

/**
 * Calls the get_available_slots RPC and returns all slots.
 * If staff_services rows exist for the selected service, slots are filtered to
 * those staff members. When no capability rows exist, legacy fallback still
 * excludes drivers, utility, CSR, admin, and manager-only staff.
 */
export async function getAvailableSlots(params: {
  branchId:  string;
  serviceId: string;
  staffId?:  string;
  date:      string;
}): Promise<AvailabilitySlot[]> {
  const today = getBranchBusinessDate();
  if (params.date < today) return [];

  const supabase = createAdminClient();
  const serviceTimings = await getServiceTimings(supabase, params.branchId, [
    params.serviceId,
  ]);
  const blockMinutes = totalBlockMinutes([params.serviceId], serviceTimings);

  const rpcArgs = {
    p_branch_id:  params.branchId,
    p_service_id: params.serviceId,
    p_date:       params.date,
  };

  let slots: AvailabilitySlot[];
  if (params.staffId) {
    slots = await fetchAvailableSlotsFromRpc(supabase, {
      ...rpcArgs,
      p_staff_id: params.staffId,
    });
  } else {
    const staffRows = await getActiveStaffProviderRows(params.branchId);
    const candidateStaffIds = staffRows
      .filter((member) => canActAsBookingServiceProvider(member, true))
      .map((member) => member.id);

    const slotGroups = await Promise.all(
      candidateStaffIds.map((staffId) =>
        fetchAvailableSlotsFromRpc(supabase, {
          ...rpcArgs,
          p_staff_id: staffId,
        })
      )
    );

    slots = slotGroups.flat();
  }

  slots = await filterSlotsToWorkingWindows({
    supabase,
    date:              params.date,
    slots,
    totalBlockMinutes: blockMinutes,
    branchId:          params.branchId,
  });

  slots = await filterSlotsForQualifiedProviders({
    branchId:     params.branchId,
    serviceIds:   [params.serviceId],
    slots,
    serviceTimings,
  });

  return filterPastSlotsForDate({
    selectedDate: params.date,
    slots,
    timezone: BRANCH_TIMEZONE,
  });
}

/**
 * When customer selects "any therapist", we call get_available_slots
 * with no staffId (returns all staff), then pick by seniority rule:
 *   Senior → Mid → Junior
 *   Tie-break: alphabetical by staff_name
 *
 * Returns the assigned staff_id, or throws SlotUnavailableError if none available.
 */
export async function assignTherapistBySeniority(params: {
  branchId:  string;
  serviceId: string;
  date:      string;
  startTime: string;
}): Promise<string> {
  const slots = await getAvailableSlots({
    branchId:  params.branchId,
    serviceId: params.serviceId,
    date:      params.date,
    // No staffId — returns all staff
  });

  // Filter to the requested time that is still available
  const candidates = slots.filter(
    (s) =>
      s.available &&
      s.slot_time.startsWith(params.startTime.substring(0, 5)) // compare HH:MM
  );

  if (candidates.length === 0) throw new SlotUnavailableError();

  // Sort by seniority then name
  const TIER_ORDER: Record<string, number> = { senior: 0, mid: 1, junior: 2 };
  candidates.sort((a, b) => {
    const tierDiff =
      (TIER_ORDER[a.staff_tier] ?? 9) - (TIER_ORDER[b.staff_tier] ?? 9);
    if (tierDiff !== 0) return tierDiff;
    return a.staff_name.localeCompare(b.staff_name);
  });

  return candidates[0]!.staff_id;
}

/**
 * Multi-service variant of getAvailableSlots.
 * Combines durations of all selected services and post-filters slots so only
 * (staff, slot_time) pairs with the full combined window free are marked available.
 */
export async function getAvailableSlotsMulti(params: {
  branchId:   string;
  serviceIds: string[];
  date:       string;
}): Promise<AvailabilitySlot[]> {
  const { branchId, serviceIds, date } = params;

  if (serviceIds.length === 0) return [];
  if (serviceIds.length === 1) {
    return getAvailableSlots({ branchId, serviceId: serviceIds[0]!, date });
  }

  const supabase = createAdminClient();
  const serviceTimings = await getServiceTimings(supabase, branchId, serviceIds);
  const totalMinutes = totalBlockMinutes(serviceIds, serviceTimings);

  // 1. Total effective duration across all services
  if (totalMinutes <= 0) return [];

  // 2. Get base slots using first service (provides correct slot intervals)
  const baseSlots = await getAvailableSlots({ branchId, serviceId: serviceIds[0]!, date });
  if (baseSlots.length === 0) return [];

  // 3. Fetch existing bookings for the day to validate full combined window
  const staffIds = Array.from(new Set(baseSlots.map((slot) => slot.staff_id)));
  const { data: dayBookings } = await supabase
    .from("bookings")
    .select("staff_id, start_time, end_time, status, hold_expires_at")
    .eq("booking_date", date)
    .in("staff_id", staffIds);

  const bookingsByStaff = new Map<string, Array<{ start: number; end: number }>>();
  const now = new Date();
  for (const b of (dayBookings ?? []) as BlockingBookingRow[]) {
    if (!bookingBlocksAvailability(b, now)) continue;

    if (!bookingsByStaff.has(b.staff_id)) bookingsByStaff.set(b.staff_id, []);
    bookingsByStaff.get(b.staff_id)!.push({
      start: timeToMinutes(b.start_time),
      end:   timeToMinutes(b.end_time),
    });
  }

  const combinedSlots = baseSlots.map((slot) => {
    if (!slot.available) return slot;

    const slotStart = timeToMinutes(slot.slot_time);
    const slotEnd   = slotStart + totalMinutes;

    const staffBookings = bookingsByStaff.get(slot.staff_id) ?? [];
    const hasConflict = staffBookings.some((b) =>
      rangesOverlap(slotStart, slotEnd, b.start, b.end)
    );

    return { ...slot, available: !hasConflict };
  });

  const workingSlots = await filterSlotsToWorkingWindows({
    supabase,
    date,
    slots:             combinedSlots,
    totalBlockMinutes: totalMinutes,
    branchId,
  });

  const qualifiedSlots = await filterSlotsForQualifiedProviders({
    branchId,
    serviceIds,
    slots: workingSlots,
    serviceTimings,
  });

  // Belt-and-suspenders: ensure same-day past slots are never returned even if
  // they somehow survived the baseSlots filter (e.g. clock skew between the RPC
  // call and this post-filter, or a future code path that bypasses getAvailableSlots).
  return filterPastSlotsForDate({
    selectedDate: date,
    slots: qualifiedSlots,
    timezone: BRANCH_TIMEZONE,
  });
}

/**
 * Multi-service variant of assignTherapistBySeniority.
 * Finds available therapists for the combined duration and assigns by tier priority.
 */
export async function assignTherapistBySeniorityMulti(params: {
  branchId:   string;
  serviceIds: string[];
  date:       string;
  startTime:  string;
}): Promise<string> {
  const slots = await getAvailableSlotsMulti({
    branchId:   params.branchId,
    serviceIds: params.serviceIds,
    date:       params.date,
  });

  const candidates = slots.filter(
    (s) =>
      s.available &&
      s.slot_time.startsWith(params.startTime.substring(0, 5))
  );

  if (candidates.length === 0) throw new SlotUnavailableError();

  const TIER_ORDER: Record<string, number> = { senior: 0, mid: 1, junior: 2 };
  candidates.sort((a, b) => {
    const tierDiff =
      (TIER_ORDER[a.staff_tier] ?? 9) - (TIER_ORDER[b.staff_tier] ?? 9);
    if (tierDiff !== 0) return tierDiff;
    return a.staff_name.localeCompare(b.staff_name);
  });

  return candidates[0]!.staff_id;
}

/**
 * Verifies a specific slot is still available.
 * Throws SlotUnavailableError if taken (race condition protection).
 */
export async function assertSlotAvailable(params: {
  branchId:  string;
  serviceId: string;
  staffId:   string;
  date:      string;
  startTime: string;
}): Promise<void> {
  const slots = await getAvailableSlots({
    branchId:  params.branchId,
    serviceId: params.serviceId,
    staffId:   params.staffId,
    date:      params.date,
  });

  const slot = slots.find(
    (s) =>
      s.staff_id === params.staffId &&
      s.slot_time.startsWith(params.startTime.substring(0, 5))
  );

  if (!slot?.available) throw new SlotUnavailableError();
}

export async function assertMultiServiceSlotAvailable(params: {
  branchId: string;
  serviceIds: string[];
  staffId: string;
  date: string;
  startTime: string;
}): Promise<void> {
  const slots = await getAvailableSlotsMulti({
    branchId: params.branchId,
    serviceIds: params.serviceIds,
    date: params.date,
  });

  const slot = slots.find(
    (candidate) =>
      candidate.staff_id === params.staffId &&
      candidate.available &&
      candidate.slot_time.startsWith(params.startTime.substring(0, 5))
  );

  if (!slot) throw new SlotUnavailableError();
}
