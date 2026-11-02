import { describe, it, expect } from "vitest";
import { retargetDiscountTenders } from "@/lib/cash-flow/retarget-tenders";
describe("authoritative discount tender retarget", () => {
  it("preserves split methods, references and physical cash when the quote lowers payable", () => {
    expect(
      retargetDiscountTenders(
        [
          { amount: "400.00", method: "cash", cashReceived: "1000", reference: "" },
          { amount: "600.00", method: "gcash", cashReceived: "", reference: "REF" },
        ],
        1000,
        900
      )
    ).toEqual([
      { amount: "400.00", method: "cash", cashReceived: "1000", reference: "" },
      { amount: "500.00", method: "gcash", cashReceived: "", reference: "REF" },
    ]);
  });
  it("preserves an affordable partial payment", () =>
    expect(retargetDiscountTenders([{ amount: "200.00" }], 1000, 900)).toEqual([
      { amount: "200.00" },
    ]));
  it("clamps excess tenders and drops zero parts", () =>
    expect(
      retargetDiscountTenders([{ amount: "600.00" }, { amount: "400.00" }], 1000, 500)
    ).toEqual([{ amount: "500.00" }]));
  it("retargets a full payment upward after removing discount", () =>
    expect(retargetDiscountTenders([{ amount: "900.00" }], 900, 1000)).toEqual([
      { amount: "1000.00" },
    ]));
});
