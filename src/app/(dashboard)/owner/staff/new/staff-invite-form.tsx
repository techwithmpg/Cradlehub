"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createStaffAction } from "@/app/(dashboard)/owner/staff/actions";
import {
  STAFF_TYPE_OPTIONS,
  SYSTEM_ROLE_OPTIONS,
  isServiceStaffType,
  isStaffType,
  isSystemRole,
  type StaffType,
} from "@/constants/staff";
import type { Database } from "@/types/supabase";

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];
type ServiceRow = Database["public"]["Tables"]["services"]["Row"] & {
  service_categories: { id: string; name: string } | null;
};
type Tier = "senior" | "mid" | "junior" | "head" | "n/a";

type StaffActionState = {
  success?: boolean;
  error?: string;
};

const initialState: StaffActionState = {};

function isTier(value: string): value is Tier {
  return (
    value === "senior" ||
    value === "mid" ||
    value === "junior" ||
    value === "head" ||
    value === "n/a"
  );
}

function resolveStaffType(value: string): StaffType | "" {
  return isStaffType(value) ? value : "";
}

function optionalString(value: FormDataEntryValue | null): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function InviteStaffForm({
  branches,
  services,
}: {
  branches: BranchRow[];
  services: ServiceRow[];
}) {
  const router = useRouter();
  const [selectedStaffType, setSelectedStaffType] = useState<StaffType | "">("");
  const showServiceCapabilities = isServiceStaffType(selectedStaffType);

  const [state, formAction, pending] = useActionState(
    async (_prev: StaffActionState, formData: FormData): Promise<StaffActionState> => {
      const tierValue = String(formData.get("tier") ?? "");
      const roleValue = String(formData.get("systemRole") ?? "");
      const typeValue = String(formData.get("staffType") ?? "");

      if (!isTier(tierValue) || !isSystemRole(roleValue) || !isStaffType(typeValue)) {
        return { success: false, error: "Please select valid access, tier, and staff function." };
      }

      const serviceIds = isServiceStaffType(typeValue)
        ? formData.getAll("serviceIds").map((v) => String(v))
        : [];

      const result = await createStaffAction({
        branchId: String(formData.get("branchId") ?? ""),
        fullName: String(formData.get("fullName") ?? ""),
        nickname: optionalString(formData.get("nickname")),
        email: String(formData.get("email") ?? ""),
        phone: String(formData.get("phone") ?? "") || undefined,
        tier: tierValue,
        systemRole: roleValue,
        staffType: typeValue,
        isHead: formData.get("isHead") === "on",
        serviceIds,
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

        <SectionHeader
          title="Organization & Access"
          description="Set workspace access separately from the staff member's operational function."
        />

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <Label htmlFor="fullName">Full name *</Label>
          <Input id="fullName" name="fullName" placeholder="Maria Santos" required />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <Label htmlFor="nickname">Nickname</Label>
          <Input id="nickname" name="nickname" placeholder="Example: Mia, Joy, Ate Rose" />
          <p style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", margin: 0 }}>
            Optional. This is the name clients may recognize during booking.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <Label htmlFor="email">Email address *</Label>
          <Input id="email" name="email" type="email" placeholder="maria@cradlespa.com" required />
          <p style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", margin: 0 }}>
            An invite link will be sent to this email address
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <Label htmlFor="phone">Phone (optional)</Label>
          <Input id="phone" name="phone" type="tel" placeholder="+63 XXX XXX XXXX" />
        </div>

        <SelectField id="branchId" name="branchId" label="Branch *" helpText="Primary branch assignment.">
          <option value="">Select branch...</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </SelectField>

        <SelectField
          id="systemRole"
          name="systemRole"
          label="Workspace Access *"
          helpText="Controls which workspace this staff member can enter."
        >
          <option value="">Select role...</option>
          {SYSTEM_ROLE_OPTIONS.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </SelectField>

        <SelectField
          id="staffType"
          name="staffType"
          label="Staff Function *"
          helpText="Controls what kind of work this person performs."
          onChange={(event) => setSelectedStaffType(resolveStaffType(event.currentTarget.value))}
        >
          <option value="">Select staff function...</option>
          {STAFF_TYPE_OPTIONS.map((staffType) => (
            <option key={staffType.value} value={staffType.value}>
              {staffType.label}
            </option>
          ))}
        </SelectField>

        <label
          htmlFor="isHead"
          style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", fontSize: "0.875rem" }}
        >
          <input id="isHead" name="isHead" type="checkbox" />
          <span>
            <span style={{ display: "block", fontWeight: 600 }}>Head / Supervisor</span>
            <span style={{ display: "block", color: "var(--cs-text-muted)", fontSize: "0.75rem" }}>
              Use this for head therapist, head driver, head CSR, or other supervisor positions.
            </span>
          </span>
        </label>

        <SelectField id="tier" name="tier" label="Tier *">
          <option value="">Select tier...</option>
          <option value="senior">Senior Therapist</option>
          <option value="mid">Mid Therapist</option>
          <option value="junior">Junior Therapist</option>
          <option value="head">Head / Supervisor</option>
          <option value="n/a">N/A (non-service role)</option>
        </SelectField>

        {showServiceCapabilities && (
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
              Service Capability
            </legend>
            <p style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", margin: "0 0 0.75rem" }}>
              Assign only the spa services this service provider can perform.
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
                    {catServices.map((service) => (
                      <label
                        key={service.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.375rem",
                          fontSize: "0.8125rem",
                          cursor: "pointer",
                        }}
                      >
                        <input type="checkbox" name="serviceIds" value={service.id} />
                        {service.name}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </fieldset>
        )}

        <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
          <Button type="button" variant="outline" onClick={() => router.back()} style={{ flex: 1 }}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={pending}
            style={{
              flex: 1,
              backgroundColor: "var(--cs-sand)",
              color: "#fff",
              border: "none",
              opacity: pending ? 0.7 : 1,
            }}
          >
            {pending ? "Sending invite..." : "Send Invite"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div style={{ borderBottom: "1px solid var(--cs-border-soft)", paddingBottom: "0.75rem" }}>
      <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--cs-text)" }}>{title}</h2>
      <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "var(--cs-text-muted)" }}>
        {description}
      </p>
    </div>
  );
}

function SelectField({
  id,
  name,
  label,
  helpText,
  children,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  helpText?: string;
  children: React.ReactNode;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <Label htmlFor={id}>{label}</Label>
      {helpText && (
        <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>{helpText}</p>
      )}
      <select
        id={id}
        name={name}
        required
        onChange={onChange}
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
        {children}
      </select>
    </div>
  );
}
