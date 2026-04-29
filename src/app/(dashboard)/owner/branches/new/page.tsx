"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBranchAction } from "@/app/(dashboard)/owner/branches/actions";

type BranchFormState = {
  success?: boolean;
  error?: string;
  branchId?: string;
};

const initialState: BranchFormState = {};

function parseSlotInterval(value: FormDataEntryValue | null): 15 | 30 | 60 {
  const n = Number(value);
  if (n === 15 || n === 30 || n === 60) return n;
  return 30;
}

export default function NewBranchPage() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    async (_prev: BranchFormState, formData: FormData): Promise<BranchFormState> => {
      const result = await createBranchAction({
        name: String(formData.get("name") ?? ""),
        address: String(formData.get("address") ?? ""),
        phone: String(formData.get("phone") ?? "") || undefined,
        email: String(formData.get("email") ?? "") || undefined,
        messengerLink: String(formData.get("messenger") ?? "") || undefined,
        slotIntervalMinutes: parseSlotInterval(formData.get("slotInterval")),
      });

      if (result.success) {
        router.push("/owner/branches");
      }

      return {
        success: result.success,
        error: result.error,
        branchId: "branchId" in result ? result.branchId : undefined,
      };
    },
    initialState
  );

  return (
    <div style={{ maxWidth: 560 }}>
      <PageHeader title="New Branch" description="Add a new spa location" />

      <div
        style={{
          backgroundColor: "var(--ch-surface)",
          border: "1px solid var(--ch-border)",
          borderRadius: 12,
          padding: "1.5rem",
        }}
      >
        <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {state.error && (
            <div
              style={{
                padding: "0.75rem",
                backgroundColor: "#FEF2F2",
                border: "1px solid #FECACA",
                borderRadius: 8,
                fontSize: "0.875rem",
                color: "#991B1B",
              }}
            >
              {state.error}
            </div>
          )}

          <FormField label="Branch name *" name="name" placeholder="Main Branch" />
          <FormField label="Address *" name="address" placeholder="123 Lacson St, Bacolod City" />
          <FormField label="Phone" name="phone" placeholder="+63 XXX XXX XXXX" type="tel" />
          <FormField label="Email" name="email" placeholder="branch@cradlespa.com" type="email" />
          <FormField label="Facebook Messenger link" name="messenger" placeholder="https://m.me/..." />

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <Label htmlFor="slotInterval">Booking slot interval</Label>
            <select
              id="slotInterval"
              name="slotInterval"
              defaultValue="30"
              style={{
                height: 36,
                borderRadius: 6,
                border: "1px solid var(--ch-border)",
                padding: "0 0.5rem",
                fontSize: "0.875rem",
                backgroundColor: "var(--ch-surface)",
                color: "var(--ch-text)",
              }}
            >
              <option value="15">Every 15 minutes</option>
              <option value="30">Every 30 minutes</option>
              <option value="60">Every 60 minutes</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
            <Button type="button" variant="outline" onClick={() => router.back()} style={{ flex: 1 }}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending}
              style={{
                flex: 1,
                backgroundColor: "var(--ch-accent)",
                color: "#fff",
                border: "none",
                opacity: pending ? 0.7 : 1,
              }}
            >
              {pending ? "Creating…" : "Create Branch"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FormField({
  label,
  name,
  placeholder,
  type = "text",
}: {
  label: string;
  name: string;
  placeholder: string;
  type?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} placeholder={placeholder} />
    </div>
  );
}
