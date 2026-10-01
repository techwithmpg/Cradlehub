import { isPastSlot, BRANCH_TIMEZONE } from "@/lib/engine/slot-time";
import {
  isVisitTypeEnabled,
  isTimeAllowedForVisitType,
  getVisitTypeAvailability,
  VISIT_TYPE_OPTIONS,
  type VisitType,
  type BookingWizardMode,
} from "@/lib/bookings/visit-type-availability";
import type { BranchBookingRules } from "@/lib/bookings/booking-rules-config";
import type { BookingForChoice } from "@/lib/bookings/booking-order-contract";

export const PRECISE_LOCATION_ERROR =
  "Please select your address from the Google suggestions so our therapist and driver can find you accurately.";

export interface WizardAttendeeDraft {
  id: string;
  name: string;
  isOrganizer: boolean;
  serviceIds: string[];
}

export interface DetailsFormDraft {
  fullName: string;
  phone: string;
  email: string;
  notes: string;
  hsAddress: string;
  hsAddressDetails: string;
  hsBarangay: string;
  hsCity: string;
  hsLandmark: string;
  hsParkingNotes: string;
  hsZone: string;
  hsLat: number | null;
  hsLng: number | null;
  hsPlaceId: string;
  hsFormattedAddress: string;
  paymentMethod: string;
  paymentReference: string;
  paymentNote: string;
}

export interface BranchDraft {
  id: string;
  name: string;
  address?: string | null;
}

export interface SlotDraft {
  slot_time: string;
  available?: boolean;
}

export interface BookingDraftValidationResult {
  ok: boolean;
  message?: string;
  targetStep?: number;
  focusField?: "fullName" | "phone" | "email" | "recipientName" | "hsAddress";
}

export function isPreciseHomeServiceLocationDraft(form: {
  hsPlaceId?: string;
  hsFormattedAddress?: string;
  hsLat?: number | null;
  hsLng?: number | null;
}): boolean {
  return (
    !!form.hsPlaceId &&
    form.hsPlaceId.trim().length > 0 &&
    !!form.hsFormattedAddress &&
    form.hsFormattedAddress.trim().length >= 5 &&
    typeof form.hsLat === "number" &&
    Number.isFinite(form.hsLat) &&
    typeof form.hsLng === "number" &&
    Number.isFinite(form.hsLng)
  );
}

function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h ?? "0", 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m ?? "00"} ${ampm}`;
}

function toLocalYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface ValidateBookingDraftParams {
  selectedBranch: BranchDraft | null;
  visitType: VisitType;
  bookingRules: BranchBookingRules | null;
  bookingFor: BookingForChoice;
  recipientName: string;
  attendees: WizardAttendeeDraft[];
  allSelectedServiceIds: string[];
  selectedDate: Date | null;
  selectedSlot: SlotDraft | null;
  form: DetailsFormDraft;
  mode: BookingWizardMode;
  isHomeService: boolean;
  isOffline: boolean;
}

/**
 * Validates the full booking draft before submission.
 * Returns the exact failure reason and the target step/field if incomplete.
 * Never fails silently.
 */
export function validateBookingDraft(
  params: ValidateBookingDraftParams
): BookingDraftValidationResult {
  if (params.isOffline) {
    return {
      ok: false,
      message: "You're offline. Check your connection and try again.",
    };
  }

  // 1. Branch selection
  if (!params.selectedBranch) {
    return {
      ok: false,
      message: "Please select a branch before continuing.",
      targetStep: 1,
    };
  }

  // 2. Visit type enabled
  if (!isVisitTypeEnabled(params.visitType, params.bookingRules)) {
    const option = VISIT_TYPE_OPTIONS[params.visitType];
    return {
      ok: false,
      message: `${option.label} is not available for this branch. Please choose another visit type.`,
      targetStep: 2,
    };
  }

  // 3. Service selection
  if (!params.allSelectedServiceIds || params.allSelectedServiceIds.length === 0) {
    return {
      ok: false,
      message: "Please select at least one service before continuing.",
      targetStep: 3,
    };
  }

  if (params.bookingFor === "someone_else") {
    if (!params.recipientName || params.recipientName.trim().length < 2) {
      return {
        ok: false,
        message: "Please enter the recipient's name (at least 2 characters).",
        targetStep: 3,
        focusField: "recipientName",
      };
    }
  } else if (params.bookingFor === "me_and_others") {
    if (params.attendees.length < 2) {
      return {
        ok: false,
        message: "Group bookings require at least 2 guests.",
        targetStep: 3,
      };
    }
    for (let i = 0; i < params.attendees.length; i++) {
      const att = params.attendees[i]!;
      if (!att.serviceIds || att.serviceIds.length === 0) {
        const guestLabel = att.name?.trim() || `Guest ${i + 1}`;
        return {
          ok: false,
          message: `${guestLabel} needs at least one service.`,
          targetStep: 3,
        };
      }
    }
  }

  // 4. Home service location
  if (params.isHomeService) {
    if (params.mode === "public") {
      if (!isPreciseHomeServiceLocationDraft(params.form)) {
        return {
          ok: false,
          message: PRECISE_LOCATION_ERROR,
          targetStep: 4,
          focusField: "hsAddress",
        };
      }
    } else {
      if (
        params.form.hsAddress.trim().length < 5 ||
        (params.form.hsBarangay.trim().length < 2 && params.form.hsCity.trim().length < 2)
      ) {
        return {
          ok: false,
          message: "Please enter a valid home service address (street, barangay or city).",
          targetStep: 4,
          focusField: "hsAddress",
        };
      }
      if (!params.form.hsZone || params.form.hsZone === "unknown") {
        return {
          ok: false,
          message: "Please select a location zone before continuing.",
          targetStep: 4,
        };
      }
    }
  }

  // 5. Date selection
  if (!params.selectedDate) {
    return {
      ok: false,
      message: "Please select an appointment date.",
      targetStep: params.isHomeService ? 5 : 4,
    };
  }

  // 6. Slot selection
  if (!params.selectedSlot) {
    return {
      ok: false,
      message: "Please select an appointment time slot.",
      targetStep: params.isHomeService ? 5 : 4,
    };
  }

  if (
    !isTimeAllowedForVisitType(
      params.selectedSlot.slot_time,
      params.visitType,
      params.bookingRules
    )
  ) {
    const option = VISIT_TYPE_OPTIONS[params.visitType];
    const availability = getVisitTypeAvailability(params.visitType, params.bookingRules);
    return {
      ok: false,
      message: `${option.label} appointments are available from ${formatTime(
        availability.startTime
      )} to ${formatTime(availability.endTime)}. Please select another time.`,
      targetStep: params.isHomeService ? 5 : 4,
    };
  }

  if (
    isPastSlot({
      selectedDate: toLocalYmd(params.selectedDate),
      slotStartTime: params.selectedSlot.slot_time,
      timezone: BRANCH_TIMEZONE,
    })
  ) {
    return {
      ok: false,
      message: "This time is no longer available. Please choose another time.",
      targetStep: params.isHomeService ? 5 : 4,
    };
  }

  // 7. Contact Details
  if (!params.form.fullName || params.form.fullName.trim().length < 2) {
    return {
      ok: false,
      message: "Please enter your full name (at least 2 characters).",
      focusField: "fullName",
    };
  }

  if (!params.form.phone || params.form.phone.trim().length < 7) {
    return {
      ok: false,
      message: "Please enter your phone number.",
      focusField: "phone",
    };
  }

  if (!/^[0-9+\-\s()]+$/.test(params.form.phone.trim())) {
    return {
      ok: false,
      message: "Please enter a valid phone number using only numbers and punctuation.",
      focusField: "phone",
    };
  }

  if (params.form.email && params.form.email.trim().length > 0) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(params.form.email.trim())) {
      return {
        ok: false,
        message: "Please enter a valid email address.",
        focusField: "email",
      };
    }
  }

  // 8. In-house Payment Method
  if (
    params.mode === "inhouse" &&
    (!params.form.paymentMethod || params.form.paymentMethod.trim().length === 0)
  ) {
    return {
      ok: false,
      message: "Please select a payment method.",
    };
  }

  return { ok: true };
}
