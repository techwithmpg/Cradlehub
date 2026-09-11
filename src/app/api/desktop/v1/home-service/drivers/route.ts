import { withDesktopBookingContext, desktopJson } from "@/lib/bookings/desktop-booking-contract";
import { getBranchStaffForScoring } from "@/lib/queries/assignment-recommendations";
/** Operational active roster. Attendance and jobs remain their existing contracts. */
export async function GET(request: Request) {
  return withDesktopBookingContext(request, async (ctx) => {
    const staff = await getBranchStaffForScoring(ctx.me.branch_id, {
      supabase: ctx.supabase,
      throwOnError: true,
    });
    const drivers = staff
      .filter((s) => s.system_role === "driver" || s.staff_type === "driver")
      .map((s) => ({
        id: s.id,
        name: s.full_name,
        systemRole: s.system_role,
        staffType: s.staff_type,
        isActive: s.is_active,
      }));
    return desktopJson({ ok: true, data: { branchId: ctx.me.branch_id, drivers } });
  });
}
