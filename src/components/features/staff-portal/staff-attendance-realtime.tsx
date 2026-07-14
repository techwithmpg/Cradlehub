"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function StaffAttendanceRealtime({ staffId }: { staffId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`staff-attendance-${staffId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "staff_shift_checkins", filter: `staff_id=eq.${staffId}` },
        () => router.refresh()
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router, staffId]);

  return null;
}
