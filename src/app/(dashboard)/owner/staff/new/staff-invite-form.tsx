"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createStaffAction } from "@/app/(dashboard)/owner/staff/actions";
import type { Database } from "@/types/supabase";

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];
type Tier = "senior" | "mid" | "junior";
type StaffRole = "manager" | "crm" | "staff";

type StaffActionState = {
  success?: boolean;
  error?: string;
};

const initialState: StaffActionState = {};

function isTier(value: string): value is Tier {
  return value === "senior" || value === "mid" || value === "junior";
}

function isStaffRole(value: string): value is StaffRole {
  return value === "manager" || value === "crm" || value === "staff";
}

export function InviteStaffForm({ branches }: { branches: BranchRow[] }) {
  const router = useRouter();

  const [state, formAction, pending] = useActionState(
    async (_prev: StaffActionState, formData: FormData): Promise<StaffActionState> => {
      const tierValue = String(formData.get("tier") ?? "");
      const roleValue = String(formData.get("systemRole") ?? "");

      if (!isTier(tierValue) || !isStaffRole(roleValue)) {
        return { success: false, error: "Please select a valid role and tier." };
      }

      const result = await createStaffAction({
        branchId: String(formData.get("branchId") ?? ""),
        fullName: String(formData.get("fullName") ?? ""),
        email: String(formData.get("email") ?? ""),
        phone: String(formData.get("phone") ?? "") || undefined,
        tier: tierValue,
        systemRole: roleValue,
      });

      if (result.success) {
        router.push("/owner/staff");
      }

      return {
        success: result.success,
        error: result.error,
      };
    },
    initialState
  );

  return (
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

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <Label htmlFor="fullName">Full name *</Label>
          <Input id="fullName" name="fullName" placeholder="Maria Santos" required />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <Label htmlFor="email">Email address *</Label>
          <Input id="email" name="email" type="email" placeholder="maria@cradlespa.com" required />
          <p style={{ fontSize: "0.75rem", color: "var(--ch-text-muted)", margin: 0 }}>
            An invite link will be sent to this email address
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <Label htmlFor="phone">Phone (optional)</Label>
          <Input id="phone" name="phone" type="tel" placeholder="+63 XXX XXX XXXX" />
        </div>

        <SelectField id="branchId" name="branchId" label="Branch *">
          <option value="">Select branch…</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </SelectField>

        <SelectField id="systemRole" name="systemRole" label="Role *">
          <option value="">Select role…</option>
          <option value="manager">Manager — daily schedule, walk-ins, bookings</option>
          <option value="crm">CRM — customer records and history</option>
          <option value="staff">Staff — own schedule and assigned bookings</option>
        </SelectField>

        <SelectField id="tier" name="tier" label="Tier *">
          <option value="">Select tier…</option>
          <option value="senior">Senior Therapist</option>
          <option value="mid">Mid Therapist</option>
          <option value="junior">Junior Therapist</option>
        </SelectField>

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
            {pending ? "Sending invite…" : "Send Invite"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function SelectField({
  id,
  name,
  label,
  children,
}: {
  id: string;
  name: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        name={name}
        required
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
        {children}
      </select>
    </div>
  );
}
