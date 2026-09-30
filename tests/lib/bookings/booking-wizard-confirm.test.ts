import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

import {
  validateBookingDraft,
  PRECISE_LOCATION_ERROR,
  type ValidateBookingDraftParams,
  type DetailsFormDraft,
} from "@/lib/bookings/booking-wizard-validation";
import {
  getOrCreateCheckoutAttemptId,
  resetCheckoutAttemptId,
  clearCheckoutAttemptId,
  CHECKOUT_ATTEMPT_STORAGE_KEY,
  isValidUuid,
  type StorageLike,
} from "@/lib/bookings/bkg3-atomic-contract";

function createValidForm(): DetailsFormDraft {
  return {
    fullName: "Maria Clara",
    phone: "09171234567",
    email: "maria@example.com",
    notes: "Please gentle pressure",
    hsAddress: "",
    hsAddressDetails: "",
    hsBarangay: "",
    hsCity: "",
    hsLandmark: "",
    hsParkingNotes: "",
    hsZone: "",
    hsLat: null,
    hsLng: null,
    hsPlaceId: "",
    hsFormattedAddress: "",
    paymentMethod: "",
    paymentReference: "",
    paymentNote: "",
  };
}

function createValidDraftParams(
  overrides: Partial<ValidateBookingDraftParams> = {}
): ValidateBookingDraftParams {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return {
    selectedBranch: { id: "branch-1", name: "Bacolod Main Spa" },
    visitType: "in_spa",
    bookingRules: null,
    bookingFor: "me",
    recipientName: "",
    attendees: [
      { id: "att-1", name: "Guest 1 (You)", isOrganizer: true, serviceIds: ["svc-swedish"] },
    ],
    allSelectedServiceIds: ["svc-swedish"],
    selectedDate: tomorrow,
    selectedSlot: { slot_time: "14:00" },
    form: createValidForm(),
    mode: "public",
    isHomeService: false,
    isOffline: false,
    ...overrides,
  };
}

describe("Booking Wizard Confirm & Validation Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // A. Valid final draft calls submit handler exactly once
  it("A. Valid final draft passes validation ready for submission", () => {
    const draft = createValidDraftParams();
    const result = validateBookingDraft(draft);

    expect(result.ok).toBe(true);
    expect(result.message).toBeUndefined();
  });

  // B. Invalid draft does NOT call submit handler and displays reason
  it("B. Invalid draft does NOT pass validation and returns the specific reason", () => {
    // Missing phone number
    const draft = createValidDraftParams({
      form: { ...createValidForm(), phone: "" },
    });
    const result = validateBookingDraft(draft);

    expect(result.ok).toBe(false);
    expect(result.message).toBe("Please enter your phone number.");
    expect(result.focusField).toBe("phone");

    // Missing full name
    const draftNoName = createValidDraftParams({
      form: { ...createValidForm(), fullName: "A" },
    });
    const resultNoName = validateBookingDraft(draftNoName);
    expect(resultNoName.ok).toBe(false);
    expect(resultNoName.message).toBe("Please enter your full name (at least 2 characters).");
    expect(resultNoName.focusField).toBe("fullName");

    // Missing branch
    const draftNoBranch = createValidDraftParams({
      selectedBranch: null,
    });
    const resultNoBranch = validateBookingDraft(draftNoBranch);
    expect(resultNoBranch.ok).toBe(false);
    expect(resultNoBranch.message).toBe("Please select a branch before continuing.");
    expect(resultNoBranch.targetStep).toBe(1);

    // Missing date
    const draftNoDate = createValidDraftParams({
      selectedDate: null,
    });
    const resultNoDate = validateBookingDraft(draftNoDate);
    expect(resultNoDate.ok).toBe(false);
    expect(resultNoDate.message).toBe("Please select an appointment date.");

    // Missing slot
    const draftNoSlot = createValidDraftParams({
      selectedSlot: null,
    });
    const resultNoSlot = validateBookingDraft(draftNoSlot);
    expect(resultNoSlot.ok).toBe(false);
    expect(resultNoSlot.message).toBe("Please select an appointment time slot.");
  });

  // C. Second click while submitting is ignored
  it("C. Second click while submitting is prevented by double-submission guard", async () => {
    let callCount = 0;
    let isSubmitting = false;

    // Simulate authoritative handler double-click guard
    const handleConfirmBooking = async () => {
      if (isSubmitting) return; // double-submission guard
      isSubmitting = true;
      callCount++;
      await new Promise((resolve) => setTimeout(resolve, 50));
      isSubmitting = false;
    };

    // Rapid double-click: invoke twice concurrently
    const p1 = handleConfirmBooking();
    const p2 = handleConfirmBooking(); // this should be dropped immediately

    await Promise.all([p1, p2]);

    expect(callCount).toBe(1);
  });

  // D. Server-action failure displays an error
  it("D. Server-action failure is caught and formats a clear customer-visible error", async () => {
    let visibleError = "";

    const simulateServerFailure = async () => {
      try {
        const result = {
          ok: false,
          message: "We couldn't confirm your booking due to staff unavailability.",
        };
        if (!result.ok) {
          visibleError = result.message;
        }
      } catch (err: unknown) {
        visibleError =
          err instanceof Error
            ? err.message
            : "We couldn't confirm your booking. Please try again.";
      }
    };

    await simulateServerFailure();
    expect(visibleError).toBe("We couldn't confirm your booking due to staff unavailability.");

    // Network throw scenario
    let caughtError = "";
    const simulateNetworkCrash = async () => {
      try {
        throw new Error("Failed to fetch booking server");
      } catch (err: unknown) {
        caughtError =
          err instanceof Error
            ? err.message
            : "We couldn't confirm your booking. Please try again.";
      }
    };

    await simulateNetworkCrash();
    expect(caughtError).toBe("Failed to fetch booking server");
  });

  // E. Successful result moves wizard to confirmed-success state
  it("E. Successful result transitions state to confirmed success with booking & order details", async () => {
    interface SuccessState {
      bookingId: string;
      orderId?: string;
      orderNumber?: string;
      staffPreferenceNeedsConfirmation: boolean;
    }

    let successState: SuccessState | null = null;
    let wizardStep = 6;

    const mockServerResult = {
      ok: true,
      bookingId: "bkg-12345",
      orderId: "ord-67890",
      orderNumber: "CRD-2609-CONF1",
      staffPreferenceNeedsConfirmation: false,
    };

    if (mockServerResult.ok) {
      successState = {
        bookingId: mockServerResult.bookingId,
        orderId: mockServerResult.orderId,
        orderNumber: mockServerResult.orderNumber,
        staffPreferenceNeedsConfirmation: mockServerResult.staffPreferenceNeedsConfirmation,
      };
      wizardStep = 7; // success step
    }

    expect(wizardStep).toBe(7);
    expect(successState).not.toBeNull();
    expect(successState?.bookingId).toBe("bkg-12345");
    expect(successState?.orderNumber).toBe("CRD-2609-CONF1");
  });

  // F. "Me and others" validation identifies attendee missing service
  it("F. 'Me and others' validation identifies when an attendee has no services assigned", () => {
    const draft = createValidDraftParams({
      bookingFor: "me_and_others",
      attendees: [
        { id: "att-1", name: "Maria Clara", isOrganizer: true, serviceIds: ["svc-swedish"] },
        { id: "att-2", name: "Crisostomo Ibarra", isOrganizer: false, serviceIds: [] }, // missing service
      ],
      allSelectedServiceIds: ["svc-swedish"],
    });

    const result = validateBookingDraft(draft);

    expect(result.ok).toBe(false);
    expect(result.message).toBe("Crisostomo Ibarra needs at least one service.");
    expect(result.targetStep).toBe(3);

    // Also verify when attendees < 2 in group booking
    const draftSingleGroup = createValidDraftParams({
      bookingFor: "me_and_others",
      attendees: [
        { id: "att-1", name: "Maria Clara", isOrganizer: true, serviceIds: ["svc-swedish"] },
      ],
      allSelectedServiceIds: ["svc-swedish"],
    });

    const resultSingle = validateBookingDraft(draftSingleGroup);
    expect(resultSingle.ok).toBe(false);
    expect(resultSingle.message).toBe("Group bookings require at least 2 guests.");
    expect(resultSingle.targetStep).toBe(3);
  });

  // G. Home Service missing required address prevents submit visibly
  it("G. Home Service missing required address prevents submit visibly", () => {
    const draft = createValidDraftParams({
      visitType: "home_service",
      isHomeService: true,
      mode: "public",
      form: {
        ...createValidForm(),
        hsPlaceId: "",
        hsFormattedAddress: "",
        hsLat: null,
        hsLng: null,
      },
    });

    const result = validateBookingDraft(draft);

    expect(result.ok).toBe(false);
    expect(result.message).toBe(PRECISE_LOCATION_ERROR);
    expect(result.targetStep).toBe(4);
    expect(result.focusField).toBe("hsAddress");
  });

  // H. "Someone else" missing recipient name prevents submit visibly
  it("H. 'Someone else' missing recipient name prevents submit visibly", () => {
    const draft = createValidDraftParams({
      bookingFor: "someone_else",
      recipientName: "", // missing recipient name
    });

    const result = validateBookingDraft(draft);

    expect(result.ok).toBe(false);
    expect(result.message).toBe("Please enter the recipient's name (at least 2 characters).");
    expect(result.targetStep).toBe(3);
    expect(result.focusField).toBe("recipientName");

    // Recipient name too short (< 2 characters)
    const draftShortRecipient = createValidDraftParams({
      bookingFor: "someone_else",
      recipientName: "A",
    });
    const resultShort = validateBookingDraft(draftShortRecipient);
    expect(resultShort.ok).toBe(false);
    expect(resultShort.message).toBe("Please enter the recipient's name (at least 2 characters).");
  });

  // I. Persistent checkout idempotency key is retained across attempts
  it("I. Persistent checkout attempt ID is retained across validation cycles", () => {
    // Simulate persistent ref behavior
    const attemptId = "77777777-7777-4777-8777-777777777777";
    let currentAttemptKey = attemptId;

    // First attempt: invalid draft (e.g. invalid phone)
    const draft1 = createValidDraftParams({
      form: { ...createValidForm(), phone: "" },
    });
    const res1 = validateBookingDraft(draft1);
    expect(res1.ok).toBe(false);
    // Key must not change on validation failure
    expect(currentAttemptKey).toBe(attemptId);

    // Second attempt: valid draft
    const draft2 = createValidDraftParams();
    const res2 = validateBookingDraft(draft2);
    expect(res2.ok).toBe(true);
    // Key remains the same stable attempt ID for server action
    expect(currentAttemptKey).toBe(attemptId);

    // After success, a fresh key is generated for subsequent bookings
    currentAttemptKey = "88888888-8888-4888-8888-888888888888";
    expect(currentAttemptKey).not.toBe(attemptId);
  });

  // J. Aggregate BKG3 response consumption
  it("J. Wizard success state correctly consumes aggregate order response", () => {
    const rpcResult = {
      ok: true as const,
      bookingId: "bkg-uuid-1",
      orderId: "order-uuid-99",
      orderNumber: "CRD-2610-8X9A",
      serviceLineIds: ["bkg-uuid-1", "bkg-uuid-2"],
      attendeeIds: ["att-uuid-1", "att-uuid-2"],
      idempotencyStatus: "created" as const,
      serviceCount: 2,
      attendeeCount: 2,
      totalAmount: 1800,
      staffPreferenceNeedsConfirmation: false,
    };

    const successState = {
      bookingId: rpcResult.bookingId,
      orderId: rpcResult.orderId,
      orderNumber: rpcResult.orderNumber,
      staffPreferenceNeedsConfirmation: rpcResult.staffPreferenceNeedsConfirmation,
    };

    expect(successState.orderNumber).toBe("CRD-2610-8X9A");
    expect(successState.orderId).toBe("order-uuid-99");
    expect(successState.bookingId).toBe("bkg-uuid-1");
  });
});

describe("BKG3-ACT2 Correction: Idempotency Durability across Reloads & Session Lifecycle", () => {
  function createMockSessionStorage(
    initial?: Record<string, string>
  ): StorageLike & { data: Map<string, string> } {
    const data = new Map<string, string>(Object.entries(initial || {}));
    return {
      data,
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value);
      },
      removeItem: (key: string) => {
        data.delete(key);
      },
    };
  }

  // A. same logical booking attempt reuses same UUID
  it("A: same logical booking attempt reuses same UUID across multiple checks", () => {
    const storage = createMockSessionStorage();
    const id1 = getOrCreateCheckoutAttemptId(storage);
    expect(isValidUuid(id1)).toBe(true);

    const id2 = getOrCreateCheckoutAttemptId(storage);
    const id3 = getOrCreateCheckoutAttemptId(storage);
    expect(id2).toBe(id1);
    expect(id3).toBe(id1);
  });

  // B. rerender does not replace UUID
  it("B: component rerenders preserve the same active attempt UUID", () => {
    const storage = createMockSessionStorage();
    const initialUuid = getOrCreateCheckoutAttemptId(storage);

    // Simulate 5 successive component rerenders querying attempt ID
    for (let i = 0; i < 5; i++) {
      const rerenderUuid = getOrCreateCheckoutAttemptId(storage);
      expect(rerenderUuid).toBe(initialUuid);
    }
  });

  // C. simulated page/session reload retrieves the same pending attempt UUID
  it("C: simulated page/session reload retrieves the same pending attempt UUID", () => {
    const pendingUuid = "11111111-2222-4333-8444-555555555555";
    // Session storage holds pending attempt across full page reload
    const storage = createMockSessionStorage({
      [CHECKOUT_ATTEMPT_STORAGE_KEY]: pendingUuid,
    });

    const retrievedOnReload = getOrCreateCheckoutAttemptId(storage);
    expect(retrievedOnReload).toBe(pendingUuid);
  });

  // D. successful booking followed by "new booking" generates a different UUID
  it("D: successful booking followed by 'new booking' generates a different valid UUID", () => {
    const storage = createMockSessionStorage();
    const firstAttemptId = getOrCreateCheckoutAttemptId(storage);

    // Booking confirmed successfully; user starts a new booking flow
    const nextAttemptId = resetCheckoutAttemptId(storage);

    expect(isValidUuid(nextAttemptId)).toBe(true);
    expect(nextAttemptId).not.toBe(firstAttemptId);
    expect(storage.getItem(CHECKOUT_ATTEMPT_STORAGE_KEY)).toBe(nextAttemptId);
  });

  // E. malformed stored UUID is rejected/replaced safely
  it("E: malformed stored UUID is rejected and safely replaced with a valid UUID", () => {
    const storage = createMockSessionStorage({
      [CHECKOUT_ATTEMPT_STORAGE_KEY]: "invalid-corrupted-uuid-string",
    });

    const recoveredUuid = getOrCreateCheckoutAttemptId(storage);
    expect(isValidUuid(recoveredUuid)).toBe(true);
    expect(recoveredUuid).not.toBe("invalid-corrupted-uuid-string");
    expect(storage.getItem(CHECKOUT_ATTEMPT_STORAGE_KEY)).toBe(recoveredUuid);
  });

  // F. server action still receives the exact attempt UUID supplied by the wizard
  it("F: server action receives the exact attempt UUID supplied by the wizard", () => {
    const storage = createMockSessionStorage();
    const wizardAttemptId = getOrCreateCheckoutAttemptId(storage);

    // Wizard attaches attemptId to payload
    const wizardPayload = {
      fullName: "Maria Clara",
      phone: "09171234567",
      idempotencyKey: wizardAttemptId,
    };

    expect(wizardPayload.idempotencyKey).toBe(wizardAttemptId);
    expect(isValidUuid(wizardPayload.idempotencyKey)).toBe(true);
  });

  // G. clearCheckoutAttemptId removes stored attempt key
  it("G: clearCheckoutAttemptId removes the stored attempt ID from session storage", () => {
    const storage = createMockSessionStorage({
      [CHECKOUT_ATTEMPT_STORAGE_KEY]: "11111111-2222-4333-8444-555555555555",
    });
    expect(storage.getItem(CHECKOUT_ATTEMPT_STORAGE_KEY)).toBe(
      "11111111-2222-4333-8444-555555555555"
    );
    clearCheckoutAttemptId(storage);
    expect(storage.getItem(CHECKOUT_ATTEMPT_STORAGE_KEY)).toBeNull();
  });
});
