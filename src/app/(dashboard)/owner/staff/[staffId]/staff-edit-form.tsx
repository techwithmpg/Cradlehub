"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateStaffAction } from "@/app/(dashboard)/owner/staff/actions";
import type { Database } from "@/types/supabase";

type StaffRow = Database["public"]["Tables"]["staff"]["Row"];
type BranchRow = Database["public"]["Tables"]["branches"]["Row"];
type Tier = "senior" | "mid" | "junior";
type StaffRole = "manager" | "crm" | "staff";

type StaffActionState = {
  success?: boolean;
  error?: string;
};

const initialState: StaffActionState = {};

function optionalString(formValue: FormDataEntryValue | null): string | undefined {
  const value = String(formValue ?? "").trim();
  return value.length > 0 ? value : undefined;
}

function isTier(value: string): value is Tier {
  return value === "senior" || value === "mid" || value === "junior";
}

function isStaffRole(value: string): value is StaffRole {
  return value === "manager" || value === "crm" || value === "staff";
}

export function StaffEditForm({
  staffMember,
  branches,
}: {
  staffMember: StaffRow;
  branches: BranchRow[];
}) {
  const [state, formAction, pending] = useActionState(
    async (_prev: StaffActionState, formData: FormData): Promise<StaffActionState> => {
      const tierValue = String(formData.get("tier") ?? "");
      const roleValue = String(formData.get("systemRole") ?? "");

      if (!isTier(tierValue) || !isStaffRole(roleValue)) {
        return { success: false, error: "Please select a valid role and tier." };
      }

      const result = await updateStaffAction({
        staffId: staffMember.id,
        fullName: String(formData.get("fullName") ?? "").trim(),
        phone: optionalString(formData.get("phone")),
        tier: tierValue,
        systemRole: roleValue,
        branchId: String(formData.get("branchId") ?? ""),
        isActive: formData.get("isActive") === "on",
      });

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
      <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
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
        {state.success && (
          <div
            style={{
              padding: "0.75rem",
              backgroundColor: "#F0FDF4",
              border: "1px solid #BBF7D0",
              borderRadius: 8,
              fontSize: "0.875rem",
              color: "#15803D",
            }}
          >
            Staff profile updated
          </div>
        )}

        <EditField label="Full name" name="fullName" defaultValue={staffMember.full_name} />
        <EditField label="Phone" name="phone" defaultValue={staffMember.phone ?? ""} />

        <SelectField id="branchId" name="branchId" label="Branch" defaultValue={staffMember.branch_id}>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </SelectField>

        <SelectField id="systemRole" name="systemRole" label="Role" defaultValue={staffMember.system_role}>
          <option value="manager">Manager</option>
          <option value="crm">CRM</option>
          <option value="staff">Staff</option>
        </SelectField>

        <SelectField id="tier" name="tier" label="Tier" defaultValue={staffMember.tier}>
          <option value="senior">Senior</option>
          <option value="mid">Mid</option>
          <option value="junior">Junior</option>
        </SelectField>

        <label
          htmlFor="is-active"
          style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem" }}
        >
          <input id="is-active" name="isActive" type="checkbox" defaultChecked={staffMember.is_active} />
          Active staff member
        </label>

        <Button
          type="submit"
          disabled={pending}
          style={{
            backgroundColor: "var(--ch-accent)",
            color: "#fff",
            border: "none",
            opacity: pending ? 0.7 : 1,
          }}
        >
          {pending ? "Saving…" : "Save Staff"}
        </Button>
      </form>
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
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} defaultValue={defaultValue} />
    </div>
  );
}

function SelectField({
  id,
  name,
  label,
  defaultValue,
  children,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
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
