export type ControlBooking = {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  type: string;
  travel_buffer_mins: number | null;
  payment_status?: string;
  payment_method?: string;
  amount_paid?: number;
  price_paid?: number;
  payment_reference?: string | null;
  customer_name: string | null;
  service_name: string | null;
  service_duration: number | null;
  staff_name: string | null;
  resource_name: string | null;
  booking_progress_status?: string;
  hs_zone?: string | null;
  hs_address?: string | null;
  hs_city?: string | null;
  hs_map_url?: string | null;
  dispatch_warning?: string | null;
  needs_location_review?: boolean;
  needs_staff_schedule_review?: boolean;
  staff_schedule_exception_label?: string | null;
  staff_schedule_exception_reason?: string | null;
  /** Phase 5: driver assignment */
  driver_id?: string | null;
  driver_name?: string | null;
  no_driver_warning?: boolean;
  /** Phase 6: last known location timestamp (ISO string) */
  last_location_at?: string | null;
  /** Phase 7: active customer tracking link */
  tracking_token?: string | null;
  tracking_url?: string | null;
  tracking_message?: string | null;
  /** Phase 10: destination coords for ETA calculation */
  dest_lat?: number | null;
  dest_lng?: number | null;
  /** Phase 10: live ETA stored in metadata after refresh */
  live_eta?: import("@/lib/bookings/ops-warnings").LiveEtaData | null;
};

export type ControlTab =
  | "all"
  | "active"
  | "home_service"
  | "in_spa"
  | "unpaid"
  | "issues";
