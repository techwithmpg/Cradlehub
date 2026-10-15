import type { Database } from "@/types/supabase";

export type OwnerService = Database["public"]["Tables"]["services"]["Row"] & {
  service_categories: { id: string; name: string; display_order: number | null } | null;
  offeredBranchIds: string[];
};

export type OwnerServiceBranch = { id: string; name: string };
export type OwnerServiceCategory = { id: string; name: string };
