import { createClient } from "@/lib/supabase/server";

export async function getAllCategories() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_categories")
    .select("*")
    .eq("is_active", true)
    .order("display_order");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAllServices() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select(`*, service_categories ( id, name, display_order )`)
    .eq("is_active", true)
    .order("service_categories(display_order), name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getServiceById(serviceId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select("*, service_categories (*)")
    .eq("id", serviceId)
    .single();
  if (error) throw new Error(error.message);
  return data;
}
