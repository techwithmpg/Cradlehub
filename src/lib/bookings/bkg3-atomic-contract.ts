import { createHash } from "crypto";

/**
 * =============================================================================
 * BKG3 — ADDITIVE BOOKING ORDER + ATOMIC CREATION CONTRACT (FINAL DRAFT)
 * =============================================================================
 *
 * Authority & Architecture:
 * 1. 1 checkout = 1 canonical booking order (booking_orders).
 * 2. 1..N attendees receiving care (booking_attendees).
 *    - Guests do NOT require a Supabase Auth account or a customer profile.
 * 3. 1..N service-line appointments (bookings).
 *    - Preserves existing `bookings.id` as the canonical appointment ID.
 *    - Additive foreign keys: `order_id`, `attendee_id`, `line_sequence`.
 *    - `bookings.customer_id` ALWAYS references organizer_customer_id (legacy non-null compatibility).
 *    - `bookings.attendee_id` references the recipient in `booking_attendees`.
 * 4. Genuinely atomic: all writes commit in one database transaction.
 *    - Failure on any service line rolls back the entire order.
 * 5. Authoritative idempotency & digest:
 *    - Client provides stable UUID idempotency key.
 *    - Transactional boundary computes the canonical SHA-256 payload digest.
 *    - Caller does NOT supply client-trusted hash.
 *    - Canonical payload excludes nondeterministic fields (generated IDs, timestamps, order number).
 *    - Retry with identical payload returns existing order.
 *    - Retry with different payload rejects with IDEMPOTENCY_CONFLICT.
 * 6. Order Number Generation:
 *    - Server/DB-authoritative: formatted as `CRD-YYMM-XXXX`.
 *    - Collision retry loop (up to 20 attempts) with fail-closed threshold.
 * 7. Non-Financial & Derived Status:
 *    - `booking_orders` has NO stored mutable status column (derived from child lines).
 *    - View `public.v_booking_orders` defined `WITH (security_invoker = true)`.
 *    - `payment_preference` is strictly 'pay_at_spa' (no online_checkout).
 * 8. Historical safety:
 *    - Zero retroactive guessing or synthetic grouping.
 *    - Old bookings have `order_id IS NULL` and remain fully valid and readable.
 * 9. Hardened RPC Security & Table Grants:
 *    - Tables: anon/authenticated cannot write; authenticated has SELECT only; service_role has ALL.
 *    - RPC function: SECURITY INVOKER; revoked from PUBLIC, anon, authenticated; granted to service_role.
 *    - Owner: global SELECT.
 *    - CRM / Manager / Store Manager / Assistant Manager: branch-scoped SELECT.
 *    - Therapists/Drivers: NO direct parent table SELECT; access via assigned bookings/server endpoints.
 * =============================================================================
 */

// ─── 1. CANONICAL BKG3 DOMAIN TYPES ──────────────────────────────────────────

export type DeliveryType = "in_spa" | "home_service";
export type DerivedBookingOrderStatus =
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show"
  | "expired"
  | "pending"
  | "no_lines";
export type PaymentPreference = "pay_at_spa";

export interface BookingOrderRecord {
  id: string;
  order_number: string;
  branch_id: string;
  organizer_customer_id: string;
  delivery_type: DeliveryType;
  booking_date: string;
  currency: string;
  payment_preference: PaymentPreference;
  idempotency_key: string;
  payload_hash: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface BookingAttendeeRecord {
  id: string;
  booking_order_id: string;
  sequence: number;
  display_name: string;
  customer_id: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface BookingServiceLineRecord {
  id: string;
  order_id: string | null;
  attendee_id: string | null;
  line_sequence: number | null;
  branch_id: string;
  service_id: string;
  staff_id: string;
  customer_id: string; // Organizer customer ID
  booking_date: string;
  start_time: string;
  end_time: string;
  type: string;
  delivery_type: string;
  status: string;
  payment_method: string;
  payment_status: string;
  amount_paid: number;
  travel_buffer_mins: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ─── 2. ATOMIC RPC PAYLOAD & RESULT TYPES ─────────────────────────────────────

export interface AtomicAttendeePayload {
  sequence: number;
  display_name: string;
  customer_id?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AtomicServiceLinePayload {
  attendee_sequence: number;
  line_sequence: number;
  service_id: string;
  staff_id: string;
  start_time: string;
  end_time: string;
  travel_buffer_mins?: number | null;
  metadata?: Record<string, unknown>;
}

export interface AtomicOrderPayload {
  branch_id: string;
  organizer_customer_id: string;
  delivery_type: DeliveryType;
  booking_date: string;
  currency?: string;
  payment_preference?: PaymentPreference;
  metadata?: Record<string, unknown>;
}

export interface CreateBookingOrderAtomicInput {
  idempotency_key: string;
  order: AtomicOrderPayload;
  attendees: AtomicAttendeePayload[];
  service_lines: AtomicServiceLinePayload[];
}

export type CreateBookingOrderAtomicResult =
  | {
      ok: true;
      idempotency_status: "created" | "replayed";
      order_id: string;
      order_number: string;
      status: DerivedBookingOrderStatus;
      service_line_ids: string[];
      attendee_ids: string[];
    }
  | {
      ok: false;
      code: string;
      message: string;
      detail?: string;
    };

export interface BuildAtomicOrderParams {
  idempotencyKey: string;
  branchId: string;
  organizerCustomerId: string;
  deliveryType: DeliveryType;
  bookingDate: string;
  currency?: string;
  paymentPreference?: PaymentPreference;
  orderMetadata?: Record<string, unknown>;
  attendees: Array<{
    sequence: number;
    displayName: string;
    customerId?: string | null;
    notes?: string | null;
    metadata?: Record<string, unknown>;
  }>;
  serviceLines: Array<{
    attendeeSequence: number;
    lineSequence: number;
    serviceId: string;
    staffId: string;
    startTime: string;
    endTime: string;
    travelBufferMins?: number | null;
    metadata?: Record<string, unknown>;
  }>;
}

/**
 * Builds the canonical payload matching create_booking_order_atomic migration contract.
 */
export function buildAtomicBookingOrderPayload(
  params: BuildAtomicOrderParams
): CreateBookingOrderAtomicInput {
  return {
    idempotency_key: params.idempotencyKey,
    order: {
      branch_id: params.branchId,
      organizer_customer_id: params.organizerCustomerId,
      delivery_type: params.deliveryType,
      booking_date: params.bookingDate,
      currency: params.currency ?? "PHP",
      payment_preference: params.paymentPreference ?? "pay_at_spa",
      metadata: params.orderMetadata ?? {},
    },
    attendees: params.attendees.map((a) => ({
      sequence: a.sequence,
      display_name: a.displayName,
      customer_id: a.customerId ?? null,
      notes: a.notes ?? null,
      metadata: a.metadata ?? {},
    })),
    service_lines: params.serviceLines.map((l) => ({
      attendee_sequence: l.attendeeSequence,
      line_sequence: l.lineSequence,
      service_id: l.serviceId,
      staff_id: l.staffId,
      start_time: l.startTime,
      end_time: l.endTime,
      travel_buffer_mins: l.travelBufferMins ?? null,
      metadata: l.metadata ?? {},
    })),
  };
}

/**
 * Maps expected database errors into safe, user-facing application error responses.
 * Never leaks raw SQL or database internal secrets to the caller.
 */
export function mapAtomicBookingRpcError(error: unknown): {
  code: string;
  message: string;
} {
  const errMsg =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error ?? "");

  const errDetails =
    typeof error === "object" && error !== null && "details" in error
      ? String((error as { details: unknown }).details)
      : typeof error === "object" && error !== null && "detail" in error
        ? String((error as { detail: unknown }).detail)
        : "";

  const errCode =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  const combined = `${errMsg} ${errDetails} ${errCode}`;

  if (combined.includes("IDEMPOTENCY_CONFLICT")) {
    return {
      code: "IDEMPOTENCY_CONFLICT",
      message:
        "A booking request with this key already exists with different details. Please start a fresh booking.",
    };
  }

  if (combined.includes("BOOKING_STAFF_TIME_CONFLICT")) {
    return {
      code: "BOOKING_STAFF_TIME_CONFLICT",
      message:
        "The selected therapist is no longer available for this time slot. Please choose another time or therapist.",
    };
  }

  if (combined.includes("BOOKING_RESOURCE_TIME_CONFLICT")) {
    return {
      code: "BOOKING_RESOURCE_TIME_CONFLICT",
      message:
        "The treatment room is no longer available for this time slot. Please select another time.",
    };
  }

  if (combined.includes("BOOKING_RESOURCE_INVALID_FOR_BRANCH")) {
    return {
      code: "BOOKING_RESOURCE_INVALID_FOR_BRANCH",
      message: "The assigned room or resource is not available at this branch.",
    };
  }

  if (combined.includes("BOOKING_SERVICE_NOT_AVAILABLE_AT_BRANCH")) {
    return {
      code: "BOOKING_SERVICE_NOT_AVAILABLE_AT_BRANCH",
      message: "One or more selected services are not available at this branch.",
    };
  }

  if (combined.includes("BOOKING_END_TIME_MUST_BE_AFTER_START_TIME")) {
    return {
      code: "BOOKING_END_TIME_MUST_BE_AFTER_START_TIME",
      message: "Invalid service timing: end time must be after start time.",
    };
  }

  if (combined.includes("ORDER_NUMBER_GENERATION_FAILED")) {
    return {
      code: "ORDER_NUMBER_GENERATION_FAILED",
      message: "Could not generate order confirmation. Please try submitting again.",
    };
  }

  if (combined.includes("BRANCH_NOT_FOUND")) {
    return {
      code: "BRANCH_NOT_FOUND",
      message: "Selected branch was not found. Please reselect a branch.",
    };
  }

  if (combined.includes("CUSTOMER_NOT_FOUND")) {
    return {
      code: "CUSTOMER_NOT_FOUND",
      message: "Could not locate customer profile. Please check your contact details.",
    };
  }

  if (combined.includes("ATTENDEE_SEQUENCE_UNRESOLVED")) {
    return {
      code: "ATTENDEE_SEQUENCE_UNRESOLVED",
      message:
        "Could not associate service line with guest attendee. Please check attendee selections.",
    };
  }

  return {
    code: "BOOKING_ATOMIC_PERSISTENCE_FAILED",
    message:
      "We couldn't confirm your booking at this time. Please try again or contact the branch.",
  };
}

/**
 * Type guard for successful atomic RPC return shape.
 */
export function isAtomicRpcSuccess(
  data: unknown
): data is Extract<CreateBookingOrderAtomicResult, { ok: true }> {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as Record<string, unknown>).ok === true &&
    typeof (data as Record<string, unknown>).order_id === "string" &&
    typeof (data as Record<string, unknown>).order_number === "string" &&
    Array.isArray((data as Record<string, unknown>).service_line_ids) &&
    Array.isArray((data as Record<string, unknown>).attendee_ids)
  );
}

// ─── 3. DERIVED STATUS LOGIC (EXHAUSTIVE & TABLE-DRIVEN) ──────────────────────

/**
 * Derives parent order status from child service-line statuses.
 * Invariant: An order with no active child lines will NEVER derive 'confirmed'.
 */
export function deriveBookingOrderStatus(lineStatuses: string[]): DerivedBookingOrderStatus {
  const total = lineStatuses.length;
  if (total === 0) return "no_lines";

  const inProgressCount = lineStatuses.filter((s) => s === "in_progress").length;
  const confirmedCount = lineStatuses.filter((s) => s === "confirmed").length;
  const pendingCount = lineStatuses.filter((s) =>
    ["pending", "pending_payment", "pending_crm_confirmation"].includes(s)
  ).length;
  const completedCount = lineStatuses.filter((s) => s === "completed").length;
  const cancelledCount = lineStatuses.filter((s) => s === "cancelled").length;
  const noShowCount = lineStatuses.filter((s) => s === "no_show").length;
  const expiredCount = lineStatuses.filter((s) => s === "expired").length;

  // 1. Active in-progress service takes operational precedence
  if (inProgressCount > 0) return "in_progress";

  // 2. Confirmed scheduled service exists
  if (confirmedCount > 0) return "confirmed";

  // 3. Pending hold / confirmation exists
  if (pendingCount > 0) return "pending";

  // INVARIANT: At this point, ALL child lines are in terminal states!
  // Under NO circumstance can execution return 'confirmed' here!

  // 4. Service delivery was fulfilled (at least one service completed)
  // Covers: all completed, completed + cancelled, completed + no_show
  if (completedCount > 0) return "completed";

  // 5. Customer no-show without fulfilled service
  // Covers: all no_show, no_show + cancelled
  if (noShowCount > 0) return "no_show";

  // 6. Slot hold expiration
  if (expiredCount > 0 && cancelledCount === 0) return "expired";

  // 7. Cancellation
  return "cancelled";
}

// ─── 4. SERVER-AUTHORITATIVE HASHING & ORDER NUMBER GENERATION ───────────────

/**
 * Computes canonical SHA-256 payload digest inside the transaction boundary.
 * Strictly excludes any nondeterministic or generated fields.
 */
export function computeCanonicalPayloadDigest(payload: {
  order: AtomicOrderPayload;
  attendees: AtomicAttendeePayload[];
  service_lines: AtomicServiceLinePayload[];
}): string {
  // Strip any accidental generated fields to guarantee deterministic hashing
  const sanitizedOrder: AtomicOrderPayload = {
    branch_id: payload.order.branch_id,
    organizer_customer_id: payload.order.organizer_customer_id,
    delivery_type: payload.order.delivery_type,
    booking_date: payload.order.booking_date,
    currency: payload.order.currency ?? "PHP",
    payment_preference: "pay_at_spa",
    metadata: payload.order.metadata ?? {},
  };

  const sanitizedAttendees: AtomicAttendeePayload[] = payload.attendees.map((a) => ({
    sequence: a.sequence,
    display_name: a.display_name,
    customer_id: a.customer_id ?? null,
    notes: a.notes ?? null,
    metadata: a.metadata ?? {},
  }));

  const sanitizedLines: AtomicServiceLinePayload[] = payload.service_lines.map((l) => ({
    attendee_sequence: l.attendee_sequence,
    line_sequence: l.line_sequence,
    service_id: l.service_id,
    staff_id: l.staff_id,
    start_time: l.start_time,
    end_time: l.end_time,
    travel_buffer_mins: l.travel_buffer_mins ?? null,
    metadata: l.metadata ?? {},
  }));

  const canonicalStr = `${JSON.stringify(sanitizedOrder)}||${JSON.stringify(
    sanitizedAttendees
  )}||${JSON.stringify(sanitizedLines)}`;

  return createHash("sha256").update(canonicalStr).digest("hex");
}

export function generateOrderNumber(dateStr: string, entropy?: string): string {
  const yymm = dateStr.replace(/-/g, "").slice(2, 6);
  const suffix = entropy || Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CRD-${yymm}-${suffix}`;
}

export function isValidUuid(val: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
}

// ─── 4B. IDEMPOTENCY KEY DURABILITY & STORAGE ───────────────────────────────

export const CHECKOUT_ATTEMPT_STORAGE_KEY = "cradle_booking_checkout_attempt_id";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Retrieves the current checkout attempt ID from sessionStorage if valid,
 * or generates and persists a new valid UUID.
 * SSR-safe: returns a valid fallback UUID if executed on server / non-browser environment.
 */
export function getOrCreateCheckoutAttemptId(storage?: StorageLike): string {
  try {
    const s =
      storage ??
      (typeof window !== "undefined" && window.sessionStorage ? window.sessionStorage : undefined);

    if (s) {
      const stored = s.getItem(CHECKOUT_ATTEMPT_STORAGE_KEY);
      if (stored && isValidUuid(stored)) {
        return stored;
      }
      // Malformed or missing: generate fresh UUID
      const freshId =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : "00000000-0000-4000-8000-000000000000";
      s.setItem(CHECKOUT_ATTEMPT_STORAGE_KEY, freshId);
      return freshId;
    }
  } catch {
    // If sessionStorage access is restricted or throws (e.g. privacy mode)
  }

  // Fallback for SSR or non-storage environments
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : "00000000-0000-4000-8000-000000000000";
}

/**
 * Resets / generates a fresh checkout attempt ID in sessionStorage when starting a NEW booking flow.
 */
export function resetCheckoutAttemptId(storage?: StorageLike): string {
  const freshId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : "00000000-0000-4000-8000-000000000000";

  try {
    const s =
      storage ??
      (typeof window !== "undefined" && window.sessionStorage ? window.sessionStorage : undefined);

    if (s) {
      s.setItem(CHECKOUT_ATTEMPT_STORAGE_KEY, freshId);
    }
  } catch {
    // Graceful handling
  }

  return freshId;
}

/**
 * Explicitly clears the checkout attempt ID from sessionStorage.
 */
export function clearCheckoutAttemptId(storage?: StorageLike): void {
  try {
    const s =
      storage ??
      (typeof window !== "undefined" && window.sessionStorage ? window.sessionStorage : undefined);

    if (s) {
      s.removeItem(CHECKOUT_ATTEMPT_STORAGE_KEY);
    }
  } catch {
    // Graceful handling
  }
}

// ─── 5. VALIDATION CONTRACT ──────────────────────────────────────────────────

export interface ValidationIssue {
  field: string;
  message: string;
}

export function validateAtomicOrderInput(
  input: CreateBookingOrderAtomicInput
): { valid: true } | { valid: false; errors: ValidationIssue[] } {
  const errors: ValidationIssue[] = [];

  if (!input.idempotency_key || !isValidUuid(input.idempotency_key)) {
    errors.push({
      field: "idempotency_key",
      message: "A valid UUID idempotency key is required.",
    });
  }

  if (!input.order.branch_id || !isValidUuid(input.order.branch_id)) {
    errors.push({
      field: "order.branch_id",
      message: "A valid branch UUID is required.",
    });
  }

  if (!input.order.organizer_customer_id || !isValidUuid(input.order.organizer_customer_id)) {
    errors.push({
      field: "order.organizer_customer_id",
      message: "A valid organizer customer UUID is required.",
    });
  }

  if (!input.order.booking_date || !/^\d{4}-\d{2}-\d{2}$/.test(input.order.booking_date)) {
    errors.push({
      field: "order.booking_date",
      message: "A valid booking_date (YYYY-MM-DD) is required.",
    });
  }

  if (!["in_spa", "home_service"].includes(input.order.delivery_type)) {
    errors.push({
      field: "order.delivery_type",
      message: "delivery_type must be 'in_spa' or 'home_service'.",
    });
  }

  if (input.order.payment_preference && input.order.payment_preference !== "pay_at_spa") {
    errors.push({
      field: "order.payment_preference",
      message: "Only 'pay_at_spa' is supported in this stabilization pass.",
    });
  }

  if (!input.attendees || input.attendees.length === 0) {
    errors.push({
      field: "attendees",
      message: "At least one attendee is required.",
    });
  }

  const attendeeSequences = new Set<number>();
  for (let i = 0; i < input.attendees.length; i++) {
    const att = input.attendees[i]!;
    if (att.sequence < 1) {
      errors.push({
        field: `attendees[${i}].sequence`,
        message: "Sequence must be >= 1.",
      });
    }
    if (attendeeSequences.has(att.sequence)) {
      errors.push({
        field: `attendees[${i}].sequence`,
        message: `Duplicate attendee sequence: ${att.sequence}.`,
      });
    }
    attendeeSequences.add(att.sequence);

    if (!att.display_name?.trim()) {
      errors.push({
        field: `attendees[${i}].display_name`,
        message: "Display name cannot be empty.",
      });
    }
  }

  if (!input.service_lines || input.service_lines.length === 0) {
    errors.push({
      field: "service_lines",
      message: "At least one service line is required.",
    });
  }

  for (let i = 0; i < input.service_lines.length; i++) {
    const line = input.service_lines[i]!;
    if (!attendeeSequences.has(line.attendee_sequence)) {
      errors.push({
        field: `service_lines[${i}].attendee_sequence`,
        message: `Referenced attendee sequence ${line.attendee_sequence} does not exist in attendees list.`,
      });
    }
    if (!line.service_id || !isValidUuid(line.service_id)) {
      errors.push({
        field: `service_lines[${i}].service_id`,
        message: "A valid service UUID is required.",
      });
    }
    if (!line.staff_id || !isValidUuid(line.staff_id)) {
      errors.push({
        field: `service_lines[${i}].staff_id`,
        message: "A valid assigned staff UUID is required.",
      });
    }
    if (!line.start_time || !line.end_time || line.end_time <= line.start_time) {
      errors.push({
        field: `service_lines[${i}].time`,
        message: `End time (${line.end_time}) must be after start time (${line.start_time}).`,
      });
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return { valid: true };
}

// ─── 6. POST-COMMIT NOTIFICATION DEDUPLICATION CONTRACT ──────────────────────

export interface PostCommitNotificationEvent {
  orderId: string;
  orderNumber: string;
  bookingIds: string[];
  organizerCustomerPhone: string;
  organizerCustomerEmail?: string | null;
  deliveryType: DeliveryType;
  bookingDate: string;
  shouldNotifyCustomer: boolean;
  shouldNotifyCrm: boolean;
}

export function buildPostCommitNotificationTask(params: {
  rpcResult: Extract<CreateBookingOrderAtomicResult, { ok: true }>;
  organizerPhone: string;
  organizerEmail?: string | null;
  deliveryType: DeliveryType;
  bookingDate: string;
}): PostCommitNotificationEvent | null {
  if (params.rpcResult.idempotency_status === "replayed") {
    return null;
  }

  return {
    orderId: params.rpcResult.order_id,
    orderNumber: params.rpcResult.order_number,
    bookingIds: params.rpcResult.service_line_ids,
    organizerCustomerPhone: params.organizerPhone,
    organizerCustomerEmail: params.organizerEmail,
    deliveryType: params.deliveryType,
    bookingDate: params.bookingDate,
    shouldNotifyCustomer: true,
    shouldNotifyCrm: true,
  };
}

// ─── 7. ISOLATED TRANSACTION SIMULATOR FOR TEST VERIFICATION ─────────────────

export class BookingOrderTransactionSimulator {
  private orders = new Map<string, BookingOrderRecord>();
  private ordersByIdempotency = new Map<string, string>();
  private attendees = new Map<string, BookingAttendeeRecord>();
  private bookings = new Map<string, BookingServiceLineRecord>();

  private branches = new Set<string>();
  private customers = new Set<string>();
  private services = new Set<string>();
  private staff = new Set<string>();

  registerBranch(id: string) {
    this.branches.add(id);
  }
  registerCustomer(id: string) {
    this.customers.add(id);
  }
  registerService(id: string) {
    this.services.add(id);
  }
  registerStaff(id: string) {
    this.staff.add(id);
  }

  seedLegacyBooking(row: BookingServiceLineRecord) {
    this.bookings.set(row.id, row);
  }

  getBooking(id: string): BookingServiceLineRecord | undefined {
    return this.bookings.get(id);
  }

  getOrder(id: string): BookingOrderRecord | undefined {
    return this.orders.get(id);
  }

  getAttendeesForOrder(orderId: string): BookingAttendeeRecord[] {
    return Array.from(this.attendees.values()).filter((a) => a.booking_order_id === orderId);
  }

  getServiceLinesForOrder(orderId: string): BookingServiceLineRecord[] {
    return Array.from(this.bookings.values()).filter((b) => b.order_id === orderId);
  }

  updateBookingStatus(bookingId: string, newStatus: string) {
    const booking = this.bookings.get(bookingId);
    if (booking) {
      booking.status = newStatus;
    }
  }

  getDerivedOrderStatus(orderId: string): DerivedBookingOrderStatus {
    const lines = this.getServiceLinesForOrder(orderId);
    return deriveBookingOrderStatus(lines.map((l) => l.status));
  }

  /**
   * Simulates executing the atomic PostgreSQL RPC create_booking_order_atomic.
   */
  async executeAtomic(
    input: CreateBookingOrderAtomicInput
  ): Promise<CreateBookingOrderAtomicResult> {
    const validation = validateAtomicOrderInput(input);
    if (!validation.valid) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: validation.errors[0]?.message ?? "Invalid payload",
        detail: JSON.stringify(validation.errors),
      };
    }

    const computedPayloadHash = computeCanonicalPayloadDigest({
      order: input.order,
      attendees: input.attendees,
      service_lines: input.service_lines,
    });

    // Check existing idempotency key
    const existingOrderId = this.ordersByIdempotency.get(input.idempotency_key);
    if (existingOrderId) {
      const existingOrder = this.orders.get(existingOrderId);
      if (!existingOrder) {
        throw new Error("Corrupted simulator state: order missing for key");
      }

      // Check for payload conflict
      if (existingOrder.payload_hash !== computedPayloadHash) {
        return {
          ok: false,
          code: "IDEMPOTENCY_CONFLICT",
          message: "The idempotency key has already been used with a different payload.",
        };
      }

      // Return replayed result
      const lineIds = Array.from(this.bookings.values())
        .filter((b) => b.order_id === existingOrderId)
        .sort((a, b) => (a.line_sequence ?? 1) - (b.line_sequence ?? 1))
        .map((b) => b.id);

      const attIds = Array.from(this.attendees.values())
        .filter((a) => a.booking_order_id === existingOrderId)
        .sort((a, b) => a.sequence - b.sequence)
        .map((a) => a.id);

      const derivedStatus = this.getDerivedOrderStatus(existingOrder.id);

      return {
        ok: true,
        idempotency_status: "replayed",
        order_id: existingOrder.id,
        order_number: existingOrder.order_number,
        status: derivedStatus,
        service_line_ids: lineIds,
        attendee_ids: attIds,
      };
    }

    // Foreign key validations
    if (!this.branches.has(input.order.branch_id)) {
      return {
        ok: false,
        code: "BRANCH_NOT_FOUND",
        message: "Referenced branch does not exist.",
      };
    }
    if (!this.customers.has(input.order.organizer_customer_id)) {
      return {
        ok: false,
        code: "CUSTOMER_NOT_FOUND",
        message: "Referenced customer does not exist.",
      };
    }

    // Random order_number generation with collision avoidance loop (up to 20 attempts)
    let orderNumber: string | null = null;
    for (let attempt = 1; attempt <= 20; attempt++) {
      const candidate = generateOrderNumber(input.order.booking_date);
      const collision = Array.from(this.orders.values()).some((o) => o.order_number === candidate);
      if (!collision) {
        orderNumber = candidate;
        break;
      }
    }

    if (!orderNumber) {
      return {
        ok: false,
        code: "ORDER_NUMBER_GENERATION_FAILED",
        message: "Collision threshold reached while generating order number.",
      };
    }

    const stageOrderId = crypto.randomUUID();
    const stageOrder: BookingOrderRecord = {
      id: stageOrderId,
      order_number: orderNumber,
      branch_id: input.order.branch_id,
      organizer_customer_id: input.order.organizer_customer_id,
      delivery_type: input.order.delivery_type,
      booking_date: input.order.booking_date,
      currency: input.order.currency ?? "PHP",
      payment_preference: "pay_at_spa",
      idempotency_key: input.idempotency_key,
      payload_hash: computedPayloadHash,
      metadata: input.order.metadata ?? {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const stageAttendees: BookingAttendeeRecord[] = [];
    const attendeeSequenceToId = new Map<number, string>();

    for (const att of input.attendees) {
      const attId = crypto.randomUUID();
      stageAttendees.push({
        id: attId,
        booking_order_id: stageOrderId,
        sequence: att.sequence,
        display_name: att.display_name,
        customer_id: att.customer_id ?? null,
        notes: att.notes ?? null,
        metadata: att.metadata ?? {},
        created_at: new Date().toISOString(),
      });
      attendeeSequenceToId.set(att.sequence, attId);
    }

    const stageServiceLines: BookingServiceLineRecord[] = [];

    for (const line of input.service_lines) {
      if (!this.services.has(line.service_id)) {
        return {
          ok: false,
          code: "SERVICE_NOT_FOUND",
          message: `Service ${line.service_id} does not exist.`,
        };
      }
      if (!this.staff.has(line.staff_id)) {
        return {
          ok: false,
          code: "STAFF_NOT_FOUND",
          message: `Staff ${line.staff_id} does not exist.`,
        };
      }

      // Check staff schedule conflict
      const hasConflict = Array.from(this.bookings.values()).some((b) => {
        if (b.staff_id !== line.staff_id) return false;
        if (b.booking_date !== input.order.booking_date) return false;
        if (!["pending", "confirmed", "in_progress"].includes(b.status)) return false;
        return line.start_time < b.end_time && line.end_time > b.start_time;
      });

      if (hasConflict) {
        return {
          ok: false,
          code: "BOOKING_STAFF_TIME_CONFLICT",
          message: "The assigned therapist is already booked for this slot.",
        };
      }

      const attendeeId = attendeeSequenceToId.get(line.attendee_sequence);
      if (!attendeeId) {
        return {
          ok: false,
          code: "ATTENDEE_SEQUENCE_UNRESOLVED",
          message: `Could not resolve attendee sequence ${line.attendee_sequence}`,
        };
      }

      const lineId = crypto.randomUUID();
      stageServiceLines.push({
        id: lineId,
        order_id: stageOrderId,
        attendee_id: attendeeId,
        line_sequence: line.line_sequence,
        branch_id: input.order.branch_id,
        service_id: line.service_id,
        staff_id: line.staff_id,
        // bookings.customer_id ALWAYS points to organizer_customer_id
        customer_id: input.order.organizer_customer_id,
        booking_date: input.order.booking_date,
        start_time: line.start_time,
        end_time: line.end_time,
        type: "online",
        delivery_type: input.order.delivery_type,
        status: "confirmed",
        payment_method: "pay_on_site",
        payment_status: "unpaid",
        amount_paid: 0,
        travel_buffer_mins: line.travel_buffer_mins ?? null,
        metadata: {
          ...line.metadata,
          order_id: stageOrderId,
          order_number: orderNumber,
          attendee_id: attendeeId,
        },
        created_at: new Date().toISOString(),
      });
    }

    // COMMIT ATOMIC STAGE
    this.orders.set(stageOrderId, stageOrder);
    this.ordersByIdempotency.set(input.idempotency_key, stageOrderId);

    for (const att of stageAttendees) {
      this.attendees.set(att.id, att);
    }
    for (const line of stageServiceLines) {
      this.bookings.set(line.id, line);
    }

    return {
      ok: true,
      idempotency_status: "created",
      order_id: stageOrderId,
      order_number: orderNumber,
      status: "confirmed",
      service_line_ids: stageServiceLines.map((l) => l.id),
      attendee_ids: stageAttendees.map((a) => a.id),
    };
  }
}
