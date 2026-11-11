import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

const state = vi.hoisted(() => ({
  jobs: vi.fn(),
  job: vi.fn(),
  logError: vi.fn(),
}));
vi.mock("@/app/(dashboard)/staff-portal/actions", () => ({
  getMyDriverJobsAction: state.jobs,
  getMyDriverJobByIdAction: state.job,
}));
vi.mock("@/lib/logger", () => ({ logError: state.logError }));

import {
  getDriverDispatchSnapshotAction,
  calculateDriverCombinedRouteAction,
} from "@/app/(dashboard)/staff/driver/map/actions";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
function trip(id = A, overrides: Partial<RealDispatchItem> = {}): RealDispatchItem {
  return {
    id, number: "001", bookingDate: "2026-11-10", startTime: "18:00:00", endTime: "19:00:00",
    customerName: "Assigned guest", serviceName: "Massage", area: "Bacolod", formattedAddress: "Bacolod",
    lat: 10.66, lng: 122.95, branchName: "Main", branchLat: 10.67, branchLng: 122.96,
    needsLocationReview: false, driverId: "driver-1", driverName: null,
    therapistId: "therapist", therapistName: null,
    dispatchStatus: "ready", bookingStatus: "confirmed", bookingProgressStatus: "not_started",
    paymentStatus: "unpaid", etaMinutes: null,
    travelStartedAt: null, arrivedAt: null, sessionStartedAt: null,
    completedAt: null, rating: null, currentLocation: null, ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  state.jobs.mockResolvedValue({
    businessDate: "2026-11-10",
    items: [trip()],
    stats: {totalToday:1},
    staff: {id:"driver-1"},
  });
  state.job.mockResolvedValue({job:trip()});
  process.env.GOOGLE_MAPS_SERVER_API_KEY = "TEST_ONLY_FAKE_KEY";
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  delete process.env.GOOGLE_MAPS_SERVER_API_KEY;
});

describe("assigned driver combined dispatch server boundary", () => {
  it("rejects another driver's booking without loading a date", async () => {
    state.job.mockResolvedValueOnce({error:"Job not found"});
    expect(await getDriverDispatchSnapshotAction({bookingId:B}))
      .toEqual({ok:false,message:"This trip is not assigned to your driver account."});
    expect(state.jobs).not.toHaveBeenCalled();
  });
  it("denies all map snapshot and billed API work after auth failure", async () => {
    state.jobs.mockResolvedValue({error:"Unauthorized"});
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch",fetchSpy);
    const result = await calculateDriverCombinedRouteAction({
      date:"2026-11-10",originLat:10.67,originLng:122.96,
    });
    expect(result.ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it("filters completed and unverified jobs before sending any GPS to Routes", async () => {
    state.jobs.mockResolvedValue({
      businessDate:"2026-11-10",
      items:[
        trip(A),
        trip(B,{needsLocationReview:true}),
        trip("33333333-3333-4333-8333-333333333333",{bookingStatus:"completed",dispatchStatus:"completed"}),
      ],
    });
    const snapshot = await getDriverDispatchSnapshotAction({date:"2026-11-10"});
    if(!snapshot.ok) throw Error("Expected scoped snapshot");
    expect(snapshot.snapshot.navigable.map(x=>x.id)).toEqual([A]);
    expect(snapshot.snapshot.unverified.map(x=>x.id)).toEqual([B]);
  });
  it("uses only the verified assigned route for an authorized single stop", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok:true,
      json: async () => ({ routes: [{polyline:{encodedPolyline:"encoded-road"},duration:"240s",distanceMeters:1200}] }),
    });
    vi.stubGlobal("fetch", fakeFetch);
    const result = await calculateDriverCombinedRouteAction({
      date:"2026-11-10",originLat:10.67,originLng:122.96,
    });
    expect(result).toMatchObject({ok:true,stopIds:[A],durationSeconds:240,distanceMeters:1200});
    expect(fakeFetch).toHaveBeenCalledOnce();
    const body = JSON.parse(fakeFetch.mock.calls[0]![1].body) as { destination: {location: {latLng: {latitude:number}}} };
    expect(body.destination.location.latLng.latitude).toBe(10.66);
  });
  it("builds one ordered route through both assigned stops using road matrix", async () => {
    // Fixed appointment-relative clock: the routing policy correctly gives
    // overdue jobs schedule priority, independent of road proximity.
    // Without this, the November 10 fixture goes stale after that date.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-10T08:00:00+08:00"));
    state.jobs.mockResolvedValue({
      businessDate:"2026-11-10",
      items:[trip(A,{lat:10.70}),trip(B,{lat:10.66})],
    });
    const fakeFetch = vi.fn().mockImplementation(async (url:string) => url.includes("computeRouteMatrix")
      ? {ok:true,json:async()=>[
        {originIndex:0,destinationIndex:0,duration:"800s",condition:"ROUTE_EXISTS"},
        {originIndex:0,destinationIndex:1,duration:"120s",condition:"ROUTE_EXISTS"},
        {originIndex:2,destinationIndex:0,duration:"200s",condition:"ROUTE_EXISTS"},
      ]}
      : {ok:true,json:async()=>({routes:[{polyline:{encodedPolyline:"encoded-many"},duration:"1100s",distanceMeters:3000}]})}
    );
    vi.stubGlobal("fetch",fakeFetch);
    const result = await calculateDriverCombinedRouteAction({
      date:"2026-11-10",originLat:10.67,originLng:122.96,
    });
    expect(result).toMatchObject({ok:true,stopIds:[B,A],basis:"driving_time"});
    expect(fakeFetch).toHaveBeenCalledTimes(2);
    const body = JSON.parse(fakeFetch.mock.calls[1]![1].body) as {intermediates:unknown[]};
    expect(body.intermediates).toHaveLength(1);
  });
});
