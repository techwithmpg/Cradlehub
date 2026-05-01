import { ServiceBuilderClient } from "./service-builder-client";
import { getAllCategories } from "@/lib/queries/services";

export default async function NewServicePage() {
  const categories = await getAllCategories();
  return (
    <ServiceBuilderClient
      categories={categories.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
