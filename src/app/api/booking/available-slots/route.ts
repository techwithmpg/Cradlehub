import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAvailableSlotsSchema } from "@/lib/validations/booking";
import {
  getAvailableSlots,
  getAvailableSlotsMulti,
  getAvailableSlotsForOrder,
} from "@/lib/engine/availability";
import { validateBranchServiceEligibility } from "@/lib/services/service-catalog";
import { logError } from "@/lib/logger";

const uuid = z.guid("Invalid ID");
const anyDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

const multiSlotsSchema = z.object({
  branchId:   uuid,
  serviceIds: z.array(uuid).min(1).max(25),
  date:       anyDate,
  deliveryType: z.enum(["in_spa", "home_service"]).optional(),
});

const attendeeOrderSlotsSchema = z.object({
  branchId: uuid,
  date: anyDate,
  deliveryType: z.enum(["in_spa", "home_service"]).optional(),
  attendees: z.array(
    z.object({
      id: z.string().optional(),
      serviceIds: z.array(uuid).min(1).max(5),
    })
  ).min(1).max(10),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const attendeesParam = searchParams.get("attendees");
  const serviceIdsParam = searchParams.get("serviceIds");

  // ── Multi-attendee order path ───────────────────────────────────────────────
  if (attendeesParam) {
    try {
      const parsedAttendees = JSON.parse(attendeesParam);
      const raw = {
        branchId: searchParams.get("branchId") ?? undefined,
        date: searchParams.get("date") ?? undefined,
        deliveryType: searchParams.get("deliveryType") ?? undefined,
        attendees: parsedAttendees,
      };

      const parsed = attendeeOrderSlotsSchema.safeParse(raw);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid parameters", details: parsed.error.flatten() },
          { status: 400 }
        );
      }

      const deliveryType = parsed.data.deliveryType ?? "in_spa";
      const allServiceIds = Array.from(
        new Set(parsed.data.attendees.flatMap((a) => a.serviceIds))
      );

      const serviceEligibility = await validateBranchServiceEligibility({
        branchId: parsed.data.branchId,
        serviceIds: allServiceIds,
        audience: "public",
        deliveryMode: deliveryType,
        useAdminClient: true,
      });

      if (!serviceEligibility.ok) {
        return NextResponse.json(
          {
            slots: [],
            error:
              "One or more selected services are not available for this booking type.",
            reason: { code: "service_ineligible" },
          },
          { status: 400 }
        );
      }

      const slots = await getAvailableSlotsForOrder({
        branchId: parsed.data.branchId,
        attendees: parsed.data.attendees,
        date: parsed.data.date,
        deliveryMode: deliveryType,
        requireStaffServiceAssignment: true,
      });

      return NextResponse.json({ slots });
    } catch (error) {
      logError("slots.query_failed", { path: "order", error });
      const message =
        error instanceof Error ? error.message : "Failed to fetch available slots";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // ── Multi-service path ──────────────────────────────────────────────────────
  if (serviceIdsParam) {
    const raw = {
      branchId:   searchParams.get("branchId") ?? undefined,
      serviceIds: serviceIdsParam.split(",").filter(Boolean),
      date:       searchParams.get("date") ?? undefined,
      deliveryType: searchParams.get("deliveryType") ?? undefined,
    };

    const parsed = multiSlotsSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    try {
      const deliveryType = parsed.data.deliveryType ?? "in_spa";
      const serviceEligibility = await validateBranchServiceEligibility({
        branchId: parsed.data.branchId,
        serviceIds: parsed.data.serviceIds,
        audience: "public",
        deliveryMode: deliveryType,
        useAdminClient: true,
      });
      if (!serviceEligibility.ok) {
        return NextResponse.json(
          {
            slots: [],
            error:
              "One or more selected services are not available for this booking type.",
            reason: { code: "service_ineligible" },
          },
          { status: 400 }
        );
      }

      const slots = await getAvailableSlotsMulti({
        branchId: parsed.data.branchId,
        serviceIds: parsed.data.serviceIds,
        date: parsed.data.date,
        deliveryMode: deliveryType,
        requireStaffServiceAssignment: true,
      });
      return NextResponse.json({ slots });
    } catch (error) {
      logError("slots.query_failed", { path: "multi", error });
      const message = error instanceof Error ? error.message : "Failed to fetch available slots";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // ── Single-service path (backward-compatible) ───────────────────────────────
  const raw = {
    branchId:  searchParams.get("branchId")  ?? undefined,
    serviceId: searchParams.get("serviceId") ?? undefined,
    staffId:   searchParams.get("staffId")   ?? undefined,
    date:      searchParams.get("date")      ?? undefined,
  };

  const parsed = getAvailableSlotsSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid parameters", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const deliveryType =
      searchParams.get("deliveryType") === "home_service"
        ? "home_service"
        : "in_spa";
    const serviceEligibility = await validateBranchServiceEligibility({
      branchId: parsed.data.branchId,
      serviceIds: [parsed.data.serviceId],
      audience: "public",
      deliveryMode: deliveryType,
      useAdminClient: true,
    });
    if (!serviceEligibility.ok) {
      return NextResponse.json(
        {
          slots: [],
          error: "This service is not available for this booking type.",
          reason: { code: "service_ineligible" },
        },
        { status: 400 }
      );
    }

    const slots = await getAvailableSlots({
      ...parsed.data,
      deliveryMode: deliveryType,
      requireStaffServiceAssignment: true,
    });
    return NextResponse.json({ slots });
  } catch (error) {
    logError("slots.query_failed", { path: "single", error });
    const message = error instanceof Error ? error.message : "Failed to fetch available slots";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
