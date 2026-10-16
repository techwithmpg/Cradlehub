import { describe, expect, it } from "vitest";

import {
  HomeServiceDistanceError,
  calculateExtraDistanceKm,
  calculateHomeServiceTravelFee,
  calculateHomeServiceTravelFeeBreakdown,
  createHomeServiceTransportSnapshot,
  formatDistanceKm,
  haversineDistanceKm,
} from "@/lib/home-service/distance-fee";

describe("Home Service Distance Fee Calculator", () => {
  describe("Approved Default Pricing Model (Base 100, Included 1, PerKm 40)", () => {
    const defaultConfig = {
      baseFee: 100,
      includedKm: 1,
      perKmFee: 40,
    };

    const approvedTestCases: [number, number][] = [
      [0, 100],
      [0.5, 100],
      [1, 100],
      [1.25, 110],
      [1.5, 120],
      [2, 140],
      [2.5, 160],
      [3, 180],
      [4, 220],
      [5, 260],
      [6, 300],
      [8, 380],
      [10, 460],
      [15, 660],
      [20, 860],
    ];

    it.each(approvedTestCases)(
      "calculates %s km as ₱%s using object contract",
      (drivingDistanceKm, expectedFee) => {
        const fee = calculateHomeServiceTravelFee({
          drivingDistanceKm,
          ...defaultConfig,
        });
        expect(fee).toBe(expectedFee);
      }
    );

    it.each(approvedTestCases)(
      "calculates %s km as ₱%s using positional contract",
      (drivingDistanceKm, expectedFee) => {
        const fee = calculateHomeServiceTravelFee(
          drivingDistanceKm,
          defaultConfig.includedKm,
          defaultConfig.perKmFee,
          defaultConfig.baseFee
        );
        expect(fee).toBe(expectedFee);
      }
    );

    it("handles fractional rounding down correctly (2.333 km -> ₱153)", () => {
      // 100 + (2.333 - 1) * 40 = 100 + 1.333 * 40 = 100 + 53.32 = 153.32 -> 153
      const breakdown = calculateHomeServiceTravelFeeBreakdown({
        drivingDistanceKm: 2.333,
        ...defaultConfig,
      });
      expect(breakdown.billableDistanceKm).toBeCloseTo(1.333, 3);
      expect(breakdown.rawFee).toBeCloseTo(153.32, 2);
      expect(breakdown.finalFee).toBe(153);
    });

    it("handles fractional rounding up correctly (1.388 km -> ₱116)", () => {
      // 100 + (1.388 - 1) * 40 = 100 + 0.388 * 40 = 100 + 15.52 = 115.52 -> 116
      const breakdown = calculateHomeServiceTravelFeeBreakdown({
        drivingDistanceKm: 1.388,
        ...defaultConfig,
      });
      expect(breakdown.billableDistanceKm).toBeCloseTo(0.388, 3);
      expect(breakdown.rawFee).toBeCloseTo(115.52, 2);
      expect(breakdown.finalFee).toBe(116);
    });
  });

  describe("Configurability (Custom Branch Policy)", () => {
    const customConfig = {
      baseFee: 120,
      includedKm: 2,
      perKmFee: 35,
    };

    it("calculates 1 km as ₱120 (within included distance)", () => {
      expect(
        calculateHomeServiceTravelFee({
          drivingDistanceKm: 1,
          ...customConfig,
        })
      ).toBe(120);
    });

    it("calculates 2 km as ₱120 (at included distance boundary)", () => {
      expect(
        calculateHomeServiceTravelFee({
          drivingDistanceKm: 2,
          ...customConfig,
        })
      ).toBe(120);
    });

    it("calculates 3 km as ₱155 (120 + 1 * 35)", () => {
      expect(
        calculateHomeServiceTravelFee({
          drivingDistanceKm: 3,
          ...customConfig,
        })
      ).toBe(155);
    });

    it("calculates 4.5 km as ₱208 (120 + 2.5 * 35 = 207.5 -> rounded to 208)", () => {
      const breakdown = calculateHomeServiceTravelFeeBreakdown({
        drivingDistanceKm: 4.5,
        ...customConfig,
      });
      expect(breakdown.billableDistanceKm).toBe(2.5);
      expect(breakdown.rawFee).toBe(207.5);
      expect(breakdown.finalFee).toBe(208);
    });
  });

  describe("Input Validation & Commercial Safeguards", () => {
    it("rejects negative distance", () => {
      expect(() =>
        calculateHomeServiceTravelFee({
          drivingDistanceKm: -1,
          baseFee: 100,
          includedKm: 1,
          perKmFee: 40,
        })
      ).toThrow(HomeServiceDistanceError);
    });

    it("rejects NaN distance", () => {
      expect(() =>
        calculateHomeServiceTravelFee({
          drivingDistanceKm: Number.NaN,
          baseFee: 100,
          includedKm: 1,
          perKmFee: 40,
        })
      ).toThrow(HomeServiceDistanceError);
    });

    it("rejects Infinity distance", () => {
      expect(() =>
        calculateHomeServiceTravelFee({
          drivingDistanceKm: Number.POSITIVE_INFINITY,
          baseFee: 100,
          includedKm: 1,
          perKmFee: 40,
        })
      ).toThrow(HomeServiceDistanceError);
    });

    it("rejects negative base fee", () => {
      expect(() =>
        calculateHomeServiceTravelFee({
          drivingDistanceKm: 5,
          baseFee: -10,
          includedKm: 1,
          perKmFee: 40,
        })
      ).toThrow(HomeServiceDistanceError);
    });

    it("rejects negative included distance", () => {
      expect(() =>
        calculateHomeServiceTravelFee({
          drivingDistanceKm: 5,
          baseFee: 100,
          includedKm: -1,
          perKmFee: 40,
        })
      ).toThrow(HomeServiceDistanceError);
    });

    it("rejects negative per-km fee", () => {
      expect(() =>
        calculateHomeServiceTravelFee({
          drivingDistanceKm: 5,
          baseFee: 100,
          includedKm: 1,
          perKmFee: -40,
        })
      ).toThrow(HomeServiceDistanceError);
    });
  });

  describe("Commercial Snapshot Creation", () => {
    it("creates an immutable snapshot with all required financial properties", () => {
      const snapshot = createHomeServiceTransportSnapshot({
        drivingDistanceKm: 2.5,
        baseFee: 100,
        includedKm: 1,
        perKmFee: 40,
        distanceSource: "google_routes",
      });

      expect(snapshot).toEqual({
        pricing_version: 1,
        distance_source: "google_routes",
        driving_distance_km: 2.5,
        base_fee: 100,
        included_km: 1,
        per_km_fee: 40,
        billable_distance_km: 1.5,
        raw_fee: 160,
        calculated_fee: 160,
      });
    });
  });

  describe("Non-monetary helpers", () => {
    it("calculates extra distance without rounding up", () => {
      expect(calculateExtraDistanceKm(0.8, 1)).toBe(0);
      expect(calculateExtraDistanceKm(1.5, 1)).toBe(0.5);
      expect(calculateExtraDistanceKm(3.25, 1)).toBe(2.25);
    });

    it("formats distances for display", () => {
      expect(formatDistanceKm(6.14)).toBe("6.1 km");
      expect(formatDistanceKm(0)).toBe("0.0 km");
    });

    it("calculates haversine distance for non-monetary geographic distance", () => {
      expect(
        haversineDistanceKm(
          { lat: 10.676, lng: 122.951 },
          { lat: 10.676, lng: 122.951 }
        )
      ).toBe(0);
    });
  });
});
