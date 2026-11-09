import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({
  context: vi.fn(),
  notices: vi.fn(),
}));
vi.mock("@/lib/staff-pwa/staff-context", () => ({
  getStaffPwaContext: state.context,
}));
vi.mock("@/lib/staff-pwa/notices-runtime", () => ({
  getStaffNotices: state.notices,
}));
import { getDriverTripAlertAction } from "@/app/(dashboard)/staff/driver/trip-alert-action";

const href = "/staff/driver/map?bookingId=11111111-1111-4111-8111-111111111111";
const notice = { id:"notice-1", title:"Home Service confirmed",
  body:"A new trip is assigned", href, status:"unread" };
beforeEach(() => {
  vi.clearAllMocks();
  state.context.mockResolvedValue({ group: "driver" });
  state.notices.mockResolvedValue({ items: [notice], error: null });
});

describe("driver in-app alert boundary", () => {
  it("shows an unread scoped driver trip", async () => {
    expect(await getDriverTripAlertAction()).toEqual({
      ok: true, alert: { id:"notice-1", title:notice.title, body:notice.body, href },
    });
  });
  it("refuses a manager or general staff workspace", async () => {
    state.context.mockResolvedValue({ group:"crm_general" });
    expect(await getDriverTripAlertAction()).toEqual({ ok: false });
    expect(state.notices).not.toHaveBeenCalled();
  });
  it("ignores read, external and unrelated notices", async () => {
    state.notices.mockResolvedValue({ items:[
      {...notice,status:"read"},
      {...notice,id:"notice-2",href:"https://external.example/booking"},
      {...notice,id:"notice-3",href:"/staff/attendance"},
    ],error:null});
    expect(await getDriverTripAlertAction()).toEqual({ ok:true,alert:null });
  });
  it("does not claim alerts are empty when database access fails", async () => {
    state.notices.mockResolvedValue({ items:[],error:"Unavailable" });
    expect(await getDriverTripAlertAction()).toEqual({ ok:false });
  });
});
