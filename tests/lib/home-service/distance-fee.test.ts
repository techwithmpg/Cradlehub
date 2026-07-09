import { describe, expect, it } from "vitest";

import {
  HomeServiceDistanceError,
  calculateExtraDistanceKm,
  calculateHomeServiceTravelFee,
  formatDistanceKm,
  haversineDistanceKm,
} from "@/lib/home-service/distance-fee";

describe("home service distance fee", () => {
  it.each([
    [0, 0],
    [4.9, 0],
    [5, 0],
    [5.1, 1],
    [6, 1],
    [6.1, 2],
  ])("charges %s km as %s extra km after the free allowance", (distanceKm, extraKm) => {
    expect(calculateExtraDistanceKm(distanceKm, 5)).toBe(extraKm);
  });

  it.each([
    [0, 0],
    [4.9, 0],
    [5, 0],
    [5.1, 100],
    [6, 100],
    [6.1, 200],
  ])("charges PHP %s for %.1f km", (distanceKm, fee) => {
    expect(calculateHomeServiceTravelFee(distanceKm, 5, 100)).toBe(fee);
  });

  it("rejects invalid distance inputs with a typed error", () => {
    expect(() => calculateHomeServiceTravelFee(Number.NaN, 5, 100)).toThrow(
      HomeServiceDistanceError
    );
    expect(() => calculateHomeServiceTravelFee(-1, 5, 100)).toThrow(
      HomeServiceDistanceError
    );
    expect(() => calculateHomeServiceTravelFee(6, 5, -100)).toThrow(
      HomeServiceDistanceError
    );
  });

  it("formats and calculates distances without mutating coordinates", () => {
    expect(formatDistanceKm(6.14)).toBe("6.1 km");
    expect(
      haversineDistanceKm(
        { lat: 10.676, lng: 122.951 },
        { lat: 10.676, lng: 122.951 }
      )
    ).toBe(0);
  });
});
