import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAllCategories } from "@/lib/queries/services";
import {
  createServiceAction,
  createServiceCategoryAction,
} from "@/app/(dashboard)/owner/services/actions";
import type { Database } from "@/types/supabase";

type CategoryRow = Database["public"]["Tables"]["service_categories"]["Row"];

async function createCategoryFormAction(formData: FormData) {
  "use server";

  await createServiceCategoryAction({
    name: String(formData.get("categoryName") ?? ""),
    displayOrder: Number(formData.get("displayOrder") ?? 0),
  });
}

async function createServiceFormAction(formData: FormData) {
  "use server";

  const result = await createServiceAction({
    categoryId: String(formData.get("categoryId") ?? ""),
    name: String(formData.get("serviceName") ?? ""),
    description: String(formData.get("description") ?? "") || undefined,
    durationMinutes: Number(formData.get("durationMinutes") ?? 0),
    price: Number(formData.get("price") ?? 0),
    bufferBefore: Number(formData.get("bufferBefore") ?? 0),
    bufferAfter: Number(formData.get("bufferAfter") ?? 0),
  });

  if (result.success) {
    redirect("/owner/services");
  }
}

export default async function NewServicePage() {
  const categories = (await getAllCategories()) as CategoryRow[];

  return (
    <div style={{ maxWidth: 760 }}>
      <PageHeader
        title="New Service"
        description="Create categories and services available across branches"
      />

      <div style={{ display: "grid", gap: "1rem" }}>
        <section
          style={{
            backgroundColor: "var(--cs-surface)",
            border: "1px solid var(--cs-border)",
            borderRadius: 12,
            padding: "1.25rem",
          }}
        >
          <h3 style={{ fontSize: "0.95rem", fontWeight: 600, margin: "0 0 0.75rem", color: "var(--cs-text)" }}>
            Create Category
          </h3>
          <form action={createCategoryFormAction} style={{ display: "grid", gap: "0.875rem" }}>
            <FormField label="Category name" htmlFor="category-name">
              <Input id="category-name" name="categoryName" placeholder="Signature Massages" required />
            </FormField>
            <FormField label="Display order" htmlFor="display-order">
              <Input id="display-order" name="displayOrder" type="number" min={0} defaultValue={0} required />
            </FormField>
            <Button
              type="submit"
              style={{
                width: "fit-content",
                backgroundColor: "var(--cs-sand)",
                color: "#fff",
                border: "none",
              }}
            >
              Add Category
            </Button>
          </form>
        </section>

        <section
          style={{
            backgroundColor: "var(--cs-surface)",
            border: "1px solid var(--cs-border)",
            borderRadius: 12,
            padding: "1.25rem",
          }}
        >
          <h3 style={{ fontSize: "0.95rem", fontWeight: 600, margin: "0 0 0.75rem", color: "var(--cs-text)" }}>
            Create Service
          </h3>
          <form action={createServiceFormAction} style={{ display: "grid", gap: "0.875rem" }}>
            <FormField label="Category" htmlFor="category-id">
              <select
                id="category-id"
                name="categoryId"
                required
                style={{
                  height: 36,
                  borderRadius: 6,
                  border: "1px solid var(--cs-border)",
                  padding: "0 0.5rem",
                  fontSize: "0.875rem",
                  backgroundColor: "var(--cs-surface)",
                  color: "var(--cs-text)",
                }}
              >
                <option value="">Select category…</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Service name" htmlFor="service-name">
              <Input id="service-name" name="serviceName" placeholder="Deep Tissue Massage" required />
            </FormField>

            <FormField label="Description" htmlFor="service-description">
              <Input id="service-description" name="description" placeholder="Targeted relief for muscle tension" />
            </FormField>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <FormField label="Duration (minutes)" htmlFor="duration-minutes">
                <Input id="duration-minutes" name="durationMinutes" type="number" min={15} defaultValue={60} required />
              </FormField>
              <FormField label="Price (PHP)" htmlFor="price">
                <Input id="price" name="price" type="number" min={0} defaultValue={1200} required />
              </FormField>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <FormField label="Buffer before" htmlFor="buffer-before">
                <Input id="buffer-before" name="bufferBefore" type="number" min={0} max={60} defaultValue={0} required />
              </FormField>
              <FormField label="Buffer after" htmlFor="buffer-after">
                <Input id="buffer-after" name="bufferAfter" type="number" min={0} max={60} defaultValue={0} required />
              </FormField>
            </div>

            <div style={{ display: "flex", gap: "0.625rem" }}>
              <Button type="submit" style={{ backgroundColor: "var(--cs-sand)", color: "#fff", border: "none" }}>
                Create Service
              </Button>
              <Button asChild variant="outline">
                <Link href="/owner/services">Cancel</Link>
              </Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

function FormField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "grid", gap: "0.45rem" }}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
