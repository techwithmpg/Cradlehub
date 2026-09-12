/**
 * PWA-C6 Test Suite — resolve-scan-target.ts
 *
 * Tests for the server-owned scan routing seam (PWA-GOV-009).
 * Validates URL normalization, delegation categories, and security guards.
 *
 * Run: pnpm vitest src/lib/scanner/__tests__/resolve-scan-target.test.ts
 */

import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";
import { resolveStaffScanTarget } from "../resolve-scan-target";

vi.mock("server-only", () => ({}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setEnv(key: string, value: string) {
  process.env[key] = value;
}

function clearEnv(key: string) {
  delete process.env[key];
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("resolveStaffScanTarget", () => {
  // ---- Empty / null guards ------------------------------------------------

  describe("invalid: empty payloads", () => {
    it("returns invalid for an empty string", () => {
      const result = resolveStaffScanTarget("");
      expect(result.ok).toBe(false);
      expect(result.target).toBe("invalid");
    });

    it("returns invalid for a whitespace-only string", () => {
      const result = resolveStaffScanTarget("   ");
      expect(result.ok).toBe(false);
      expect(result.target).toBe("invalid");
    });

    it("returns invalid for a non-string value coerced to string", () => {
      // @ts-expect-error — deliberate runtime-type test
      const result = resolveStaffScanTarget(null);
      expect(result.ok).toBe(false);
    });
  });

  // ---- Blocked URI schemes ------------------------------------------------

  describe("security: blocked URI schemes", () => {
    it("blocks javascript: URI", () => {
      const result = resolveStaffScanTarget("javascript:alert(1)");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("blocked_scheme");
    });

    it("blocks data: URI", () => {
      const result = resolveStaffScanTarget("data:text/html,<h1>x</h1>");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("blocked_scheme");
    });

    it("blocks file: URI", () => {
      const result = resolveStaffScanTarget("file:///etc/passwd");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("blocked_scheme");
    });

    it("blocks vbscript: URI", () => {
      const result = resolveStaffScanTarget("vbscript:msgbox(1)");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("blocked_scheme");
    });
  });

  // ---- Raw public-code identifiers ----------------------------------------

  describe("raw identifiers: public_scan", () => {
    it("resolves att_ prefixed raw code", () => {
      const result = resolveStaffScanTarget("att_abc123");
      expect(result.ok).toBe(true);
      if (result.ok && result.target === "public_scan") {
        expect(result.publicCode).toBe("att_abc123");
      }
    });

    it("resolves room_ prefixed raw code", () => {
      const result = resolveStaffScanTarget("room_xyz789");
      expect(result.ok).toBe(true);
      if (result.ok && result.target === "public_scan") {
        expect(result.publicCode).toBe("room_xyz789");
      }
    });

    it("resolves res_ prefixed raw code", () => {
      const result = resolveStaffScanTarget("res_item42");
      expect(result.ok).toBe(true);
      if (result.ok && result.target === "public_scan") {
        expect(result.publicCode).toBe("res_item42");
      }
    });

    it("trims whitespace from raw code", () => {
      const result = resolveStaffScanTarget("  att_abc123  ");
      expect(result.ok).toBe(true);
      if (result.ok && result.target === "public_scan") {
        expect(result.publicCode).toBe("att_abc123");
      }
    });
  });

  // ---- Raw activation tokens ----------------------------------------------

  describe("raw identifiers: activation", () => {
    it("resolves act_ prefixed raw token", () => {
      const result = resolveStaffScanTarget("act_tok123");
      expect(result.ok).toBe(true);
      if (result.ok && result.target === "activation") {
        expect(result.token).toBe("act_tok123");
      }
    });

    it("does NOT accept opaque 32-byte hex token without prefix", () => {
      const hex32 = "a".repeat(64); // 32 bytes hex = 64 chars
      const result = resolveStaffScanTarget(hex32);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("unrecognized_payload");
    });
  });

  // ---- Unknown raw identifiers --------------------------------------------

  describe("invalid: unrecognized raw identifiers", () => {
    it("rejects unknown prefixes", () => {
      expect(resolveStaffScanTarget("unknown_abc").ok).toBe(false);
      expect(resolveStaffScanTarget("random-string").ok).toBe(false);
      expect(resolveStaffScanTarget("https_is_not_raw").ok).toBe(false);
    });
  });

  // ---- Full URL: same origin ----------------------------------------------

  describe("full URL: same origin resolution", () => {
    beforeAll(() => {
      setEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com");
    });
    afterAll(() => {
      clearEnv("NEXT_PUBLIC_APP_URL");
    });

    it("resolves /scan/{publicCode} URL to public_scan", () => {
      const result = resolveStaffScanTarget(
        "https://app.example.com/scan/att_abc123"
      );
      expect(result.ok).toBe(true);
      if (result.ok && result.target === "public_scan") {
        expect(result.publicCode).toBe("att_abc123");
      }
    });

    it("resolves /scan/activate/{token} URL to activation", () => {
      const result = resolveStaffScanTarget(
        "https://app.example.com/scan/activate/act_tok456"
      );
      expect(result.ok).toBe(true);
      if (result.ok && result.target === "activation") {
        expect(result.token).toBe("act_tok456");
      }
    });

    it("resolves URL-encoded publicCode from URL", () => {
      const result = resolveStaffScanTarget(
        "https://app.example.com/scan/att_abc%20123"
      );
      expect(result.ok).toBe(true);
      if (result.ok && result.target === "public_scan") {
        expect(result.publicCode).toBe("att_abc 123");
      }
    });

    it("rejects /scan/{code} URL with unknown prefix", () => {
      const result = resolveStaffScanTarget(
        "https://app.example.com/scan/unknown_code"
      );
      expect(result.ok).toBe(false);
    });

    it("rejects unknown path on same origin", () => {
      const result = resolveStaffScanTarget(
        "https://app.example.com/admin/reset"
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("unknown_path");
    });

    it("rejects redirect param on same-origin URL", () => {
      const result = resolveStaffScanTarget(
        "https://app.example.com/scan/att_abc?redirect=/evil"
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("redirect_param");
    });

    it("rejects next param on same-origin URL", () => {
      const result = resolveStaffScanTarget(
        "https://app.example.com/scan/att_abc?next=/evil"
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("redirect_param");
    });
  });

  // ---- Full URL: foreign origin -------------------------------------------

  describe("full URL: foreign origin rejection", () => {
    beforeAll(() => {
      setEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com");
    });
    afterAll(() => {
      clearEnv("NEXT_PUBLIC_APP_URL");
    });

    it("rejects foreign origin URL", () => {
      const result = resolveStaffScanTarget(
        "https://evil.example.com/scan/att_abc"
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("foreign_origin");
    });

    it("rejects malformed URL", () => {
      const result = resolveStaffScanTarget("https://not a valid url");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("malformed_url");
    });
  });

  // ---- Localhost in non-production ----------------------------------------

  describe("full URL: localhost accepted in non-production", () => {
    it("resolves localhost URL in non-production environment", () => {
      const originalEnv = process.env.NODE_ENV;
      // NODE_ENV in test is 'test', not 'production', so localhost is accepted
      const result = resolveStaffScanTarget(
        "http://localhost:3000/scan/att_abc123"
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.target).toBe("public_scan");
      }
    });
  });
});
