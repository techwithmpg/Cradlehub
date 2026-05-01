"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateBranchAction,
  toggleBranchActiveAction,
} from "@/app/(dashboard)/owner/branches/actions";
import type { Database } from "@/types/supabase";

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];

type BranchActionState = {
  success?: boolean;
  error?: string;
};

const initialState: BranchActionState = {};

function optionalString(formValue: FormDataEntryValue | null): string | undefined {
  const value = String(formValue ?? "").trim();
  return value.length > 0 ? value : undefined;
}

function parseSlotInterval(value: FormDataEntryValue | null): 15 | 30 | 60 {
  const n = Number(value);
  if (n === 15 || n === 30 || n === 60) return n;
  return 30;
}

export function BranchEditForm({ branch }: { branch: BranchRow }) {
  const [state, formAction, pending] = useActionState(
    async (_prev: BranchActionState, formData: FormData): Promise<BranchActionState> => {
      const result = await updateBranchAction({
        branchId: branch.id,
        name: String(formData.get("name") ?? "").trim(),
        address: String(formData.get("address") ?? "").trim(),
        phone: optionalString(formData.get("phone")),
        email: optionalString(formData.get("email")),
        messengerLink: optionalString(formData.get("messenger")),
        slotIntervalMinutes: parseSlotInterval(formData.get("slotInterval")),
      });

      return {
        success: result.success,
        error: result.error,
      };
    },
    initialState
  );

  const [toggleState, toggleAction, togglePending] = useActionState(
    async (): Promise<BranchActionState> => {
      const result = await toggleBranchActiveAction(branch.id, !branch.is_active);
      return {
        success: result.success,
        error: result.error,
      };
    },
    initialState
  );

  return (
    <div>
      <div
        style={{
          fontSize: "0.8125rem",
          fontWeight: 600,
          color: "var(--cs-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "0.625rem",
        }}
      >
        Branch Details
      </div>

      <div
        style={{
          backgroundColor: "var(--cs-surface)",
          border: "1px solid var(--cs-border)",
          borderRadius: 10,
          padding: "1.25rem",
        }}
      >
        <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {state.error && (
            <div
              style={{
                padding: "0.625rem",
                backgroundColor: "#FEF2F2",
                border: "1px solid #FECACA",
                borderRadius: 6,
                fontSize: "0.8125rem",
                color: "#991B1B",
              }}
            >
              {state.error}
            </div>
          )}
          {state.success && (
            <div
              style={{
                padding: "0.625rem",
                backgroundColor: "#F0FDF4",
                border: "1px solid #BBF7D0",
                borderRadius: 6,
                fontSize: "0.8125rem",
                color: "#15803D",
              }}
            >
              Saved successfully
            </div>
          )}

          <EditField label="Name" name="name" defaultValue={branch.name} />
          <EditField label="Address" name="address" defaultValue={branch.address} />
          <EditField label="Phone" name="phone" defaultValue={branch.phone ?? ""} />
          <EditField label="Email" name="email" defaultValue={branch.email ?? ""} />
          <EditField label="Messenger" name="messenger" defaultValue={branch.messenger_link ?? ""} />

          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            <Label htmlFor="edit-slot-interval" style={{ fontSize: "0.8125rem" }}>
              Slot interval
            </Label>
            <select
              id="edit-slot-interval"
              name="slotInterval"
              defaultValue={String(branch.slot_interval_minutes)}
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
              <option value="15">Every 15 minutes</option>
              <option value="30">Every 30 minutes</option>
              <option value="60">Every 60 minutes</option>
            </select>
          </div>

          <Button
            type="submit"
            disabled={pending}
            style={{
              marginTop: "0.25rem",
              backgroundColor: "var(--cs-sand)",
              color: "#fff",
              border: "none",
              opacity: pending ? 0.7 : 1,
            }}
          >
            {pending ? "Saving…" : "Save Changes"}
          </Button>
        </form>

        <form action={toggleAction} style={{ marginTop: "0.625rem" }}>
          {toggleState.error && (
            <div
              style={{
                padding: "0.625rem",
                backgroundColor: "#FEF2F2",
                border: "1px solid #FECACA",
                borderRadius: 6,
                fontSize: "0.8125rem",
                color: "#991B1B",
                marginBottom: "0.5rem",
              }}
            >
              {toggleState.error}
            </div>
          )}
          <Button
            type="submit"
            variant="outline"
            disabled={togglePending}
            style={{
              width: "100%",
              fontSize: "0.875rem",
              color: branch.is_active ? "#EF4444" : "#15803D",
              borderColor: branch.is_active ? "#FCA5A5" : "#BBF7D0",
            }}
          >
            {branch.is_active ? "Deactivate Branch" : "Reactivate Branch"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function EditField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
      <Label htmlFor={`edit-${name}`} style={{ fontSize: "0.8125rem" }}>
        {label}
      </Label>
      <Input id={`edit-${name}`} name={name} defaultValue={defaultValue} style={{ fontSize: "0.875rem" }} />
    </div>
  );
}
