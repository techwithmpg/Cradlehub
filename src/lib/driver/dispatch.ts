import { z } from "zod";
import { journeySchema } from "./journey";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
export const dispatchJourneySchema = z.object({
  journey: journeySchema,
  driverName: z.string().max(160).nullable(),
  location: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      recordedAt: z.iso.datetime({ offset: true }),
    })
    .nullable(),
});
export type DispatchJourney = z.infer<typeof dispatchJourneySchema>;
export async function readDispatchJourneys(db: SupabaseClient<Database>, branchId: string) {
  const { data, error } = await db.rpc(
    "driver_unified_dispatch" as never,
    { p_branch_id: branchId } as never
  );
  const parsed = dispatchJourneySchema.array().safeParse(data);
  if (error || !parsed.success) throw new Error("Transport journeys could not be verified.");
  return parsed.data;
}
