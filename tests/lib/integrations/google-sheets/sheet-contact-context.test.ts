import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { parseSheetContacts } from "@/lib/integrations/google-sheets/sheet-contact-context";

describe("Master Sheet customer contact identity", () => {
  it("reads the approved CLIENTS CONTACT NUMBER layout", () => {
    const contacts = parseSheetContacts({
      sheetName: "CLIENTS CONTACT NUMBER",
      values: [
        [null, "NAME ", null, "NUMBER", "LOCATION ", "STREET"],
        [1, "ABBIE", "ANG", "09171594777", "SUNTAL", null],
        [2, "ADEN", null, "09451722805", null, null],
      ],
    });

    expect(contacts).toEqual([
      {
        name: "ABBIE ANG",
        phone: "09171594777",
        email: null,
        source: "CLIENTS CONTACT NUMBER:2",
      },
      {
        name: "ADEN",
        phone: "09451722805",
        email: null,
        source: "CLIENTS CONTACT NUMBER:3",
      },
    ]);
  });

  it("preserves duplicate full names as separate contact identity evidence", () => {
    const contacts = parseSheetContacts({
      sheetName: "CLIENTS CONTACT NUMBER",
      values: [
        [null, "NAME", null, "NUMBER"],
        [1, "ANGELA", "GONZALES", "09170000001"],
        [2, "ANGELA", "GONZALES", "09170000002"],
      ],
    });

    expect(contacts).toHaveLength(2);
    expect(contacts[0]?.name).toBe("ANGELA GONZALES");
    expect(contacts[1]?.name).toBe("ANGELA GONZALES");
    expect(contacts[0]?.phone).not.toBe(contacts[1]?.phone);
  });

  it("ignores rows that cannot provide both customer name and phone identity", () => {
    const contacts = parseSheetContacts({
      sheetName: "CLIENTS CONTACT NUMBER",
      values: [
        [null, "NAME", null, "NUMBER"],
        [1, "NO PHONE", null, null],
        [2, null, null, "09170000001"],
      ],
    });

    expect(contacts).toEqual([]);
  });

  it("fails closed when the approved worksheet layout changes", () => {
    expect(() =>
      parseSheetContacts({
        sheetName: "CLIENTS CONTACT NUMBER",
        values: [
          ["NAME", "PHONE"],
          ["Alice", "09171234567"],
        ],
      })
    ).toThrow(/approved B=NAME and D=NUMBER layout/i);
  });

  it("does not accept a similarly shaped unapproved worksheet name", () => {
    expect(() =>
      parseSheetContacts({
        sheetName: "Contacts",
        values: [
          [null, "NAME", null, "NUMBER"],
          [1, "Alice", "Example", "09171234567"],
        ],
      })
    ).toThrow(/approved Contacts source/i);
  });
});
