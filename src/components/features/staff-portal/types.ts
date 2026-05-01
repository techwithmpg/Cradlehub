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
  booking: Pick<StaffPortalBooking, "travel_started_at" | "arrived_at" | "session_started_at" | "completed_at">
): TrackingStage | null {
  if (booking.completed_at) return "completed";
  if (booking.session_started_at) return "session_started";
  if (booking.arrived_at) return "arrived";
  if (booking.travel_started_at) return "travel_started";
  return null;
}

export function getNextTrackingStage(
  booking: Pick<StaffPortalBooking, "travel_started_at" | "arrived_at" | "session_started_at" | "completed_at">
): TrackingStage | null {
  const current = getTrackingStage(booking);
  if (current === null) return "travel_started";
  if (current === "travel_started") return "arrived";
  if (current === "arrived") return "session_started";
  if (current === "session_started") return "completed";
  return null;
}

export function isTrackingComplete(booking: Pick<StaffPortalBooking, "completed_at">): boolean {
  return !!booking.completed_at;
}
