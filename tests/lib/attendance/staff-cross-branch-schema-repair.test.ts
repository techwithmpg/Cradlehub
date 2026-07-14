import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260714180606_attendance_staff_cross_branch_schema_repair.sql"
  ),
  "utf8"
).toLowerCase();

describe("Attendance staff cross-branch schema repair", () => {
  it("restores the non-null server-owned authorization flag safely", () => {
    expect(migration).toContain("add column if not exists is_cross_branch boolean not null default false");
  });
});
