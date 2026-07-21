export type WorkspaceContext = "owner" | "manager" | "crm";

export type OneOrMany<T> = T | T[] | null;

export type WorkspaceBookingRow = {
  id: string;
  branch_id?: string | null;
  booking_date: string;
  start_time: string;
  end_time?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  type: string;
  delivery_type?: string | null;
  status: string;
  booking_progress_status?: string | null;
  checked_in_at?: string | null;
  travel_started_at?: string | null;
  arrived_at?: string | null;
  session_started_at?: string | null;
  session_due_at?: string | null;
  session_duration_minutes_snapshot?: number | null;
  session_completed_at?: string | null;
  no_show_at?: string | null;
  resource_id?: string | null;
  travel_buffer_mins?: number | null;
  metadata?: Record<string, unknown> | null;
  payment_method: string;
  payment_status: string;
  payment_reference?: string | null;
  amount_paid: number;
  hold_expires_at?: string | null;
  branches?: OneOrMany<{ id?: string; name: string }>;
  services?: OneOrMany<{
    id?: string;
    name: string;
    duration_minutes?: number;
    metadata?: Record<string, unknown> | null;
  }>;
  staff?: OneOrMany<{
    id?: string;
    full_name: string;
    nickname?: string | null;
    tier?: string;
  }>;
  customers?: OneOrMany<{
    id?: string;
    full_name: string;
    phone?: string | null;
    email?: string | null;
  }>;
  branch_resources?: OneOrMany<{
    id?: string;
    name: string;
    type?: string | null;
    capacity?: number | null;
  }>;
};

export type Branch = { id: string; name: string };

export type BookingActionFn = (
  input: unknown
) => Promise<{ success: boolean; error?: string }>;
