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
    <div style={{
      minHeight:       "100vh",
      backgroundColor: "var(--cs-warm-white)",
      display:         "flex",
      alignItems:      "center",
      justifyContent:  "center",
      padding:         "2rem 1rem",
    }}>
      <div style={{ width: "100%", maxWidth: 400 }}>

        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <div style={{
            width: 56, height: 56, borderRadius: "var(--cs-radius-lg)",
            background: "linear-gradient(135deg, var(--cs-sand), var(--cs-clay))",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 1.125rem",
            boxShadow: "var(--cs-shadow-md)",
          }}>
            <span style={{
              color: "#fff", fontSize: 24, fontWeight: 700,
              fontFamily: "var(--font-display)",
            }}>C</span>
          </div>
          <h1 style={{
            fontSize:   "1.625rem",
            fontWeight: 600,
            color:      "var(--cs-text)",
            marginBottom: "0.375rem",
            fontFamily: "var(--font-display)",
          }}>
            Welcome back
          </h1>
          <p style={{ fontSize: "0.875rem", color: "var(--cs-text-muted)" }}>
            Sign in to your Cradle Spa workspace
          </p>
        </div>

        {/* Card */}
        <div style={{
          backgroundColor: "var(--cs-surface)",
          borderRadius:    "var(--cs-radius-xl)",
          padding:         "2rem",
          boxShadow:       "var(--cs-shadow-lg)",
          border:          "1px solid var(--cs-border-light)",
        }}>
          <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "1.125rem" }}>

            {state.error && (
              <div style={{
                padding: "0.75rem 1rem",
                backgroundColor: "var(--cs-error-light)",
                border: "1px solid #E8B8B0",
                borderRadius: "var(--cs-radius-sm)",
                fontSize: "0.875rem",
                color: "#8A3A2A",
              }}>
                {state.error}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <Label htmlFor="email" style={{ color: "var(--cs-text-secondary)", fontSize: "0.875rem" }}>
                Email address
              </Label>
              <Input id="email" name="email" type="email" autoComplete="email" autoFocus
                placeholder="you@cradlespa.com"
                style={{ borderColor: "var(--cs-border)" }}
              />
              {state.fieldErrors?.email && (
                <p style={{ fontSize: "0.8125rem", color: "var(--cs-error)", margin: 0 }}>
                  {state.fieldErrors.email}
                </p>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <Label htmlFor="password" style={{ color: "var(--cs-text-secondary)", fontSize: "0.875rem" }}>
                Password
              </Label>
              <Input id="password" name="password" type="password" autoComplete="current-password"
                placeholder="••••••••"
                style={{ borderColor: "var(--cs-border)" }}
              />
              {state.fieldErrors?.password && (
                <p style={{ fontSize: "0.8125rem", color: "var(--cs-error)", margin: 0 }}>
                  {state.fieldErrors.password}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={pending}
              style={{
                width:           "100%",
                marginTop:       "0.375rem",
                height:          44,
                background:      "linear-gradient(135deg, var(--cs-sand), var(--cs-clay))",
                color:           "#fff",
                border:          "none",
                borderRadius:    "var(--cs-radius-md)",
                fontSize:        "0.9375rem",
                fontWeight:      600,
                opacity:         pending ? 0.7 : 1,
                boxShadow:       pending ? "none" : "0 4px 12px rgba(166,123,91,0.3)",
              }}
            >
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>

        <p style={{
          textAlign: "center",
          fontSize:  "0.8125rem",
          color:     "var(--cs-text-muted)",
          marginTop: "1.5rem",
        }}>
          Cradle Massage &amp; Wellness Spa — Staff Portal
        </p>
      </div>
    </div>
  );
}
