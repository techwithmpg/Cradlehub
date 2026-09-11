import type { NextRequest } from "next/server";
import { getDispatchData } from "@/lib/queries/dispatch-queries";
import { isValidCalendarDate } from "@/lib/schedule/schedule-date";
import {
  withDesktopBookingContext,
  desktopJson,
  desktopFailure,
} from "@/lib/bookings/desktop-booking-contract";
export async function GET(request: NextRequest) {
  return withDesktopBookingContext(request, async (ctx) => {
    const date = request.nextUrl.searchParams.get("date") ?? "";
    if (!isValidCalendarDate(date))
      return desktopFailure(
        "VALIDATION_ERROR",
        "Query parameter 'date' is required and must be YYYY-MM-DD.",
        400
      );
    const branchId = ctx.me.branch_id;
    const branch = await ctx.supabase
      .from("branches")
      .select("id, name")
      .eq("id", branchId)
      .maybeSingle();
    if (branch.error) throw branch.error;
    if (!branch.data)
      return desktopFailure(
        "BRANCH_NOT_FOUND",
        "The authenticated Home Service branch is unavailable.",
        403
      );
    const data = await getDispatchData({
      branchId,
      date,
      supabase: ctx.supabase,
      throwOnError: true,
    });
    return desktopJson({
      ok: true,
      data: {
        context: { branchId, branchName: branch.data.name, date },
        summary: { ...data.stats, totalToday: data.items.length },
        items: data.items.map((item) => ({
          id: item.id,
          bookingDate: item.bookingDate,
          startTime: item.startTime,
          endTime: item.endTime,
          customerName: item.customerName,
          serviceName: item.serviceName,
          area: item.area,
          formattedAddress: item.formattedAddress,
          lat: item.lat,
          lng: item.lng,
          branchName: item.branchName,
          branchLat: item.branchLat,
          branchLng: item.branchLng,
          needsLocationReview: item.needsLocationReview,
          driverId: item.driverId,
          driverName: item.driverName,
          therapistId: item.therapistId || null,
          therapistName: item.therapistName,
          dispatchStatus: item.dispatchStatus,
          bookingStatus: item.bookingStatus,
          bookingProgressStatus: item.bookingProgressStatus,
          paymentStatus: item.paymentStatus,
          eta: item.eta ?? null,
          travelStartedAt: item.travelStartedAt,
          arrivedAt: item.arrivedAt,
          sessionStartedAt: item.sessionStartedAt,
          completedAt: item.completedAt,
          latestDriverLocation: item.currentLocation
            ? {
                ...item.currentLocation,
                staffId: item.driverId,
                source: "staff_location_snapshots",
              }
            : null,
        })),
        alerts: data.alerts.map((alert) => ({
          id: alert.id,
          bookingId: alert.bookingId,
          title: alert.title,
          description: alert.description,
          severity: alert.severity,
          timeAgo: alert.timeAgo,
        })),
        locationSemantics:
          "Latest recorded snapshot; refresh required. Continuous live updates are not guaranteed.",
      },
    });
  });
}
