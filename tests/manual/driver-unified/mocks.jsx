import React, { useSyncExternalStore } from "react";
const subscribe = (fn) => {
  window.addEventListener("popstate", fn);
  return () => window.removeEventListener("popstate", fn);
};
const go = (href) => {
  history.pushState({}, "", href);
  window.dispatchEvent(new PopStateEvent("popstate"));
};
export const usePathname = () => useSyncExternalStore(subscribe, () => location.pathname);
export const useSearchParams = () => new URLSearchParams(location.search);
export const useRouter = () => ({
  push: go,
  replace: go,
  prefetch: () => {},
  refresh: () => {},
  back: () => history.back(),
});
export default function Link({ href, children, prefetch, ...props }) {
  void prefetch; // Strip the Next-only prop from the disconnected HTML fixture.
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}
export const StaffSnapshotRecorder = () => null;
export const StaffSafeMemoryProvider = ({ children }) => children;
export const useStaffSafeMemory = () => null;
export const invalidateStaffSafeMemory = () => {};
export const emitMobileInstantNav = () => {};
export const MobileRetainedTabHost = ({ children }) => children;
export const DriverDispatchWakeListener = () => null;
export const DriverProfileSheet = () => null;
export const DriverTripAlerts = () => null;
export const StaffAttendanceClockOut = () => null;
export const updateBookingProgressAction = async () => ({
  ok: false,
  message: "Preview only — booking writes are disconnected.",
});
export const recordAssignedDriverLiveLocationAction = async () => ({ ok: false });
export const getAssignedDriverRouteAction = async () => ({
  ok: false,
  message: "Preview only — no paid routing request.",
});

export const resolveStaffScanTargetAction = async () => ({
  ok: false,
  message: "Disconnected LOCAL TEST preview",
});
