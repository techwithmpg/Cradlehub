import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type BookingResource = {
  id: string;
  name: string;
  type: string;
};

export type BookingRowWithResource<T extends { resource_id?: string | null }> =
  T & {
    resource_id: string | null;
    branch_resources: BookingResource | null;
  };

export async function attachBranchResources<
  T extends { resource_id?: string | null },
>(
  supabase: SupabaseClient,
  rows: T[]
): Promise<BookingRowWithResource<T>[]> {
  const resourceIds = Array.from(
    new Set(
      rows
        .map((row) => row.resource_id)
        .filter((id): id is string => Boolean(id))
    )
  );

  if (resourceIds.length === 0) {
    return rows.map((row) => ({
      ...row,
      resource_id: row.resource_id ?? null,
      branch_resources: null,
    }));
  }

  const { data, error } = await supabase
    .from("branch_resources")
    .select("id, name, type")
    .in("id", resourceIds);

  if (error) throw new Error(error.message);

  const resourcesById = new Map(
    (data ?? []).map((resource) => [resource.id, resource])
  );

  return rows.map((row) => ({
    ...row,
    resource_id: row.resource_id ?? null,
    branch_resources: row.resource_id
      ? resourcesById.get(row.resource_id) ?? null
      : null,
  }));
}
