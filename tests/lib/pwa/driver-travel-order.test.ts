import { beforeEach, describe, expect, it, vi } from "vitest";
const harness = vi.hoisted(() => ({
  transition: vi.fn(), navigate: vi.fn(), refresh: vi.fn(), error: vi.fn(), pending: Promise.resolve(),
}));
vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useState: () => [null, harness.error],
  useTransition: () => [false, (fn: () => Promise<void>) => { harness.pending = fn(); }],
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));
vi.mock("@/app/(dashboard)/staff-portal/actions", () => ({ updateBookingProgressAction: harness.transition }));
import { DriverStartTravelButton } from "@/components/features/staff-portal/driver/map/driver-start-travel-button";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("window", { location: { assign: harness.navigate } });
});
describe("Driver Start Travel ordering", () => {
  it("waits for server success before navigation", async () => {
    let complete!: (value: any) => void;
    harness.transition.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    const element = DriverStartTravelButton({ bookingId: "job", navigationUrl: "https://www.google.com/maps/dir/?api=1&destination=Test" });
    element.props.children[0].props.onClick();
    expect(harness.navigate).not.toHaveBeenCalled();
    complete({ ok: true });
    await harness.pending;
    expect(harness.navigate).toHaveBeenCalledTimes(1);
  });
  it.each(["denied", "network"])("does not navigate or claim success after %s failure", async kind => {
    if (kind === "network") harness.transition.mockRejectedValue(new Error("Offline"));
    else harness.transition.mockResolvedValue({ ok: false, message: "Assignment changed" });
    DriverStartTravelButton({ bookingId: "job", navigationUrl: "https://www.google.com/maps" }).props.children[0].props.onClick();
    await harness.pending;
    expect(harness.navigate).not.toHaveBeenCalled();
    expect(harness.error).toHaveBeenLastCalledWith(expect.any(String));
  });
});
