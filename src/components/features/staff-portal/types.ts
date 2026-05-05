import type { BookingProgressStatus } from "@/lib/bookings/progress";

export type StaffPortalStaff = {
  id: string;
  full_name: string;
  tier: string | null;
  system_role: string;
  staff_type: string | null;
  branch_id: string | null;
  avatar_url?: string | null;
  avatar_path?: string | null;
};

export type StaffPortalBooking = {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  type: "online" | "walkin" | "home_service";
  status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled" | "no_show";
  booking_progress_status: BookingProgressStatus;
  home_service_tracking_status: string;
  travel_buffer_mins: number | null;
  metadata: Record<string, unknown> | null;
  travel_started_at: string | null;
  arrived_at: string | null;
  session_started_at: string | null;
  completed_at: string | null;
  session_completed_at: string | null;
  checked_in_at: string | null;
  no_show_at: string | null;
  services: { id: string; name: string; duration_minutes: number } | { id: string; name: string; duration_minutes: number }[] | null;
  customers: { id: string; full_name: string } | { id: string; full_name: string }[] | null;
  branch_resources: { name: string; type: string } | null;
};
