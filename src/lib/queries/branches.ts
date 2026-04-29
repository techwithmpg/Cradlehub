import { createClient } from "@/lib/supabase/server";

export async function getAllBranches() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("branches")
    .select("*")
    .eq("is_active", true)
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getBranchById(branchId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("branches")
    .select("*")
    .eq("id", branchId)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getBranchServices(branchId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("branch_services")
    .select(`
      *,
      services (
        id, name, description, duration_minutes, price,
        buffer_before, buffer_after,
        service_categories ( id, name, display_order )
      )
    `)
    .eq("branch_id", branchId)
    .eq("is_active", true)
    .order("services(service_categories(display_order))");
  if (error) throw new Error(error.message);
  return data ?? [];
}
