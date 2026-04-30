"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createStaffAction } from "@/app/(dashboard)/owner/staff/actions";
import { STAFF_TYPES, STAFF_TYPE_LABELS } from "@/constants/staff";
import type { Database } from "@/types/supabase";

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];
type ServiceRow = Database["public"]["Tables"]["services"]["Row"] & {
  service_categories: { id: string; name: string } | null;
};
type Tier = "senior" | "mid" | "junior";
type StaffRole = "manager" | "crm" | "staff";
type StaffType = (typeof STAFF_TYPES)[number];

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

function isStaffType(value: string): value is StaffType {
  return STAFF_TYPES.includes(value as StaffType);
}

export function InviteStaffForm({
  branches,
  services,
}: {
  branches: BranchRow[];
  services: ServiceRow[];
}) {
  const router = useRouter();

  const [state, formAction, pending] = useActionState(
    async (_prev: StaffActionState, formData: FormData): Promise<StaffActionState> => {
      const tierValue = String(formData.get("tier") ?? "");
      const roleValue = String(formData.get("systemRole") ?? "");
      const typeValue = String(formData.get("staffType") ?? "");

      if (!isTier(tierValue) || !isStaffRole(roleValue) || !isStaffType(typeValue)) {
        return { success: false, error: "Please select valid role, tier, and job function." };
      }

      const serviceIds = formData.getAll("serviceIds").map((v) => String(v));

      const result = await createStaffAction({
        branchId: String(formData.get("branchId") ?? ""),
        fullName: String(formData.get("fullName") ?? ""),
        email: String(formData.get("email") ?? ""),
        phone: String(formData.get("phone") ?? "") || undefined,
        tier: tierValue,
        systemRole: roleValue,
        staffType: typeValue,
        isHead: formData.get("isHead") === "on",
        serviceIds: serviceIds.length > 0 ? serviceIds : undefined,
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

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <Label htmlFor="fullName">Full name *</Label>
          <Input id="fullName" name="fullName" placeholder="Maria Santos" required />
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

        <SelectField id="branchId" name="branchId" label="Branch *">
          <option value="">Select branch…</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </SelectField>

        <SelectField id="systemRole" name="systemRole" label="System access role *">
          <option value="">Select role…</option>
          <option value="manager">Manager — daily schedule, walk-ins, bookings</option>
          <option value="crm">CRM — customer records and history</option>
          <option value="staff">Staff — own schedule and assigned bookings</option>
        </SelectField>

        <SelectField id="staffType" name="staffType" label="Job function *">
          <option value="">Select job function…</option>
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
          <input id="isHead" name="isHead" type="checkbox" />
          Department head / supervisor
        </label>

        <SelectField id="tier" name="tier" label="Tier *">
          <option value="">Select tier…</option>
          <option value="senior">Senior Therapist</option>
          <option value="mid">Mid Therapist</option>
          <option value="junior">Junior Therapist</option>
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
                      <input type="checkbox" name="serviceIds" value={s.id} />
                      {s.name}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </fieldset>

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
