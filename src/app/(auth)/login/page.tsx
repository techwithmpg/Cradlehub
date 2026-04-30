"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <div style={{
      minHeight:      "100vh",
      background:     "var(--cs-bg)",
      display:        "flex",
      alignItems:     "center",
      justifyContent: "center",
      padding:        "2rem 1rem",
    }}>
      <div style={{ width: "100%", maxWidth: 380 }}>

        {/* Brand mark */}
        <div style={{ textAlign: "center", marginBottom: "2.25rem" }}>
          <div style={{
            width:          48,
            height:         48,
            borderRadius:   "var(--cs-r-md)",
            background:     "linear-gradient(135deg, var(--cs-sand), var(--cs-sand-light))",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            margin:         "0 auto 14px",
            boxShadow:      "var(--cs-shadow-md)",
          }}>
            <span style={{
              color:         "#fff",
              fontSize:      20,
              fontWeight:    600,
              fontFamily:    "var(--cs-font-display)",
              letterSpacing: "0.05em",
            }}>
              C
            </span>
          </div>
          <h1 style={{
            fontSize:     18,
            fontWeight:   600,
            color:        "var(--cs-text)",
            marginBottom: "0.25rem",
            margin:       "0 0 0.25rem",
          }}>
            Welcome back
          </h1>
          <p style={{ fontSize: 13, color: "var(--cs-text-muted)", margin: 0 }}>
            Sign in to your workspace
          </p>
        </div>

        {/* Login card */}
        <div style={{
          background:    "var(--cs-surface)",
          borderRadius:  "var(--cs-r-xl)",
          padding:       "1.75rem",
          border:        "1px solid var(--cs-border-soft)",
          boxShadow:     "var(--cs-shadow-lg)",
        }}>
          <form action={formAction}>

            {state.error && (
              <div style={{
                padding:      "9px 12px",
                background:   "var(--cs-error-bg)",
                border:       "1px solid #E8CCCC",
                borderRadius: "var(--cs-r-sm)",
                fontSize:     12.5,
                color:        "var(--cs-error-text)",
                marginBottom: "1.125rem",
              }}>
                {state.error}
              </div>
            )}

            <div style={{ marginBottom: "1rem" }}>
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="you@cradlespa.com"
                style={{ marginTop: 4 }}
              />
              {state.fieldErrors?.email && (
                <p style={{ fontSize: 11.5, color: "var(--cs-error)", marginTop: 3, marginBottom: 0 }}>
                  {state.fieldErrors.email}
                </p>
              )}
            </div>

            <div style={{ marginBottom: "1.25rem" }}>
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                style={{ marginTop: 4 }}
              />
              {state.fieldErrors?.password && (
                <p style={{ fontSize: 11.5, color: "var(--cs-error)", marginTop: 3, marginBottom: 0 }}>
                  {state.fieldErrors.password}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={pending}
              className="cs-btn cs-btn-primary"
              style={{ width: "100%", height: 42, fontSize: 13.5 }}
            >
              {pending ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p style={{
          textAlign:  "center",
          fontSize:   11.5,
          color:      "var(--cs-text-subtle)",
          marginTop:  "1.25rem",
        }}>
          Cradle Massage &amp; Wellness Spa — Staff Portal
        </p>
      </div>
    </div>
  );
}
