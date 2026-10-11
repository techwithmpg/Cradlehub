import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261011020713_p0_booking_security_forward.sql"),
  "utf8"
).replaceAll("\r\n", "\n");
const bookingOrigin = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261005043621_p1_booking_confirmation_origin.sql"),
  "utf8"
).replaceAll("\r\n", "\n");
const finalAcl = migration.slice(migration.lastIndexOf("-- Reassert final ACLs"));

function applicationSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return applicationSources(path);
    return /\.(ts|tsx)$/.test(entry.name) &&
      path !== resolve(process.cwd(), "src/types/supabase.ts")
      ? [path]
      : [];
  });
}

describe("controlled P0 forward migration", () => {
  it("preserves the reviewed booking-origin SQL exactly", () => {
    const startMarker =
      "-- Booking-origin SQL follows unchanged from the reviewed source migration.\n";
    const start = migration.indexOf(startMarker) + startMarker.length;
    const end = migration.lastIndexOf("-- Reassert final ACLs");

    expect(start).toBeGreaterThan(startMarker.length - 1);
    expect(migration.slice(start, end).trim()).toBe(bookingOrigin.trim());
  });

  it.each(["PUBLIC", "anon", "authenticated"])(
    "denies direct schedule execution to %s after the function replacement",
    (role) => {
      expect(finalAcl).toContain(
        `REVOKE ALL ON FUNCTION public.get_daily_schedule(uuid, date) FROM ${role};`
      );
      expect(migration).not.toMatch(
        new RegExp(
          `GRANT EXECUTE ON FUNCTION public\\.get_daily_schedule\\(uuid, date\\) TO ${role};`,
          "i"
        )
      );
    }
  );

  it("allows only the controlled service-role schedule path", () => {
    expect(finalAcl).toContain(
      "GRANT EXECUTE ON FUNCTION public.get_daily_schedule(uuid, date) TO service_role;"
    );
    expect(migration).toContain("'customer',      COALESCE(c.full_name, '-')");
    expect(migration).toContain("'pending_crm_confirmation', 'confirmed'");
  });

  it("has no application caller of the legacy schedule RPC", () => {
    for (const path of applicationSources(resolve(process.cwd(), "src"))) {
      expect(readFileSync(path, "utf8"), path).not.toContain("get_daily_schedule");
    }
  });

  it("keeps the progress RPC locked down after its replacement", () => {
    for (const role of ["PUBLIC", "anon", "authenticated"]) {
      expect(finalAcl).toContain(
        `REVOKE ALL ON FUNCTION public.update_booking_progress(uuid, text) FROM ${role};`
      );
    }
    expect(finalAcl).toContain(
      "GRANT EXECUTE ON FUNCTION public.update_booking_progress(uuid, text) TO service_role;"
    );
  });
});
