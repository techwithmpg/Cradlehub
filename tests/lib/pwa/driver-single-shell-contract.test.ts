import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path:string) => readFileSync(path,"utf8");
describe("Driver navigation stays within installed Staff PWA", () => {
  const detail = read("src/components/features/staff-pwa/driver/driver-native-detail.tsx");
  const combined = read("src/components/features/staff-pwa/driver/driver-combined-dispatch-map.tsx");
  const legacyStart = read("src/components/features/staff-portal/driver/map/driver-start-travel-button.tsx");
  const legacyDetail = read("src/components/features/staff-portal/driver/driver-job-details-page.tsx");
  it("starts travel only after authorized server progress and stays on the PWA route", () => {
    expect(detail).toContain("await updateBookingProgressAction");
    expect(detail).toContain("router.push(inAppRoute)");
    expect(detail).not.toContain("window.location.assign");
    expect(legacyStart).toContain("/staff/driver/map?bookingId=");
    expect(legacyStart).not.toContain("window.location.assign");
    expect(legacyDetail).not.toContain("window.location.assign");
  });
  it("has one in-app route with Start travel and Mark arrived and no external map buttons", () => {
    expect(combined).toContain("getNextDriverAction");
    expect(combined).toContain("advanceTrip");
    expect(combined).toContain("recordAssignedDriverLiveLocationAction");
    expect(combined).not.toContain("https://www.google.com/maps/dir");
    expect(combined).not.toContain("target=\"_blank\"");
  });
  it("offers browser notifications only after an explicit driver button tap", () => {
    const alert = read("src/components/features/staff-pwa/driver/driver-trip-alerts.tsx");
    expect(alert).toContain("Notification.requestPermission()");
    expect(alert).toContain("Enable trip alerts");
    expect(alert).toContain("getDriverTripAlertAction()");
  });
});
