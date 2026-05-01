import type { HomeServiceTrackingStatus } from "@/lib/home-service-tracking";

export type StaffPortalStaff = {
  id: string;
  full_name: string;
  tier: string | null;
  system_role: string;
  staff_type: string | null;
  branch_id: string | null;
};

export type StaffPortalBooking = {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  type: "online" | "walkin" | "home_service";
  status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled" | "no_show";
  home_service_tracking_status: HomeServiceTrackingStatus;
  travel_buffer_mins: number | null;
  metadata: Record<string, unknown> | null;
  travel_started_at: string | null;
  arrived_at: string | null;
  session_started_at: string | null;
  completed_at: string | null;
  services: { id: string; name: string; duration_minutes: number } | { id: string; name: string; duration_minutes: number }[] | null;
  customers: { id: string; full_name: string } | { id: string; full_name: string }[] | null;
};

export type TrackingStage = "travel_started" | "arrived" | "session_started" | "completed";

export function getTrackingStage(
  booking: Pick<StaffPortalBooking, "home_service_tracking_status">
): TrackingStage | null {
  const status = booking.home_service_tracking_status;
  if (status === "not_started") return null;
  return status;
}

export function getNextTrackingStage(
  booking: Pick<StaffPortalBooking, "home_service_tracking_status">
): TrackingStage | null {
  const status = booking.home_service_tracking_status;
  if (status === "not_started") return "travel_started";
  if (status === "travel_started") return "arrived";
  if (status === "arrived") return "session_started";
  if (status === "session_started") return "completed";
  return null;
}

export function isTrackingComplete(booking: Pick<StaffPortalBooking, "home_service_tracking_status">): boolean {
  return booking.home_service_tracking_status === "completed";
}
