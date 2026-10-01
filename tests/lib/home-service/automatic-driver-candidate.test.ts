import { describe, expect, it } from "vitest";
import { automaticDriverCandidate } from "@/lib/home-service/automatic-driver-candidate";
import type { ScoredStaff } from "@/lib/assignments/recommendation-engine";

const candidate = (staffId: string, status: ScoredStaff["status"]): ScoredStaff =>
  ({ staffId, status } as ScoredStaff);

describe("Home Service automatic driver choice", () => {
  it("takes the highest ranked recommended driver", () => {
    expect(automaticDriverCandidate(null, [
      candidate("unavailable", "unavailable"),
      candidate("best", "recommended"),
      candidate("other", "recommended"),
    ])).toBe("best");
  });

  it("does not replace an assigned driver", () => {
    expect(automaticDriverCandidate("already-assigned", [candidate("best", "recommended")])).toBeNull();
  });

  it("leaves the booking unassigned without a recommended candidate", () => {
    expect(automaticDriverCandidate(null, [candidate("possible", "available")])).toBeNull();
  });
});
