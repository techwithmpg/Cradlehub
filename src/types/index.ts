export type {
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  SlotUnavailableError,
} from "./errors";

export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_TYPES = ["online", "walkin", "home_service"] as const;
export type BookingType = (typeof BOOKING_TYPES)[number];

export const SYSTEM_ROLES = [
  "owner",
  "manager",
  "assistant_manager",
  "store_manager",
  "crm",
  "csr",
  "csr_head",
  "csr_staff",
  "staff",
] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number];

export const STAFF_TIERS = ["senior", "mid", "junior"] as const;
export type StaffTier = (typeof STAFF_TIERS)[number];

export type AvailabilitySlot = {
  staff_id: string;
  staff_name: string;
  staff_tier: StaffTier;
  slot_time: string;
  available: boolean;
};
