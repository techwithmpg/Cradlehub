"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <div style={{ width: "100%", maxWidth: 400 }}>
      {/* Brand mark */}
      <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: "var(--ch-accent)",
            marginBottom: "1rem",
          }}
        >
          <span style={{ color: "#fff", fontSize: 22, fontWeight: 600 }}>C</span>
        </div>
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 600,
            color: "var(--ch-text)",
            marginBottom: "0.25rem",
          }}
        >
          Welcome back
        </h1>
        <p style={{ fontSize: "0.875rem", color: "var(--ch-text-muted)" }}>
          Sign in to your CradleHub workspace
        </p>
      </div>

      {/* Card */}
      <div
        style={{
          backgroundColor: "var(--ch-surface)",
          border: "1px solid var(--ch-border)",
          borderRadius: 16,
          padding: "2rem",
        }}
      >
        <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Global error */}
          {state.error && (
            <div
              style={{
                padding: "0.75rem 1rem",
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

          {/* Email */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@cradlespa.com"
              aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
            />
            {state.fieldErrors?.email && (
              <p id="email-error" style={{ fontSize: "0.8125rem", color: "#DC2626" }}>
                {state.fieldErrors.email}
              </p>
            )}
          </div>

          {/* Password */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              aria-describedby={state.fieldErrors?.password ? "password-error" : undefined}
            />
            {state.fieldErrors?.password && (
              <p id="password-error" style={{ fontSize: "0.8125rem", color: "#DC2626" }}>
                {state.fieldErrors.password}
              </p>
            )}
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={pending}
            style={{
              width: "100%",
              backgroundColor: "var(--ch-accent)",
              color: "#fff",
              border: "none",
              marginTop: "0.25rem",
              opacity: pending ? 0.7 : 1,
            }}
          >
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>

      {/* Footer */}
      <p
        style={{
          textAlign: "center",
          fontSize: "0.8125rem",
          color: "var(--ch-text-subtle)",
          marginTop: "1.5rem",
        }}
      >
        Cradle Massage &amp; Wellness Spa — Staff Portal
      </p>
    </div>
  );
}
