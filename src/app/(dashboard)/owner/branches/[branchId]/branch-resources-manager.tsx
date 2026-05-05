"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createBranchResourceAction,
  updateBranchResourceAction,
  toggleBranchResourceActiveAction,
} from "@/app/(dashboard)/owner/branches/resources-actions";
import { RESOURCE_TYPES, type ResourceType } from "@/lib/validations/branch";
import type { Database } from "@/types/supabase";
import { Plus, Edit2, Power, Settings2 } from "lucide-react";

type ResourceRow = Database["public"]["Tables"]["branch_resources"]["Row"];

export function BranchResourcesManager({
  branchId,
  resources,
}: {
  branchId: string;
  resources: ResourceRow[];
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingResource, setEditingResource] = useState<ResourceRow | null>(
    null
  );

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.625rem",
        }}
      >
        <div
          style={{
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--cs-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Spaces & Equipment
        </div>

        <Button
          variant="ghost"
          size="sm"
          style={{ height: 24, fontSize: "0.75rem", gap: 4 }}
          onClick={() => setIsAdding(true)}
        >
          <Plus size={14} /> Add Space
        </Button>

        <Dialog open={isAdding} onOpenChange={setIsAdding}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Space</DialogTitle>
            </DialogHeader>
            <ResourceForm
              branchId={branchId}
              onSuccess={() => setIsAdding(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div
        style={{
          backgroundColor: "var(--cs-surface)",
          border: "1px solid var(--cs-border)",
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        {resources.length === 0 ? (
          <div style={{ padding: "1.5rem", textAlign: "center" }}>
            <Settings2
              size={32}
              style={{ margin: "0 auto 0.75rem", color: "var(--cs-border)" }}
            />
            <div style={{ fontSize: "0.875rem", color: "var(--cs-text-muted)" }}>
              No rooms, beds, or equipment defined yet.
            </div>
          </div>
        ) : (
          resources.map((r, i) => (
            <div
              key={r.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.75rem 1rem",
                borderBottom:
                  i < resources.length - 1
                    ? "1px solid var(--cs-border)"
                    : "none",
                opacity: r.is_active ? 1 : 0.5,
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    backgroundColor: "var(--cs-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--cs-text-muted)",
                  }}
                >
                  {getResourceIcon(r.type as ResourceType)}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "0.875rem",
                      fontWeight: 500,
                      color: "var(--cs-text)",
                    }}
                  >
                    {r.name}
                    {r.capacity > 1 && (
                      <span
                        style={{
                          marginLeft: 6,
                          fontSize: "0.75rem",
                          color: "var(--cs-text-muted)",
                        }}
                      >
                        (Cap: {r.capacity})
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--cs-text-muted)",
                      textTransform: "capitalize",
                    }}
                  >
                    {r.type.replace(/_/g, " ")}
                  </div>
                </div>
              </div>

              <div
                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  style={{ width: 28, height: 28 }}
                  onClick={() => setEditingResource(r)}
                >
                  <Edit2 size={14} />
                </Button>

                <Dialog
                  open={editingResource?.id === r.id}
                  onOpenChange={(open) => !open && setEditingResource(null)}
                >
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit Space</DialogTitle>
                    </DialogHeader>
                    {editingResource && (
                      <ResourceForm
                        branchId={branchId}
                        resource={editingResource}
                        onSuccess={() => setEditingResource(null)}
                      />
                    )}
                  </DialogContent>
                </Dialog>

                <ToggleActiveButton resource={r} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ResourceForm({
  branchId,
  resource,
  onSuccess,
}: {
  branchId: string;
  resource?: ResourceRow;
  onSuccess: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const payload = {
        branchId,
        name: String(formData.get("name")),
        type: String(formData.get("type")),
        capacity: Number(formData.get("capacity")),
        notes: String(formData.get("notes")),
        sortOrder: Number(formData.get("sortOrder")),
        isActive: resource ? resource.is_active : true,
      };

      const result = resource
        ? await updateBranchResourceAction({ ...payload, resourceId: resource.id })
        : await createBranchResourceAction(payload);

      if (result.success) {
        onSuccess();
      } else {
        setError(result.error ?? "Failed to save");
      }
    });
  }

  return (
    <form
      action={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
    >
      {error && (
        <div
          style={{
            padding: "0.75rem",
            backgroundColor: "#FEF2F2",
            color: "#991B1B",
            borderRadius: 6,
            fontSize: "0.8125rem",
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        <Label htmlFor="res-name">Name</Label>
        <Input
          id="res-name"
          name="name"
          defaultValue={resource?.name}
          placeholder="e.g. Room 1, Bed A"
          required
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <Label htmlFor="res-type">Type</Label>
          <select
            id="res-type"
            name="type"
            defaultValue={resource?.type ?? "room"}
            style={{
              height: 36,
              borderRadius: 6,
              border: "1px solid var(--cs-border)",
              backgroundColor: "var(--cs-surface)",
              color: "var(--cs-text)",
              padding: "0 0.5rem",
              fontSize: "0.875rem",
            }}
          >
            {RESOURCE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ").charAt(0).toUpperCase() +
                  t.slice(1).replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <Label htmlFor="res-capacity">Capacity</Label>
          <Input
            id="res-capacity"
            name="capacity"
            type="number"
            defaultValue={resource?.capacity ?? 1}
            min={1}
            required
          />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        <Label htmlFor="res-sort">Sort Order</Label>
        <Input
          id="res-sort"
          name="sortOrder"
          type="number"
          defaultValue={resource?.sort_order ?? 0}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        <Label htmlFor="res-notes">Internal Notes</Label>
        <Textarea
          id="res-notes"
          name="notes"
          defaultValue={resource?.notes ?? ""}
          placeholder="Optional description..."
          rows={2}
        />
      </div>

      <Button
        type="submit"
        disabled={isPending}
        style={{
          backgroundColor: "var(--cs-sand)",
          color: "#fff",
          opacity: isPending ? 0.7 : 1,
        }}
      >
        {isPending ? "Saving..." : resource ? "Save Changes" : "Create Space"}
      </Button>
    </form>
  );
}

function ToggleActiveButton({ resource }: { resource: ResourceRow }) {
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      await toggleBranchResourceActiveAction(resource.id, !resource.is_active);
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={isPending}
      onClick={handleToggle}
      style={{
        width: 28,
        height: 28,
        color: resource.is_active ? "var(--cs-text-muted)" : "#10B981",
      }}
    >
      <Power size={14} />
    </Button>
  );
}

function getResourceIcon(type: ResourceType) {
  switch (type) {
    case "room":
      return "🚪";
    case "bed":
      return "🛌";
    case "chair":
      return "🪑";
    case "equipment":
      return "⚙️";
    case "home_service_unit":
      return "🚗";
    case "shared_area":
      return "👥";
    default:
      return "📦";
  }
}
