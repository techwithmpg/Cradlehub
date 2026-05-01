import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { getServiceById } from "@/lib/queries/services";
import { getAllCategories } from "@/lib/queries/services";
import { updateServiceAction } from "@/app/(dashboard)/owner/services/actions";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

type Props = {
  params: Promise<{ serviceId: string }>;
};

export default async function EditServicePage({ params }: Props) {
  const { serviceId } = await params;
  const [service, categories] = await Promise.all([
    getServiceById(serviceId),
    getAllCategories(),
  ]);

  if (!service) notFound();

  async function handleUpdate(formData: FormData) {
    "use server";
    const result = await updateServiceAction({
      serviceId,
      name: formData.get("name") as string,
      description: (formData.get("description") as string) || undefined,
      durationMinutes: Number(formData.get("durationMinutes")),
      price: Number(formData.get("price")),
      categoryId: (formData.get("categoryId") as string) || undefined,
    });

    if (result.success) {
      redirect("/owner/services");
    }
  }

  return (
    <div>
      <PageHeader
        title="Edit Service"
        description={service.name}
        action={
          <Button
            asChild
            variant="outline"
            size="sm"
            className="cs-btn cs-btn-ghost cs-btn-sm"
          >
            <Link href="/owner/services">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Services
            </Link>
          </Button>
        }
      />

      <div
        className="cs-card"
        style={{
          maxWidth: 640,
          padding: "1.5rem",
        }}
      >
        <form action={handleUpdate} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Name */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "var(--cs-text)",
                marginBottom: 6,
              }}
            >
              Service Name
            </label>
            <input
              type="text"
              name="name"
              defaultValue={service.name}
              required
              minLength={2}
              maxLength={100}
              style={{
                width: "100%",
                height: 40,
                padding: "0 0.75rem",
                borderRadius: 6,
                border: "1px solid var(--cs-border)",
                backgroundColor: "var(--cs-surface)",
                color: "var(--cs-text)",
                fontSize: "0.875rem",
                outline: "none",
              }}
            />
          </div>

          {/* Category */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "var(--cs-text)",
                marginBottom: 6,
              }}
            >
              Category
            </label>
            <select
              name="categoryId"
              defaultValue={service.category_id ?? ""}
              required
              style={{
                width: "100%",
                height: 40,
                padding: "0 0.75rem",
                borderRadius: 6,
                border: "1px solid var(--cs-border)",
                backgroundColor: "var(--cs-surface)",
                color: "var(--cs-text)",
                fontSize: "0.875rem",
                outline: "none",
              }}
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "var(--cs-text)",
                marginBottom: 6,
              }}
            >
              Description
            </label>
            <textarea
              name="description"
              defaultValue={service.description ?? ""}
              rows={3}
              maxLength={1000}
              style={{
                width: "100%",
                padding: "0.625rem 0.75rem",
                borderRadius: 6,
                border: "1px solid var(--cs-border)",
                backgroundColor: "var(--cs-surface)",
                color: "var(--cs-text)",
                fontSize: "0.875rem",
                outline: "none",
                resize: "vertical",
              }}
            />
          </div>

          {/* Duration + Price */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: "var(--cs-text)",
                  marginBottom: 6,
                }}
              >
                Duration (minutes)
              </label>
              <input
                type="number"
                name="durationMinutes"
                defaultValue={service.duration_minutes}
                required
                min={15}
                max={480}
                style={{
                  width: "100%",
                  height: 40,
                  padding: "0 0.75rem",
                  borderRadius: 6,
                  border: "1px solid var(--cs-border)",
                  backgroundColor: "var(--cs-surface)",
                  color: "var(--cs-text)",
                  fontSize: "0.875rem",
                  outline: "none",
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: "var(--cs-text)",
                  marginBottom: 6,
                }}
              >
                Price
              </label>
              <input
                type="number"
                name="price"
                defaultValue={Number(service.price)}
                required
                min={0}
                step={0.01}
                style={{
                  width: "100%",
                  height: 40,
                  padding: "0 0.75rem",
                  borderRadius: 6,
                  border: "1px solid var(--cs-border)",
                  backgroundColor: "var(--cs-surface)",
                  color: "var(--cs-text)",
                  fontSize: "0.875rem",
                  outline: "none",
                }}
              />
            </div>
          </div>

          {/* Current values summary */}
          <div
            style={{
              padding: "0.75rem",
              borderRadius: "var(--cs-r-md)",
              backgroundColor: "var(--cs-bg)",
              border: "1px solid var(--cs-border-soft)",
              fontSize: "0.8125rem",
              color: "var(--cs-text-muted)",
            }}
          >
            Current: {service.duration_minutes} min · {formatCurrency(Number(service.price))}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
            <Button
              type="submit"
              style={{
                backgroundColor: "var(--cs-sand)",
                color: "#fff",
                border: "none",
              }}
            >
              Save Changes
            </Button>
            <Button asChild variant="outline" className="cs-btn cs-btn-ghost">
              <Link href="/owner/services">Cancel</Link>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
