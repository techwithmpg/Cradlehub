export type {
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  SlotUnavailableError,
} from "./errors";

export const BOOKING_STATUSES = [
  "pending",
  "pending_payment",
  "pending_crm_confirmation",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
  "expired",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_TYPES = ["online", "walkin", "home_service"] as const;
export type BookingType = (typeof BOOKING_TYPES)[number];

export const DELIVERY_TYPES = ["in_spa", "home_service"] as const;
export type DeliveryType = (typeof DELIVERY_TYPES)[number];

export { SYSTEM_ROLES, type SystemRole } from "@/constants/staff";

export const STAFF_TIERS = ["senior", "mid", "junior", "head", "n/a"] as const;
export type StaffTier = (typeof STAFF_TIERS)[number];

export type AvailabilitySlot = {
  staff_id: string;
  staff_name: string;
  staff_tier: StaffTier;
  slot_time: string;
  available: boolean;
};
