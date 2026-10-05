import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createInhouseBookingMultiSchema,
  createOnlineBookingMultiSchema,
} from "@/lib/validations/booking";
import { resolveBookingHomeServiceDestination } from "@/lib/queries/dispatch-queries";
import { withRescheduleMetadata } from "@/lib/bookings/crm-booking-operations";

const ID = "550e8400-e29b-41d4-a716-446655440000";
const preciseLocation = {
  homeServiceAddress: "123 Sample Street, Bacolod City",
  homeServicePlaceId: "google-place-1",
  homeServiceFormattedAddress: "123 Sample Street, Bacolod City",
  homeServiceLat: 10.67,
  homeServiceLng: 122.95,
};

describe("Home Service destination contract", () => {
  it("requires a selected place for CRM and online Home Service, including deliveryType-only requests", () => {
    const crm = {
      serviceIds: [ID],
      date: "2026-10-06",
      startTime: "21:00",
      fullName: "Sample Guest",
      phone: "09171234567",
      deliveryType: "home_service" as const,
    };
    const online = { ...crm, branchId: ID, date: "2026-10-20" };

    expect(createInhouseBookingMultiSchema.safeParse(crm).success).toBe(false);
    expect(createOnlineBookingMultiSchema.safeParse(online).success).toBe(false);
    expect(createInhouseBookingMultiSchema.safeParse({ ...crm, ...preciseLocation }).success).toBe(
      true
    );
    expect(
      createOnlineBookingMultiSchema.safeParse({ ...online, ...preciseLocation }).success
    ).toBe(true);
    expect(
      createInhouseBookingMultiSchema.safeParse({ ...crm, ...preciseLocation, homeServiceLat: 999 })
        .success
    ).toBe(false);
  });

  it("does not require a customer destination for in-spa bookings", () => {
    const crm = {
      serviceIds: [ID],
      date: "2026-10-06",
      startTime: "21:00",
      fullName: "Sample Guest",
      phone: "09171234567",
      deliveryType: "in_spa" as const,
    };
    const online = { ...crm, branchId: ID, date: "2026-10-20" };
    expect(createInhouseBookingMultiSchema.safeParse(crm).success).toBe(true);
    expect(createOnlineBookingMultiSchema.safeParse(online).success).toBe(true);
  });

  it("uses the booking service-line address despite an unknown optional zone or stale review flag", () => {
    const destination = resolveBookingHomeServiceDestination({
      home_service_address: {
        full_address: preciseLocation.homeServiceAddress,
        zone: "unknown",
        city: "Bacolod City",
        lat: preciseLocation.homeServiceLat,
        lng: preciseLocation.homeServiceLng,
      },
      dispatch: { needs_location_review: true },
    });
    expect(destination).toEqual({
      area: "Bacolod City",
      formattedAddress: preciseLocation.homeServiceAddress,
      lat: preciseLocation.homeServiceLat,
      lng: preciseLocation.homeServiceLng,
      needsLocationReview: false,
    });
    expect(
      resolveBookingHomeServiceDestination({ home_service_address: { zone: "unknown" } })
        .needsLocationReview
    ).toBe(true);
  });

  it("replaces stale coordinates on correction and clears the old live ETA without changing the booked fee", () => {
    const updated = withRescheduleMetadata(
      {
        home_service_address: {
          full_address: "Old destination",
          lat: 10.1,
          lng: 122.1,
          travel_fee: 300,
        },
        dispatch: { needs_location_review: true, live_eta: { eta_minutes: 12 } },
      },
      {
        actorId: ID,
        fromDate: "2026-10-06",
        fromTime: "21:00",
        toDate: "2026-10-06",
        toTime: "21:00",
        homeServiceAddress: preciseLocation.homeServiceAddress,
        homeServiceLocation: {
          formattedAddress: preciseLocation.homeServiceFormattedAddress,
          placeId: preciseLocation.homeServicePlaceId,
          lat: preciseLocation.homeServiceLat,
          lng: preciseLocation.homeServiceLng,
          mapUrl: "https://maps.google.com/?q=10.67,122.95",
          addressComponents: [],
          distanceKm: 6,
          distanceSource: "google_driving",
          distanceWarning: null,
        },
      }
    ) as Record<string, Record<string, unknown>>;
    expect(updated.home_service_address).toMatchObject({
      full_address: preciseLocation.homeServiceAddress,
      lat: preciseLocation.homeServiceLat,
      lng: preciseLocation.homeServiceLng,
      travel_fee: 300,
      distance_km: 6,
      source: "google_places",
    });
    expect(updated.dispatch).toMatchObject({ needs_location_review: false, live_eta: null });
    expect(resolveBookingHomeServiceDestination(updated).needsLocationReview).toBe(false);
  });
});
