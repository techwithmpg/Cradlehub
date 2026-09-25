import { describe, expect, it } from "vitest";

import { restoreMergedIdentityCells } from "@/lib/integrations/google-sheets/sheet-merge-normalizer";

describe("Google Sheets merge normalization", () => {
  it("restores only explicitly targeted merge-backed cells", () => {
    const raw = [
      ["", "9:00 AM", "ROSE", "CLIENT A"],
      ["", "", "", ""],
      ["", "", "", ""],
      ["", "2:00 PM", "", ""],
      ["", "", "", ""],
    ];

    const original = structuredClone(raw);

    const result = restoreMergedIdentityCells({
      values: raw,

      merges: [
        {
          startRow: 1,
          endRow: 3,
          startColumn: 3,
          endColumn: 3,
        },
        {
          startRow: 1,
          endRow: 3,
          startColumn: 4,
          endColumn: 4,
        },
        {
          startRow: 4,
          endRow: 5,
          startColumn: 2,
          endColumn: 2,
        },
      ],

      targets: [
        {
          sourceRow: 2,
          sourceColumn: 3,
        },
        {
          sourceRow: 3,
          sourceColumn: 3,
        },
        {
          sourceRow: 2,
          sourceColumn: 4,
        },
        {
          sourceRow: 5,
          sourceColumn: 2,
        },
      ],
    });

    expect(raw).toEqual(original);

    expect(result.values[1]?.[2]).toBe("ROSE");

    expect(result.values[2]?.[2]).toBe("ROSE");

    expect(result.values[1]?.[3]).toBe("CLIENT A");

    // Same merge, but not authorized.
    expect(result.values[2]?.[3]).toBe("");

    expect(result.values[4]?.[1]).toBe("2:00 PM");

    expect(result.restorations).toHaveLength(4);
  });

  it("never populates untargeted blank merge rows", () => {
    const result = restoreMergedIdentityCells({
      values: [
        ["", "", "ROSE"],
        ["", "", ""],
        ["", "", ""],
      ],

      merges: [
        {
          startRow: 1,
          endRow: 3,
          startColumn: 3,
          endColumn: 3,
        },
      ],

      targets: [
        {
          sourceRow: 2,
          sourceColumn: 3,
        },
      ],
    });

    expect(result.values[1]?.[2]).toBe("ROSE");

    expect(result.values[2]?.[2]).toBe("");

    expect(result.restorations).toHaveLength(1);
  });

  it("does not infer from blank merge owners", () => {
    const result = restoreMergedIdentityCells({
      values: [
        ["", "", ""],
        ["", "", ""],
      ],

      merges: [
        {
          startRow: 1,
          endRow: 2,
          startColumn: 3,
          endColumn: 3,
        },
      ],

      targets: [
        {
          sourceRow: 2,
          sourceColumn: 3,
        },
      ],
    });

    expect(result.restorations).toHaveLength(0);
  });
});
