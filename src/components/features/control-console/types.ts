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
};

export type ControlTab =
  | "all"
  | "active"
  | "home_service"
  | "in_spa"
  | "unpaid"
  | "issues";
