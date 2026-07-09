import { z } from "zod";

// z.string().uuid() is stricter in Zod v4 and can reject some existing IDs.
const uuid = z.guid("Invalid ID");

const googleAddressComponentSchema = z.object({
  long_name: z.string().max(200),
  short_name: z.string().max(100),
  types: z.array(z.string().max(80)).max(12),
});

const branchLocationMetadataSchema = z
  .object({
    formatted_address: z.string().max(500).optional(),
    map_url: z.string().url().max(1000).optional(),
    source: z.literal("google_places").optional(),
    address_components: z.array(googleAddressComponentSchema).max(24).optional(),
  })
  .passthrough();

function validateCoordinatePair(
  data: { latitude?: number | null; longitude?: number | null },
  ctx: z.RefinementCtx
) {
  const hasLat = typeof data.latitude === "number";
  const hasLng = typeof data.longitude === "number";
  if (hasLat !== hasLng) {
    ctx.addIssue({
      code: "custom",
      message: "Select a valid branch address with latitude and longitude.",
      path: hasLat ? ["longitude"] : ["latitude"],
    });
  }
}

const branchBaseSchema = z.object({
  name:                z.string().min(2).max(100),
  address:             z.string().min(5).max(500),
  phone:               z.string().min(7).max(20).optional(),
  email:               z.string().email().optional(),
  mapsEmbedUrl:        z.string().url().optional().nullable(),
  fbPage:              z.string().url().optional(),
  messengerLink:       z.string().url().optional(),
  placeId:             z.string().max(300).optional().nullable(),
  latitude:            z.number().min(-90).max(90).optional().nullable(),
  longitude:           z.number().min(-180).max(180).optional().nullable(),
  city:                z.string().max(100).optional().nullable(),
  barangay:            z.string().max(100).optional().nullable(),
  locationMetadata:    branchLocationMetadataSchema.optional().nullable(),
  slotIntervalMinutes: z.union([z.literal(15), z.literal(30), z.literal(60)]).default(30),
});

export const createBranchSchema = branchBaseSchema.superRefine(validateCoordinatePair);
export type CreateBranchInput = z.infer<typeof createBranchSchema>;

export const updateBranchSchema = branchBaseSchema
  .partial()
  .extend({ branchId: uuid, isActive: z.boolean().optional() })
  .superRefine(validateCoordinatePair);
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;

// ── Branch service price update ───────────────────────────────────────────
export const updateBranchServicePriceSchema = z.object({
  branchId: z.guid("Invalid branch ID"),
  serviceId: z.guid("Invalid service ID"),
  customPrice: z.number().min(0, "Price cannot be negative").nullable(),
});
export type UpdateBranchServicePriceInput = z.infer<typeof updateBranchServicePriceSchema>;

// ── Branch slot interval update ───────────────────────────────────────────
export const updateBranchSlotIntervalSchema = z.object({
  branchId: z.guid("Invalid branch ID"),
  slotIntervalMinutes: z.union([z.literal(15), z.literal(30), z.literal(60)]),
});
export type UpdateBranchSlotIntervalInput = z.infer<typeof updateBranchSlotIntervalSchema>;

// ── Branch resources (Spaces & Equipment) ─────────────────────────────────
export const RESOURCE_TYPES = [
  "room",
  "bed",
  "chair",
  "equipment",
  "home_service_unit",
  "shared_area",
  "other",
] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const createBranchResourceSchema = z.object({
  branchId:   uuid,
  name:       z.string().min(1, "Name is required").max(100),
  type:       z.enum(RESOURCE_TYPES).default("room"),
  capacity:   z.number().int().min(1, "Capacity must be at least 1").default(1),
  isActive:   z.boolean().default(true),
  sortOrder:  z.number().int().default(0),
  notes:      z.string().max(500).optional(),
});
export type CreateBranchResourceInput = z.infer<typeof createBranchResourceSchema>;

export const updateBranchResourceSchema = createBranchResourceSchema
  .partial()
  .extend({ resourceId: uuid });
export type UpdateBranchResourceInput = z.infer<typeof updateBranchResourceSchema>;
