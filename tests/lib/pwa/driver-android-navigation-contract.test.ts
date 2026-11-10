import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");
const nativeRoot = "native/driver-android/app/src/main";
const shell = read(`${nativeRoot}/java/com/mpgtechnologies/cradlehub/driver/DriverShellActivity.java`);
const navigation = read(`${nativeRoot}/java/com/mpgtechnologies/cradlehub/driver/NativeNavigationActivity.java`);
const shellLayout = read(`${nativeRoot}/res/layout/activity_driver_shell.xml`);
const focused = read("src/components/features/staff-pwa/driver/driver-focused-trip-route.tsx");
const page = read("src/app/(dashboard)/staff/driver/map/page.tsx");

describe("Driver's one-action route integration", () => {
  it("notification taps open the specific assigned route and handle an existing activity", () => {
    expect(shell).toContain('ROUTE_PATH + "?bookingId=" + bookingId');
    expect(shell).toContain("onNewIntent(Intent intent)");
    expect(shell).toContain("validBookingId(bookingId)");
    expect(page).toContain("getDriverDispatchSnapshotAction");
    expect(page).toContain("result.snapshot.trips.find");
  });

  it("removes the competing native overlay and intercepts only the explicit in-app intent", () => {
    expect(shellLayout).not.toContain("openNativeNavigation");
    expect(shell).toContain('"nativeNavigation"');
    expect(shell).toContain('ROUTE_PATH.equals(url.getPath())');
    expect(shell).toContain("openNativeNavigation(bookingId)");
    expect(shell).not.toContain("addJavascriptInterface");
  });

  it("navigates after the existing server-confirmed Start Trip, not directly from a push", () => {
    const call = focused.indexOf("await updateBookingProgressAction({");
    const check = focused.indexOf("if (!result.ok)", call);
    const navigate = focused.indexOf("window.location.assign(nativeUrl)", call);
    expect(call).toBeGreaterThan(0);
    expect(check).toBeGreaterThan(call);
    expect(navigate).toBeGreaterThan(check);
    expect(focused).not.toContain('nextStatus: "arrived"');
  });

  it("ends native guidance on arrival without changing booking, service, or attendance state", () => {
    expect(navigation).toContain("navigator.stopGuidance()");
    expect(navigation).toContain("navigator.clearDestinations()");
    expect(navigation).not.toContain("updateBookingProgressAction");
    expect(navigation).not.toContain('nextStatus: "completed"');
  });
});
