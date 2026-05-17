"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { updateStaffAction } from "@/app/(dashboard)/owner/staff/actions";
import { STAFF_TYPES, STAFF_TYPE_LABELS } from "@/constants/staff";
import type { Database } from "@/types/supabase";
import type { StaffMember } from "./staff-management-utils";

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];
type ServiceRow = Database["public"]["Tables"]["services"]["Row"] & {
  service_categories: { id: string; name: string } | null;
};
type Tier = "senior" | "mid" | "junior" | "head" | "n/a";
type StaffRole = "manager" | "crm" | "csr" | "csr_head" | "csr_staff" | "staff" | "driver";
type StaffType = (typeof STAFF_TYPES)[number];

type StaffActionState = {
  success?: boolean;
  error?: string;
};

const initialState: StaffActionState = {};

const OWNER_ROLE_OPTIONS: { value: StaffRole; label: string }[] = [
  { value: "manager", label: "Manager" },
  { value: "crm", label: "CRM" },
  { value: "csr_head", label: "CSR Head" },
  { value: "csr_staff", label: "CSR Staff" },
  { value: "csr", label: "CSR (legacy)" },
  { value: "staff", label: "Staff" },
  { value: "driver", label: "Driver" },
];

const MANAGER_ROLE_OPTIONS: { value: StaffRole; label: string }[] = [
  { value: "crm", label: "CRM" },
  { value: "csr_head", label: "CSR Head" },
  { value: "csr_staff", label: "CSR Staff" },
  { value: "csr", label: "CSR (legacy)" },
  { value: "staff", label: "Staff" },
];

const SENSITIVE_SYSTEM_ROLES = new Set([
  "owner",
  "manager",
  "assistant_manager",
  "store_manager",
  "super_admin",
  "platform_admin",
]);

function optionalString(formValue: FormDataEntryValue | null): string | undefined {
  const value = String(formValue ?? "").trim();
  return value.length > 0 ? value : undefined;
}

function nullableOptionalString(formValue: FormDataEntryValue | null): string | null {
  const value = String(formValue ?? "").trim();
  return value.length > 0 ? value : null;
}

function isTier(value: string): value is Tier {
  return value === "senior" || value === "mid" || value === "junior" || value === "head" || value === "n/a";
}

function isStaffRole(value: string): value is StaffRole {
  return OWNER_ROLE_OPTIONS.some((r) => r.value === value);
}

function isStaffType(value: string): value is StaffType {
  return STAFF_TYPES.includes(value as StaffType);
}

export function StaffEditForm({
  staffMember,
  branches,
  services,
  staffServiceIds,
  workspaceContext = "owner",
}: {
  staffMember: StaffMember;
  branches: BranchRow[];
  services: ServiceRow[];
  staffServiceIds: string[];
  workspaceContext?: "owner" | "manager";
}) {
  const isManager = workspaceContext === "manager";
  const isProtected = isManager && SENSITIVE_SYSTEM_ROLES.has(staffMember.system_role);
  const roleOptions = isManager ? MANAGER_ROLE_OPTIONS : OWNER_ROLE_OPTIONS;

  const [state, formAction, pending] = useActionState(
    async (_prev: StaffActionState, formData: FormData): Promise<StaffActionState> => {
      const tierValue = String(formData.get("tier") ?? "");
      const roleValue = String(formData.get("systemRole") ?? "");
      const typeValue = String(formData.get("staffType") ?? "");

      if (!isTier(tierValue) || !isStaffRole(roleValue) || !isStaffType(typeValue)) {
        return { success: false, error: "Please select valid role, tier, and job function." };
      }

      const serviceIds = formData.getAll("serviceIds").map((v) => String(v));

      const branchIdRaw = String(formData.get("branchId") ?? "").trim();
      const result = await updateStaffAction({
        staffId: staffMember.id,
        fullName: String(formData.get("fullName") ?? "").trim(),
        nickname: nullableOptionalString(formData.get("nickname")),
        phone: optionalString(formData.get("phone")),
        tier: tierValue,
        systemRole: roleValue,
        staffType: typeValue,
        isHead: formData.get("isHead") === "on",
        branchId: branchIdRaw.length > 0 ? branchIdRaw : undefined,
        isActive: formData.get("isActive") === "on",
        serviceIds: serviceIds.length > 0 ? serviceIds : undefined,
      });

      return {
        success: result.success,
        error: result.error,
      };
    },
    initialState
  );

  const groupedServices = services.reduce<Record<string, ServiceRow[]>>((acc, s) => {
    const catName = s.service_categories?.name ?? "Uncategorized";
    const list = acc[catName] ?? [];
    list.push(s);
    acc[catName] = list;
    return acc;
  }, {});

  return (
    <div
      style={{
        backgroundColor: "var(--cs-surface)",
        border: "1px solid var(--cs-border)",
        borderRadius: 12,
        padding: "1.5rem",
      }}
    >
      {isProtected ? (
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
          This action requires owner approval.
        </div>
      ) : (
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
          <EditField
            label="Nickname"
            name="nickname"
            defaultValue={staffMember.nickname ?? ""}
            placeholder="Example: Mia, Joy, Ate Rose"
            helperText="Optional. This is the name clients may recognize during booking."
          />
          <EditField label="Phone" name="phone" defaultValue={staffMember.phone ?? ""} />

          <SelectField
            id="branchId"
            name="branchId"
            label="Branch"
            defaultValue={staffMember.branch_id ?? ""}
            disabled={isManager}
          >
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </SelectField>

          <SelectField
            id="systemRole"
            name="systemRole"
            label="System access role"
            defaultValue={staffMember.system_role}
          >
            {roleOptions.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </SelectField>

          <SelectField id="staffType" name="staffType" label="Job function" defaultValue={staffMember.staff_type}>
            {STAFF_TYPES.map((t) => (
              <option key={t} value={t}>
                {STAFF_TYPE_LABELS[t]}
              </option>
            ))}
          </SelectField>

          <label
            htmlFor="isHead"
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem" }}
          >
            <input id="isHead" name="isHead" type="checkbox" defaultChecked={staffMember.is_head} />
            Department head / supervisor
          </label>

          <SelectField id="tier" name="tier" label="Tier" defaultValue={staffMember.tier}>
            <option value="senior">Senior</option>
            <option value="mid">Mid</option>
            <option value="junior">Junior</option>
            <option value="head">Head</option>
            <option value="n/a">N/A</option>
          </SelectField>

          <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
            <legend
              style={{
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "var(--cs-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "0.5rem",
              }}
            >
              Service capabilities
            </legend>
            <p style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", margin: "0 0 0.75rem" }}>
              If left empty, this staff member will temporarily remain available under the legacy
              scheduling behavior until service specialization is fully configured.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {Object.entries(groupedServices).map(([category, catServices]) => (
                <div key={category}>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "var(--cs-text-muted)",
                      marginBottom: "0.375rem",
                    }}
                  >
                    {category}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.375rem" }}>
                    {catServices.map((s) => (
                      <label
                        key={s.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.375rem",
                          fontSize: "0.8125rem",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          name="serviceIds"
                          value={s.id}
                          defaultChecked={staffServiceIds.includes(s.id)}
                        />
                        {s.name}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </fieldset>

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
              backgroundColor: "var(--cs-sand)",
              color: "#fff",
              border: "none",
              opacity: pending ? 0.7 : 1,
            }}
          >
            {pending ? "Saving…" : "Save Staff"}
          </Button>
        </form>
      )}
    </div>
  );
}

function EditField({
  label,
  name,
  defaultValue,
  placeholder,
  helperText,
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder?: string;
  helperText?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <Label htmlFor={name}>{label}</Label>
      <input
        id={name}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        style={{
          height: 36,
          borderRadius: 6,
          border: "1px solid var(--cs-border)",
          padding: "0 0.5rem",
          fontSize: "0.875rem",
          backgroundColor: "var(--cs-surface)",
          color: "var(--cs-text)",
          width: "100%",
        }}
      />
      {helperText ? (
        <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>{helperText}</p>
      ) : null}
    </div>
  );
}

function SelectField({
  id,
  name,
  label,
  defaultValue,
  children,
  disabled,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        disabled={disabled}
        style={{
          height: 36,
          borderRadius: 6,
          border: "1px solid var(--cs-border)",
          padding: "0 0.5rem",
          fontSize: "0.875rem",
          backgroundColor: "var(--cs-surface)",
          color: "var(--cs-text)",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {children}
      </select>
    </div>
  );
}
