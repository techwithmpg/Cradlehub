import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

export type AttendanceDb = SupabaseClient<Database>;

export function asAttendanceDb(client: unknown): AttendanceDb {
  return client as AttendanceDb;
}
