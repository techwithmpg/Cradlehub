import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TherapistProvenanceBadge } from "./therapist-provenance-badge";

const staffId = "6a7f8743-a9c4-4d0a-b6f1-6c43d9e40b35";

describe("operational therapist provenance badge", () => {
  it("shows customer choice only for the requested current therapist", () => {
    const html = renderToStaticMarkup(<TherapistProvenanceBadge booking={{ staff_id: staffId, requested_staff_id: staffId, therapist_selection_source: "customer_selected" }} />);
    expect(html).toContain("Customer choice");
    expect(html).not.toContain("Auto assigned");
  });

  it("shows automatic assignment but hides front-desk and historical unknown sources", () => {
    expect(renderToStaticMarkup(<TherapistProvenanceBadge booking={{ staff_id: staffId, therapist_selection_source: "system_assigned" }} />)).toContain("Auto assigned");
    expect(renderToStaticMarkup(<TherapistProvenanceBadge booking={{ staff_id: staffId, therapist_selection_source: "front_desk_selected" }} />)).toBe("");
    expect(renderToStaticMarkup(<TherapistProvenanceBadge booking={{ staff_id: staffId, therapist_selection_source: "legacy_unknown" }} />)).toBe("");
  });
});
