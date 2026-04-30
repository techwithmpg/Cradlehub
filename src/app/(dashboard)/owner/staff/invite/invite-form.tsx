"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateInviteAction } from "../actions";
import type { Database } from "@/types/supabase";

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];

type InviteState = {
  success?: boolean;
  error?: string;
  staffId?: string;
};

const initialState: InviteState = {};

export function InviteForm({ branches }: { branches: BranchRow[] }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const [state, formAction, pending] = useActionState(
    async (_prev: InviteState, formData: FormData): Promise<InviteState> => {
      const result = await generateInviteAction({
        branchId: String(formData.get("branchId") ?? ""),
        email: String(formData.get("email") ?? ""),
      });
      return result as InviteState;
    },
    initialState
  );

  const inviteLink = state.staffId
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/onboard/${state.staffId}`
    : null;

  function handleCopy() {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div
      style={{
        backgroundColor: "var(--cs-surface)",
        border: "1px solid var(--cs-border)",
        borderRadius: 12,
        padding: "1.5rem",
      }}
    >
      {state.error && (
        <div
          style={{
            padding: "0.75rem",
            backgroundColor: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: 8,
            fontSize: "0.875rem",
            color: "#991B1B",
            marginBottom: "1rem",
          }}
        >
          {state.error}
        </div>
      )}

      {state.success && inviteLink && (
        <div
          style={{
            padding: "1rem",
            backgroundColor: "var(--cs-sage-light)",
            border: "1px solid var(--cs-sage)",
            borderRadius: 8,
            marginBottom: "1.5rem",
          }}
        >
          <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--cs-sage)", marginBottom: "0.5rem" }}>
            ✅ Invite link generated
          </div>
          <div
            style={{
              padding: "0.625rem 0.75rem",
              backgroundColor: "var(--cs-surface)",
              borderRadius: 6,
              fontSize: "0.8125rem",
              fontFamily: "monospace",
              wordBreak: "break-all",
              color: "var(--cs-text)",
              marginBottom: "0.75rem",
            }}
          >
            {inviteLink}
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Button
              type="button"
              onClick={handleCopy}
              size="sm"
              style={{ backgroundColor: "var(--cs-sand)", color: "#fff", border: "none" }}
            >
              {copied ? "Copied!" : "Copy Link"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.push("/owner/staff?tab=pending")}
            >
              View Pending
            </Button>
          </div>
        </div>
      )}

      {!state.success && (
        <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <Label htmlFor="email">Email (optional)</Label>
            <Input id="email" name="email" type="email" placeholder="maria@cradlespa.com" />
            <p style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", margin: 0 }}>
              If provided, you can share this with the staff member for reference.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <Label htmlFor="branchId">Branch *</Label>
            <select
              id="branchId"
              name="branchId"
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
              <option value="">Select branch…</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div
            style={{
              padding: "0.75rem",
              backgroundColor: "var(--cs-surface-warm)",
              border: "1px solid var(--cs-border-light)",
              borderRadius: 8,
              fontSize: "0.8125rem",
              color: "var(--cs-text-muted)",
            }}
          >
            <strong style={{ color: "var(--cs-text)" }}>How it works:</strong>
            <ol style={{ margin: "0.5rem 0 0", paddingLeft: "1.25rem", lineHeight: 1.5 }}>
              <li>Generate a unique invite link</li>
              <li>Share the link with the new staff member</li>
              <li>They fill in their details and create a password</li>
              <li>They appear in Pending Approvals for you to review</li>
              <li>Approve them and assign their final role, tier, and branch</li>
            </ol>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              style={{ flex: 1 }}
            >
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
              {pending ? "Generating…" : "Generate Invite Link"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
