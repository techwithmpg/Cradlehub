import { describe, expect, it } from "vitest";
import {
  createInhouseBookingMultiSchema,
  createWalkinBookingSchema,
} from "./booking";

const branchId = "11111111-1111-4111-8111-111111111111";
const serviceId = "22222222-2222-4222-8222-222222222222";
const staffId = "33333333-3333-4333-8333-333333333333";
const date = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const baseWalkin = {
  branchId,
  serviceIds: [serviceId],
  date,
  startTime: "14:00",
  fullName: "Walk-in Guest",
  crmBookingMode: "walkin" as const,
  type: "walkin" as const,
  deliveryType: "in_spa" as const,
};

const baseFuture = {
  branchId,
  serviceIds: [serviceId],
  date,
  startTime: "14:00",
  fullName: "Future Booked Guest",
  crmBookingMode: "standard_future" as const,
  type: "walkin" as const,
  deliveryType: "in_spa" as const,
};

const baseHomeService = {
  branchId,
  serviceIds: [serviceId],
  date,
  startTime: "14:00",
  fullName: "Home Service Client",
  crmBookingMode: "home_service" as const,
  type: "home_service" as const,
  deliveryType: "home_service" as const,
  homeServicePlaceId: "place_123",
  homeServiceFormattedAddress: "123 Main St, Davao City",
  homeServiceLat: 7.07,
  homeServiceLng: 125.6,
};

describe("walk-in vs future and home booking phone validation", () => {
  describe("createInhouseBookingMultiSchema", () => {
    it("allows walk-in booking without phone number (empty string)", () => {
      const result = createInhouseBookingMultiSchema.safeParse({
        ...baseWalkin,
        phone: "",
      });
      expect(result.success).toBe(true);
    });

    it("allows walk-in booking when phone is omitted", () => {
      const result = createInhouseBookingMultiSchema.safeParse(baseWalkin);
      expect(result.success).toBe(true);
    });

    it("allows walk-in booking with a valid phone number", () => {
      const result = createInhouseBookingMultiSchema.safeParse({
        ...baseWalkin,
        phone: "09171234567",
      });
      expect(result.success).toBe(true);
    });

    it("rejects walk-in booking with an invalid phone number if entered", () => {
      const result = createInhouseBookingMultiSchema.safeParse({
        ...baseWalkin,
        phone: "123",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path[0] === "phone")).toBe(true);
      }
    });

    it("rejects future booking without phone number", () => {
      const result = createInhouseBookingMultiSchema.safeParse({
        ...baseFuture,
        phone: "",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path[0] === "phone")).toBe(true);
      }
    });

    it("accepts future booking with valid phone number", () => {
      const result = createInhouseBookingMultiSchema.safeParse({
        ...baseFuture,
        phone: "09171234567",
      });
      expect(result.success).toBe(true);
    });

    it("rejects home service booking without phone number", () => {
      const result = createInhouseBookingMultiSchema.safeParse({
        ...baseHomeService,
        phone: "",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path[0] === "phone")).toBe(true);
      }
    });

    it("accepts home service booking with valid phone number", () => {
      const result = createInhouseBookingMultiSchema.safeParse({
        ...baseHomeService,
        phone: "09171234567",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("createWalkinBookingSchema", () => {
    it("allows walk-in without phone number", () => {
      const result = createWalkinBookingSchema.safeParse({
        serviceId,
        staffId,
        date,
        startTime: "14:00",
        fullName: "Quick Walk-in",
        phone: "",
      });
      expect(result.success).toBe(true);
    });

    it("rejects home service walk-in without phone number", () => {
      const result = createWalkinBookingSchema.safeParse({
        serviceId,
        staffId,
        date,
        startTime: "14:00",
        fullName: "Quick Home Service",
        type: "home_service",
        deliveryType: "home_service",
        phone: "",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path[0] === "phone")).toBe(true);
      }
    });
  });
});

