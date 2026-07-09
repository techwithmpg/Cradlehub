import { describe, expect, it } from "vitest";
import { updateBranchSchema } from "@/lib/validations/branch";

const BRANCH_ID = "11111111-1111-4111-8111-111111111111";

describe("branch location validation", () => {
  it("accepts a selected Google Places branch origin", () => {
    const parsed = updateBranchSchema.safeParse({
      branchId: BRANCH_ID,
      address: "SM City Bacolod, Bacolod, Negros Occidental, Philippines",
      placeId: "places/branch-origin",
      latitude: 10.6713,
      longitude: 122.9452,
      city: "Bacolod",
      barangay: "Reclamation Area",
      mapsEmbedUrl: "https://www.google.com/maps/search/?api=1&query=10.6713%2C122.9452",
      locationMetadata: {
        formatted_address: "SM City Bacolod, Bacolod, Negros Occidental, Philippines",
        source: "google_places",
        address_components: [
          {
            long_name: "Bacolod",
            short_name: "Bacolod",
            types: ["locality"],
          },
        ],
      },
    });

    expect(parsed.success).toBe(true);
  });

  it("requires latitude and longitude to be saved together", () => {
    const parsed = updateBranchSchema.safeParse({
      branchId: BRANCH_ID,
      latitude: 10.6713,
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe(
      "Select a valid branch address with latitude and longitude."
    );
  });
});
