import type { BookingType } from "@/types";

export type { BookingType } from "@/types";

export type BookingWizardMode = "public" | "inhouse";
export type VisitType = "in_spa" | "home_service";

type VisitTypeOption = {
  id: VisitType;
  label: string;
  description: string;
  availability: {
    startTime: string;
    endTime: string;
  };
};

export const VISIT_TYPE_ORDER: VisitType[] = ["in_spa", "home_service"];

export const VISIT_TYPE_OPTIONS = {
  in_spa: {
    id: "in_spa",
    label: "In-spa",
    description: "Visit the spa branch for your appointment.",
    availability: { startTime: "10:00", endTime: "22:30" },
  },
  home_service: {
    id: "home_service",
    label: "Home Service",
    description: "Book a therapist to come to your location.",
    availability: { startTime: "14:30", endTime: "22:00" },
  },
} satisfies Record<VisitType, VisitTypeOption>;

function timeToMinutes(time: string): number | null {
  const [hourRaw, minuteRaw] = time.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return hour * 60 + minute;
}

export function getBookingTypeForVisitType(
  visitType: VisitType,
  mode: "public"
): Extract<BookingType, "online" | "home_service">;
export function getBookingTypeForVisitType(
  visitType: VisitType,
  mode: "inhouse"
): Extract<BookingType, "walkin" | "home_service">;
export function getBookingTypeForVisitType(
  visitType: VisitType,
  mode: BookingWizardMode
): BookingType;
export function getBookingTypeForVisitType(
  visitType: VisitType,
  mode: BookingWizardMode
): BookingType {
  if (visitType === "home_service") return "home_service";
  return mode === "inhouse" ? "walkin" : "online";
}

export function getVisitTypeForBookingType(
  bookingType: BookingType,
  mode: BookingWizardMode
): VisitType {
  return bookingType === getBookingTypeForVisitType("home_service", mode)
    ? "home_service"
    : "in_spa";
}

export function isTimeAllowedForVisitType(
  slotTime: string,
  visitType: VisitType
): boolean {
  const slotMinutes = timeToMinutes(slotTime);
  const startMinutes = timeToMinutes(
    VISIT_TYPE_OPTIONS[visitType].availability.startTime
  );
  const endMinutes = timeToMinutes(
    VISIT_TYPE_OPTIONS[visitType].availability.endTime
  );

  if (
    slotMinutes === null ||
    startMinutes === null ||
    endMinutes === null
  ) {
    return false;
  }

  return slotMinutes >= startMinutes && slotMinutes <= endMinutes;
}

export function filterSlotsByVisitType<T extends { slot_time: string }>(
  slots: T[],
  visitType: VisitType
): T[] {
  return slots.filter((slot) =>
    isTimeAllowedForVisitType(slot.slot_time, visitType)
  );
}
