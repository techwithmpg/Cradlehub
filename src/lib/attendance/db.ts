import type { SupabaseClient } from "@supabase/supabase-js";

type LooseTable = {
  Row: Record<string, never>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

type LooseFunction = {
  Args: Record<string, unknown>;
  Returns: unknown;
};

type AttendanceDatabase = {
  public: {
    Tables: Record<string, LooseTable>;
    Views: Record<string, LooseTable>;
    Functions: Record<string, LooseFunction>;
  };
};

export type AttendanceDb = SupabaseClient<AttendanceDatabase>;

export function asAttendanceDb(client: unknown): AttendanceDb {
  return client as AttendanceDb;
}
