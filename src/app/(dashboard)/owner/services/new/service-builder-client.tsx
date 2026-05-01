"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { ServiceCardPreview } from "@/components/features/services/service-card-preview";
import {
  createServiceAction,
  createServiceCategoryAction,
} from "@/app/(dashboard)/owner/services/actions";
import { ArrowLeft, ImageIcon, Check } from "lucide-react";

type Category = {
  id: string;
  name: string;
};

type Props = {
  categories: Category[];
};

export function ServiceBuilderClient({ categories: initialCategories }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const categories = initialCategories;

  const [categoryMode, setCategoryMode] = useState<"existing" | "new">(
    initialCategories.length > 0 ? "existing" : "new"
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryOrder, setNewCategoryOrder] = useState(0);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [price, setPrice] = useState(1200);
  const [bufferBefore, setBufferBefore] = useState(0);
  const [bufferAfter, setBufferAfter] = useState(0);
  const [isActive, setIsActive] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [categorySuccess, setCategorySuccess] = useState<string | null>(null);

  const selectedCategoryName =
    categories.find((c) => c.id === selectedCategoryId)?.name ?? "";

  function handleCreateCategory() {
    if (!newCategoryName.trim()) return;
    setError(null);
    setCategorySuccess(null);

    startTransition(async () => {
      const result = await createServiceCategoryAction({
        name: newCategoryName.trim(),
        displayOrder: newCategoryOrder,
      });

      if (!result.success) {
        setError(result.error ?? "Failed to create category");
        return;
      }

      setCategorySuccess(
        `Category "${newCategoryName.trim()}" created. Refresh the page to see it in the list, or create another.`
      );
      setNewCategoryName("");
      setNewCategoryOrder((prev) => prev + 1);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (categoryMode === "existing" && !selectedCategoryId) {
      setError("Please choose a category.");
      return;
    }
    if (categoryMode === "new" && !newCategoryName.trim()) {
      setError("Please enter a new category name or switch to an existing category.");
      return;
    }
    if (!name.trim()) {
      setError("Service name is required.");
      return;
    }
    if (durationMinutes <= 0) {
      setError("Duration must be greater than 0.");
      return;
    }
    if (price < 0) {
      setError("Price cannot be negative.");
      return;
    }

    startTransition(async () => {
      if (categoryMode === "new") {
        const catResult = await createServiceCategoryAction({
          name: newCategoryName.trim(),
          displayOrder: newCategoryOrder,
        });
        if (!catResult.success) {
          setError(catResult.error ?? "Failed to create category");
          return;
        }
        setError(
          `Category "${newCategoryName.trim()}" was created. Please refresh the page and select it from the dropdown.`
        );
        return;
      }

      const result = await createServiceAction({
        categoryId: selectedCategoryId,
        name: name.trim(),
        description: description.trim() || undefined,
        durationMinutes,
        price,
        bufferBefore,
        bufferAfter,
        isActive,
      });

      if (!result.success) {
        setError(result.error ?? "Failed to create service. Please try again.");
        return;
      }

      router.push("/owner/services");
    });
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    height: 40,
    padding: "0 0.75rem",
    borderRadius: 6,
    border: "1px solid var(--cs-border)",
    backgroundColor: "var(--cs-surface)",
    color: "var(--cs-text)",
    fontSize: "0.875rem",
    outline: "none",
  };

  const textareaStyle: React.CSSProperties = {
    ...inputStyle,
    height: "auto",
    padding: "0.625rem 0.75rem",
    resize: "vertical",
    lineHeight: 1.5,
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    paddingRight: "1.5rem",
    cursor: "pointer",
  };

  const sectionStyle: React.CSSProperties = {
    backgroundColor: "var(--cs-surface)",
    border: "1px solid var(--cs-border)",
    borderRadius: "var(--cs-r-lg)",
    padding: "1.25rem",
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: "0.8125rem",
    fontWeight: 700,
    color: "var(--cs-text)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: "1rem",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.8125rem",
    fontWeight: 600,
    color: "var(--cs-text)",
    marginBottom: 6,
  };

  const helperStyle: React.CSSProperties = {
    fontSize: "0.75rem",
    color: "var(--cs-text-muted)",
    marginTop: 4,
  };

  return (
    <div>
      <PageHeader
        title="New Service"
        description="Create a spa service, assign it to a category, and control how customers see it."
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

      {error && (
        <div
          style={{
            marginBottom: "1rem",
            padding: "0.625rem 0.875rem",
            backgroundColor: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: 6,
            fontSize: "0.8125rem",
            color: "#991B1B",
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 360px",
          gap: "1.5rem",
          alignItems: "start",
        }}
      >
        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Section 1: Category */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>1. Category</div>

            <div style={{ display: "flex", gap: "0.375rem", marginBottom: "1rem" }}>
              <button
                type="button"
                onClick={() => setCategoryMode("existing")}
                style={{
                  padding: "5px 12px",
                  borderRadius: 5,
                  border: `1px solid ${categoryMode === "existing" ? "var(--cs-sand)" : "var(--cs-border)"}`,
                  backgroundColor: categoryMode === "existing" ? "var(--cs-sand-mist)" : "transparent",
                  color: categoryMode === "existing" ? "var(--cs-sand)" : "var(--cs-text-muted)",
                  fontSize: "0.8125rem",
                  fontWeight: categoryMode === "existing" ? 600 : 400,
                  cursor: "pointer",
                }}
              >
                Use existing category
              </button>
              <button
                type="button"
                onClick={() => setCategoryMode("new")}
                style={{
                  padding: "5px 12px",
                  borderRadius: 5,
                  border: `1px solid ${categoryMode === "new" ? "var(--cs-sand)" : "var(--cs-border)"}`,
                  backgroundColor: categoryMode === "new" ? "var(--cs-sand-mist)" : "transparent",
                  color: categoryMode === "new" ? "var(--cs-sand)" : "var(--cs-text-muted)",
                  fontSize: "0.8125rem",
                  fontWeight: categoryMode === "new" ? 600 : 400,
                  cursor: "pointer",
                }}
              >
                Create new category
              </button>
            </div>

            {categoryMode === "existing" ? (
              <div>
                <label style={labelStyle}>Category</label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  style={selectStyle}
                  required={categoryMode === "existing"}
                >
                  <option value="">Select category…</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                {categories.length === 0 && (
                  <p style={helperStyle}>No categories yet. Switch to &quot;Create new category&quot; to add one.</p>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div>
                  <label style={labelStyle}>New category name</label>
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="e.g. Signature Massages"
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <label style={labelStyle}>Display order</label>
                    <input
                      type="number"
                      value={newCategoryOrder}
                      onChange={(e) => setNewCategoryOrder(Number(e.target.value))}
                      min={0}
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end" }}>
                    <Button
                      type="button"
                      onClick={handleCreateCategory}
                      disabled={isPending || !newCategoryName.trim()}
                      size="sm"
                      style={{
                        backgroundColor: "var(--cs-sand)",
                        color: "#fff",
                        border: "none",
                        height: 40,
                      }}
                    >
                      {isPending ? "Creating…" : "Create Category"}
                    </Button>
                  </div>
                </div>
                {categorySuccess && (
                  <div
                    style={{
                      padding: "0.5rem 0.75rem",
                      backgroundColor: "#F0FDF4",
                      border: "1px solid #BBF7D0",
                      borderRadius: 6,
                      fontSize: "0.8125rem",
                      color: "#15803D",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Check className="h-4 w-4" />
                    {categorySuccess}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 2: Service Details */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>2. Service Details</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <div>
                <label style={labelStyle}>
                  Service name <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Swedish Massage 60min"
                  required
                  minLength={2}
                  maxLength={100}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what the customer receives and who this service is best for."
                  rows={3}
                  maxLength={1000}
                  style={textareaStyle}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Pricing & Duration */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>3. Pricing & Duration</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label style={labelStyle}>
                  Duration (minutes) <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <input
                  type="number"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  min={15}
                  max={480}
                  required
                  style={inputStyle}
                />
                <p style={helperStyle}>How long the therapist is blocked on the schedule.</p>
              </div>
              <div>
                <label style={labelStyle}>
                  Price (PHP) <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  min={0}
                  step={0.01}
                  required
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Buffer before</label>
                <input
                  type="number"
                  value={bufferBefore}
                  onChange={(e) => setBufferBefore(Number(e.target.value))}
                  min={0}
                  max={60}
                  style={inputStyle}
                />
                <p style={helperStyle}>Prep time before the booking.</p>
              </div>
              <div>
                <label style={labelStyle}>Buffer after</label>
                <input
                  type="number"
                  value={bufferAfter}
                  onChange={(e) => setBufferAfter(Number(e.target.value))}
                  min={0}
                  max={60}
                  style={inputStyle}
                />
                <p style={helperStyle}>Cleanup time after the booking.</p>
              </div>
            </div>
          </div>

          {/* Section 4: Visibility */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>4. Visibility</div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.75rem",
                borderRadius: "var(--cs-r-md)",
                backgroundColor: isActive ? "var(--cs-surface-warm)" : "var(--cs-bg)",
                border: "1px solid var(--cs-border-soft)",
              }}
            >
              <div>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--cs-text)" }}>
                  {isActive ? "Active service" : "Inactive service"}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", marginTop: 2 }}>
                  {isActive
                    ? "Visible to customers and available in booking"
                    : "Hidden from customer booking, but saved in your service catalog"}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isActive}
                onClick={() => setIsActive((v) => !v)}
                style={{
                  position: "relative",
                  width: 44,
                  height: 24,
                  borderRadius: 12,
                  border: "none",
                  padding: 2,
                  cursor: "pointer",
                  backgroundColor: isActive ? "#4A7C59" : "var(--cs-border)",
                  transition: "background-color 200ms ease",
                }}
              >
                <span
                  style={{
                    display: "block",
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    backgroundColor: "#fff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                    transition: "transform 200ms ease",
                    transform: isActive ? "translateX(20px)" : "translateX(0)",
                  }}
                />
              </button>
            </div>
          </div>

          {/* Section 5: Image */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>5. Service Image</div>
            <div
              style={{
                padding: "1.5rem",
                borderRadius: "var(--cs-r-md)",
                backgroundColor: "var(--cs-bg)",
                border: "1px dashed var(--cs-border)",
                textAlign: "center",
                color: "var(--cs-text-muted)",
              }}
            >
              <ImageIcon className="h-8 w-8 mx-auto mb-2" style={{ opacity: 0.5 }} />
              <div style={{ fontSize: "0.8125rem", fontWeight: 500, marginBottom: 4 }}>
                Image upload coming soon
              </div>
              <div style={{ fontSize: "0.75rem" }}>
                Service images will be matched automatically by name for now.
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: "0.75rem", paddingTop: "0.5rem" }}>
            <Button
              type="submit"
              disabled={isPending}
              style={{
                backgroundColor: "var(--cs-sand)",
                color: "#fff",
                border: "none",
              }}
            >
              {isPending ? "Creating…" : "Create Service"}
            </Button>
            <Button asChild variant="outline" className="cs-btn cs-btn-ghost">
              <Link href="/owner/services">Cancel</Link>
            </Button>
          </div>
        </form>

        {/* Preview */}
        <div style={{ position: "sticky", top: 20 }}>
          <div
            style={{
              fontSize: "0.8125rem",
              fontWeight: 700,
              color: "var(--cs-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: "0.75rem",
            }}
          >
            Live Preview
          </div>
          <ServiceCardPreview
            name={name}
            description={description}
            categoryName={selectedCategoryName}
            durationMinutes={durationMinutes}
            price={price}
            isActive={isActive}
          />
          <p
            style={{
              fontSize: "0.75rem",
              color: "var(--cs-text-subtle)",
              marginTop: "0.75rem",
              textAlign: "center",
            }}
          >
            This is how your service will appear on the Services page.
          </p>
        </div>
      </div>
    </div>
  );
}
