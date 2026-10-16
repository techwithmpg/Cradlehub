import { beforeEach, it, expect, vi } from "vitest";
import { fakeDatabase } from "../../helpers/stage08a-db";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ admin: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
import { isResourceAvailable, allocateResourcesForAttendees } from "@/lib/engine/resource-availability";
let db: ReturnType<typeof fakeDatabase>;
const args = { resourceId: "room", date: "2026-10-10", startTime: "10:00", endTime: "11:00" };
beforeEach(() => {
  db = fakeDatabase({ branch_resources: [{ id: "room", capacity: 1 }], bookings: [] });
  mocks.admin.mockReturnValue(db.client);
});
it("fails closed when resource lookup fails in strict mode", async () => {
  db.errors.branch_resources = { message: "db failure" };
  await expect(isResourceAvailable(args, { throwOnError: true })).rejects.toEqual({
    message: "db failure",
  });
});
it("fails closed when overlap lookup fails in strict mode", async () => {
  db.errors.bookings = { message: "db failure" };
  await expect(isResourceAvailable(args, { throwOnError: true })).rejects.toEqual({
    message: "db failure",
  });
});
it("retains hosted default behavior", async () => {
  db.errors.bookings = { message: "db failure" };
  expect(await isResourceAvailable(args)).toBe(true);
});
it("accepts a genuine empty overlap result", async () =>
  expect(await isResourceAvailable(args, { throwOnError: true })).toBe(true));

it("reserves separate capacity-one rooms for concurrent guests", async () => {
  db = fakeDatabase({ branch_resources: [
    { id: "room-a", branch_id: "branch", is_active: true, capacity: 1 },
    { id: "room-b", branch_id: "branch", is_active: true, capacity: 1 },
  ], bookings: [] });
  mocks.admin.mockReturnValue(db.client);
  expect(await allocateResourcesForAttendees({ branchId: "branch", date: "2026-10-10", windows: [
    { startTime: "10:00", endTime: "11:00" }, { startTime: "10:00", endTime: "11:30" },
  ] })).toEqual(["room-a", "room-b"]);
});

it("rejects a group when room capacity cannot cover overlap", async () => {
  db = fakeDatabase({ branch_resources: [
    { id: "room-a", branch_id: "branch", is_active: true, capacity: 1 },
  ], bookings: [] });
  mocks.admin.mockReturnValue(db.client);
  expect(await allocateResourcesForAttendees({ branchId: "branch", date: "2026-10-10", windows: [
    { startTime: "10:00", endTime: "11:00" }, { startTime: "10:30", endTime: "11:30" },
  ] })).toBeNull();
});
