import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Simulation of the PostgreSQL trigger function logic
type BookingRow = {
  id: string;
  service_id: string;
  session_duration_minutes_snapshot?: number | null;
  metadata: Record<string, unknown> | null;
  status: string;
  staff_id?: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  amount_paid: number;
};

function applyPurchasedServiceDurationSnapshotTrigger(
  op: "INSERT" | "UPDATE",
  newRow: BookingRow,
  oldRow?: BookingRow
): BookingRow {
  const next = structuredClone(newRow);
  const metadata = next.metadata ?? {};

  if (op === "INSERT") {
    const snapshot = metadata.commercial_snapshot as Record<string, unknown> | undefined;
    if (!snapshot) return next;

    if (
      typeof snapshot !== "object" ||
      snapshot === null ||
      snapshot.service_id !== next.service_id ||
      !["fixed", "extendable"].includes(String(snapshot.duration_policy_snapshot))
    ) {
      throw new Error("INVALID_PURCHASED_SERVICE_DURATION");
    }

    const selected = String(snapshot.selected_duration_minutes ?? "");
    if (!/^[1-9][0-9]{0,3}$/.test(selected) || Number(selected) > 1440) {
      throw new Error("INVALID_PURCHASED_SERVICE_DURATION");
    }

    next.session_duration_minutes_snapshot = Number(selected);
    return next;
  }

  if (op === "UPDATE") {
    if (!oldRow) throw new Error("OLD row required for UPDATE");
    const oldMeta = oldRow.metadata ?? {};
    const oldHasSnapshot = "commercial_snapshot" in oldMeta && oldMeta.commercial_snapshot !== null;
    const newHasSnapshot = "commercial_snapshot" in metadata && metadata.commercial_snapshot !== null;

    if (oldHasSnapshot) {
      // 1. Snapshot immutability check
      if (JSON.stringify(metadata.commercial_snapshot) !== JSON.stringify(oldMeta.commercial_snapshot)) {
        throw new Error("COMMERCIAL_SNAPSHOT_IMMUTABLE");
      }
      // 2. Service ID immutability check
      if (next.service_id !== oldRow.service_id) {
        throw new Error("COMMERCIAL_SERVICE_IMMUTABLE");
      }
      // 3. Operational treatment duration is immutable; restore it if overwritten
      next.session_duration_minutes_snapshot = oldRow.session_duration_minutes_snapshot;
    } else {
      // Historical line without snapshot: do not permit adding snapshot on update
      if (newHasSnapshot) {
        throw new Error("COMMERCIAL_SNAPSHOT_CANNOT_BE_ADDED_ON_UPDATE");
      }
    }
    return next;
  }

  return next;
}

describe("Purchased Commercial Duration Snapshot Immutability", () => {
  const migrationPath = join(
    process.cwd(),
    "supabase",
    "migrations",
    "20261016223000_enforce_purchased_commercial_snapshot_immutability.sql"
  );
  const sql = readFileSync(migrationPath, "utf8").replace(/\r\n/g, "\n");

  describe("SQL Migration Contract", () => {
    it("creates trigger on both BEFORE INSERT OR UPDATE", () => {
      expect(sql).toContain("create trigger trg_z_apply_purchased_service_duration_snapshot");
      expect(sql).toContain("before insert or update on public.bookings");
      expect(sql).toContain("for each row execute function public.apply_purchased_service_duration_snapshot()");
    });

    it("enforces immutable commercial snapshot on UPDATE", () => {
      expect(sql).toContain("if old.metadata ? 'commercial_snapshot' then");
      expect(sql).toContain("new.metadata->'commercial_snapshot' is distinct from old.metadata->'commercial_snapshot'");
      expect(sql).toContain("raise exception 'COMMERCIAL_SNAPSHOT_IMMUTABLE'");
    });

    it("enforces immutable service ID on lines with a commercial snapshot", () => {
      expect(sql).toContain("new.service_id is distinct from old.service_id");
      expect(sql).toContain("raise exception 'COMMERCIAL_SERVICE_IMMUTABLE'");
    });

    it("restores session_duration_minutes_snapshot to old snapshot value on UPDATE", () => {
      expect(sql).toContain("new.session_duration_minutes_snapshot := old.session_duration_minutes_snapshot;");
    });

    it("preserves historical rows without commercial snapshot", () => {
      expect(sql).toContain("raise exception 'COMMERCIAL_SNAPSHOT_CANNOT_BE_ADDED_ON_UPDATE'");
    });
  });

  describe("Trigger Behavioral Verification", () => {
    const validSnapshot = {
      service_id: "service-1",
      duration_policy_snapshot: "extendable",
      base_duration_minutes_snapshot: 60,
      selected_duration_minutes: 120,
      base_price_snapshot: 500,
      extension_increment_minutes_snapshot: 30,
      extension_price_snapshot: 250,
      extension_units: 2,
      calculated_price: 1000,
    };

    it("INSERT valid: initializes session_duration_minutes_snapshot from selected_duration_minutes", () => {
      const row: BookingRow = {
        id: "b-1",
        service_id: "service-1",
        metadata: { commercial_snapshot: validSnapshot },
        status: "confirmed",
        booking_date: "2026-10-20",
        start_time: "10:00:00",
        end_time: "12:00:00",
        amount_paid: 0,
      };

      const result = applyPurchasedServiceDurationSnapshotTrigger("INSERT", row);
      expect(result.session_duration_minutes_snapshot).toBe(120);
    });

    it("INSERT invalid: rejects mismatched service_id or invalid minutes", () => {
      const mismatchedService: BookingRow = {
        id: "b-2",
        service_id: "service-other",
        metadata: { commercial_snapshot: validSnapshot },
        status: "confirmed",
        booking_date: "2026-10-20",
        start_time: "10:00:00",
        end_time: "12:00:00",
        amount_paid: 0,
      };

      expect(() =>
        applyPurchasedServiceDurationSnapshotTrigger("INSERT", mismatchedService)
      ).toThrow("INVALID_PURCHASED_SERVICE_DURATION");
    });

    it("UPDATE non-commercial fields allowed: status, staff, notes, payment", () => {
      const oldRow: BookingRow = {
        id: "b-1",
        service_id: "service-1",
        session_duration_minutes_snapshot: 120,
        metadata: { commercial_snapshot: validSnapshot, customer_notes: "Initial note" },
        status: "confirmed",
        staff_id: "staff-1",
        booking_date: "2026-10-20",
        start_time: "10:00:00",
        end_time: "12:00:00",
        amount_paid: 0,
      };

      const updatedRow: BookingRow = {
        ...oldRow,
        status: "completed",
        staff_id: "staff-2",
        amount_paid: 1000,
        metadata: {
          ...oldRow.metadata,
          customer_notes: "Updated note after service",
        },
      };

      const result = applyPurchasedServiceDurationSnapshotTrigger("UPDATE", updatedRow, oldRow);
      expect(result.status).toBe("completed");
      expect(result.staff_id).toBe("staff-2");
      expect(result.amount_paid).toBe(1000);
      expect(result.session_duration_minutes_snapshot).toBe(120);
      expect((result.metadata?.commercial_snapshot as typeof validSnapshot).calculated_price).toBe(1000);
    });

    it("UPDATE purchased commercial snapshot rejected: altering calculated_price", () => {
      const oldRow: BookingRow = {
        id: "b-1",
        service_id: "service-1",
        session_duration_minutes_snapshot: 120,
        metadata: { commercial_snapshot: validSnapshot },
        status: "confirmed",
        booking_date: "2026-10-20",
        start_time: "10:00:00",
        end_time: "12:00:00",
        amount_paid: 0,
      };

      const tamperedRow: BookingRow = {
        ...oldRow,
        metadata: {
          commercial_snapshot: {
            ...validSnapshot,
            calculated_price: 500, // illegally reducing price
          },
        },
      };

      expect(() =>
        applyPurchasedServiceDurationSnapshotTrigger("UPDATE", tamperedRow, oldRow)
      ).toThrow("COMMERCIAL_SNAPSHOT_IMMUTABLE");
    });

    it("UPDATE purchased commercial snapshot rejected: altering selected_duration_minutes", () => {
      const oldRow: BookingRow = {
        id: "b-1",
        service_id: "service-1",
        session_duration_minutes_snapshot: 120,
        metadata: { commercial_snapshot: validSnapshot },
        status: "confirmed",
        booking_date: "2026-10-20",
        start_time: "10:00:00",
        end_time: "12:00:00",
        amount_paid: 0,
      };

      const tamperedRow: BookingRow = {
        ...oldRow,
        metadata: {
          commercial_snapshot: {
            ...validSnapshot,
            selected_duration_minutes: 60,
          },
        },
      };

      expect(() =>
        applyPurchasedServiceDurationSnapshotTrigger("UPDATE", tamperedRow, oldRow)
      ).toThrow("COMMERCIAL_SNAPSHOT_IMMUTABLE");
    });

    it("UPDATE rejected: altering service_id on a line with commercial snapshot", () => {
      const oldRow: BookingRow = {
        id: "b-1",
        service_id: "service-1",
        session_duration_minutes_snapshot: 120,
        metadata: { commercial_snapshot: validSnapshot },
        status: "confirmed",
        booking_date: "2026-10-20",
        start_time: "10:00:00",
        end_time: "12:00:00",
        amount_paid: 0,
      };

      const changedService: BookingRow = {
        ...oldRow,
        service_id: "service-2",
      };

      expect(() =>
        applyPurchasedServiceDurationSnapshotTrigger("UPDATE", changedService, oldRow)
      ).toThrow("COMMERCIAL_SERVICE_IMMUTABLE");
    });

    it("UPDATE protects duration: timing trigger reset attempt is reverted", () => {
      const oldRow: BookingRow = {
        id: "b-1",
        service_id: "service-1",
        session_duration_minutes_snapshot: 120,
        metadata: { commercial_snapshot: validSnapshot },
        status: "confirmed",
        booking_date: "2026-10-20",
        start_time: "10:00:00",
        end_time: "12:00:00",
        amount_paid: 0,
      };

      // Simulating a timing trigger trying to reset session_duration_minutes_snapshot to base 60
      const resetAttempt: BookingRow = {
        ...oldRow,
        session_duration_minutes_snapshot: 60,
      };

      const result = applyPurchasedServiceDurationSnapshotTrigger("UPDATE", resetAttempt, oldRow);
      expect(result.session_duration_minutes_snapshot).toBe(120);
    });

    it("historical rows preserved: updates to legacy bookings without commercial snapshot succeed", () => {
      const legacyOldRow: BookingRow = {
        id: "b-legacy",
        service_id: "service-1",
        session_duration_minutes_snapshot: 60,
        metadata: { some_old_flag: true },
        status: "confirmed",
        booking_date: "2026-08-01",
        start_time: "14:00:00",
        end_time: "15:00:00",
        amount_paid: 500,
      };

      const legacyUpdate: BookingRow = {
        ...legacyOldRow,
        status: "completed",
        metadata: { some_old_flag: true, post_service_notes: "Done" },
      };

      const result = applyPurchasedServiceDurationSnapshotTrigger("UPDATE", legacyUpdate, legacyOldRow);
      expect(result.status).toBe("completed");
      expect(result.metadata?.post_service_notes).toBe("Done");
    });

    it("historical rows preserved: retroactive injection of commercial snapshot on legacy update rejected", () => {
      const legacyOldRow: BookingRow = {
        id: "b-legacy",
        service_id: "service-1",
        session_duration_minutes_snapshot: 60,
        metadata: null,
        status: "confirmed",
        booking_date: "2026-08-01",
        start_time: "14:00:00",
        end_time: "15:00:00",
        amount_paid: 500,
      };

      const retroactiveInject: BookingRow = {
        ...legacyOldRow,
        metadata: { commercial_snapshot: validSnapshot },
      };

      expect(() =>
        applyPurchasedServiceDurationSnapshotTrigger("UPDATE", retroactiveInject, legacyOldRow)
      ).toThrow("COMMERCIAL_SNAPSHOT_CANNOT_BE_ADDED_ON_UPDATE");
    });
  });
});
