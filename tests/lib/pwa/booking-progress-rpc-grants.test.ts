import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve("supabase/migrations/20261006041409_p0_booking_progress_rpc_access.sql"),
  "utf8"
);

describe("booking progress RPC execution boundary", () => {
  it("removes inherited and direct Data API execution grants", () => {
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.update_booking_progress\(uuid, text\) FROM PUBLIC;/i
    );
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.update_booking_progress\(uuid, text\) FROM anon;/i
    );
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.update_booking_progress\(uuid, text\) FROM authenticated;/i
    );
    expect(migration).not.toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.update_booking_progress\(uuid, text\)\s+TO\s+(?:anon|authenticated|PUBLIC)/i
    );
  });

  it("keeps only the server-side service role as an explicit caller", () => {
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.update_booking_progress\(uuid, text\) TO service_role;/i
    );
  });
});
