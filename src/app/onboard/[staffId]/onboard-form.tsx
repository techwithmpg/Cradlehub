"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { onboardStaffAction } from "@/app/(dashboard)/owner/staff/actions";

type OnboardState = {
  success?: boolean;
  error?: string;
};

const initialState: OnboardState = {};

export function OnboardForm({ staffId }: { staffId: string }) {
  const [state, formAction, pending] = useActionState(
    async (_prev: OnboardState, formData: FormData): Promise<OnboardState> => {
      const password = String(formData.get("password") ?? "");
      const confirm = String(formData.get("confirmPassword") ?? "");
      if (password.length < 6) return { error: "Password must be at least 6 characters" };
      if (password !== confirm) return { error: "Passwords do not match" };

      const result = await onboardStaffAction({
        staffId,
        fullName: String(formData.get("fullName") ?? ""),
        email: String(formData.get("email") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        password,
      });
      return result as OnboardState;
    },
    initialState
  );

  if (state.success) {
    return (
      <div
        style={{
          backgroundColor: "var(--cs-sage-light)",
          border: "1px solid var(--cs-sage)",
          borderRadius: 10,
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🎉</div>
        <h3
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.125rem",
            fontWeight: 600,
            color: "var(--cs-text)",
            marginBottom: "0.5rem",
          }}
        >
          Application Submitted
        </h3>
        <p style={{ fontSize: "0.875rem", color: "var(--cs-text-muted)", lineHeight: 1.6, marginBottom: "1.25rem" }}>
          Your profile has been created and is now pending approval from the owner or manager.
          You will receive an email once your account is activated.
        </p>
        <a
          href="/login"
          style={{
            display: "inline-block",
            padding: "8px 16px",
            borderRadius: 6,
            backgroundColor: "var(--cs-sand)",
            color: "#fff",
            fontSize: "0.8125rem",
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          Go to Login
        </a>
      </div>
    );
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

      <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <Label htmlFor="fullName">Full name *</Label>
          <Input id="fullName" name="fullName" placeholder="Maria Santos" required />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <Label htmlFor="email">Email address *</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="maria@cradlespa.com"
            required
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <Label htmlFor="phone">Phone number *</Label>
          <Input id="phone" name="phone" type="tel" placeholder="+63 XXX XXX XXXX" required />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <Label htmlFor="password">Password *</Label>
          <Input id="password" name="password" type="password" placeholder="Min. 6 characters" required />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <Label htmlFor="confirmPassword">Confirm password *</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            placeholder="Re-enter password"
            required
          />
        </div>

        <Button
          type="submit"
          disabled={pending}
          style={{
            width: "100%",
            backgroundColor: "var(--cs-sand)",
            color: "#fff",
            border: "none",
            opacity: pending ? 0.7 : 1,
          }}
        >
          {pending ? "Submitting…" : "Submit Application"}
        </Button>
      </form>
    </div>
  );
}
