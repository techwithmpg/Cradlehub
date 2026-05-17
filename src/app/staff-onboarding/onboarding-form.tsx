"use client";

import { useState, useTransition, useRef, useCallback } from "react";
import { submitStaffOnboardingAction, type OnboardingFormState } from "./actions";
import { ONBOARDING_ROLE_OPTIONS, getOnboardingRoleLabel } from "@/lib/staff/onboarding-roles";

// ── Types ─────────────────────────────────────────────────────────────────
type Branch = { id: string; name: string };


type WizardData = {
  accessCode: string;
  fullName: string;
  nickname: string;
  email: string;
  phone: string;
  address: string;
  profilePicture: File | null;
  profilePreviewUrl: string | null;
  preferredBranchId: string;
  preferredRole: string;
  serviceIds: string[];
  emergencyContactName: string;
  emergencyContactPhone: string;
  experienceNotes: string;
  password: string;
  confirmPassword: string;
  consent: boolean;
};

const INITIAL_DATA: WizardData = {
  accessCode: "",
  fullName: "", nickname: "", email: "", phone: "", address: "",
  profilePicture: null, profilePreviewUrl: null,
  preferredBranchId: "", preferredRole: "", serviceIds: [],
  emergencyContactName: "", emergencyContactPhone: "", experienceNotes: "",
  password: "", confirmPassword: "",
  consent: false,
};

// ── Constants ──────────────────────────────────────────────────────────────
const STEPS = [
  { label: "Access",   icon: "🔐" },
  { label: "Profile",  icon: "👤" },
  { label: "Role",     icon: "💼" },
  { label: "Services", icon: "✂️" },
  { label: "Contact",  icon: "🆘" },
  { label: "Account",  icon: "🔒" },
  { label: "Review",   icon: "✅" },
];

// ── Helpers ────────────────────────────────────────────────────────────────
function passwordStrength(pw: string): { level: 0 | 1 | 2 | 3; label: string; color: string } {
  if (pw.length < 8) return { level: 0, label: "Too short", color: "#DC2626" };
  const checks = [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (checks >= 3 && pw.length >= 10) return { level: 3, label: "Strong", color: "#16A34A" };
  if (checks >= 2) return { level: 2, label: "Medium", color: "#D97706" };
  return { level: 1, label: "Weak", color: "#DC2626" };
}

// ── Sub-components ─────────────────────────────────────────────────────────
function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <span style={{ fontSize: "0.75rem", color: "#DC2626", marginTop: 2 }}>{msg}</span>;
}

function StepIndicator({ current }: { current: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: "2rem",
        gap: 0,
      }}
    >
      {STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={step.label} style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: done ? 16 : active ? 15 : 13,
                  fontWeight: 700,
                  backgroundColor: done
                    ? "var(--cs-success, #16A34A)"
                    : active
                    ? "var(--cs-sand)"
                    : "var(--cs-surface)",
                  border: `2px solid ${done ? "var(--cs-success, #16A34A)" : active ? "var(--cs-sand)" : "var(--cs-border)"}`,
                  color: done || active ? "#fff" : "var(--cs-text-muted)",
                  transition: "all 0.25s ease",
                  flexShrink: 0,
                }}
              >
                {done ? "✓" : step.icon}
              </div>
              <span
                style={{
                  fontSize: "0.625rem",
                  fontWeight: active ? 600 : 400,
                  color: active ? "var(--cs-sand)" : done ? "var(--cs-success, #16A34A)" : "var(--cs-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  whiteSpace: "nowrap",
                }}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                style={{
                  width: "clamp(16px, 4vw, 32px)",
                  height: 2,
                  backgroundColor: i < current ? "var(--cs-success, #16A34A)" : "var(--cs-border)",
                  marginBottom: 20,
                  transition: "background-color 0.25s ease",
                  flexShrink: 0,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step components ────────────────────────────────────────────────────────
function Step1Access({ data, onChange, errors }: {
  data: WizardData;
  onChange: (k: keyof WizardData, v: unknown) => void;
  errors: Record<string, string>;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ textAlign: "center", marginBottom: "0.5rem" }}>
        <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>🔐</div>
        <h2 style={{ fontFamily: "var(--font-playfair), serif", fontSize: "1.375rem", fontWeight: 600, color: "var(--cs-text)", margin: "0 0 0.375rem" }}>
          Enter Access Code
        </h2>
        <p style={{ fontSize: "0.875rem", color: "var(--cs-text-muted)", lineHeight: 1.5, margin: 0 }}>
          Your manager will have given you a code to begin this application.
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        <label htmlFor="accessCode" style={labelStyle}>Access code *</label>
        <input
          id="accessCode"
          type="password"
          autoComplete="off"
          autoFocus
          value={data.accessCode}
          onChange={(e) => onChange("accessCode", e.target.value)}
          placeholder="Enter code…"
          style={{
            ...inputStyle,
            fontSize: "1.25rem",
            letterSpacing: "0.2em",
            textAlign: "center",
          }}
        />
        <FieldError msg={errors.accessCode} />
      </div>
    </div>
  );
}

function Step2Profile({ data, onChange, errors }: {
  data: WizardData;
  onChange: (k: keyof WizardData, v: unknown) => void;
  errors: Record<string, string>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return;
    }
    if (file.size > 5 * 1024 * 1024) return;
    const url = URL.createObjectURL(file);
    onChange("profilePicture", file);
    onChange("profilePreviewUrl", url);
  }, [onChange]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.125rem" }}>
      <div style={{ textAlign: "center" }}>
        <h2 style={stepTitleStyle}>Personal Information</h2>
        <p style={stepSubStyle}>Tell us about yourself.</p>
      </div>

      {/* Photo upload */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
        <button
          type="button"
          onClick={handlePhotoClick}
          aria-label="Upload profile photo"
          style={{
            width: 88,
            height: 88,
            borderRadius: "50%",
            border: `2px dashed ${data.profilePreviewUrl ? "var(--cs-sand)" : "var(--cs-border)"}`,
            overflow: "hidden",
            cursor: "pointer",
            backgroundColor: "var(--cs-surface-warm)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            transition: "border-color 0.2s",
            flexShrink: 0,
          }}
        >
          {data.profilePreviewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.profilePreviewUrl}
              alt="Profile preview"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem" }}>📷</div>
              <div style={{ fontSize: "0.625rem", color: "var(--cs-text-muted)", marginTop: 2 }}>Add photo</div>
            </div>
          )}
        </button>
        <span style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
          {data.profilePreviewUrl ? "Tap to change" : "JPG, PNG or WebP · max 5 MB"}
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          style={{ display: "none" }}
          aria-hidden
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        <label htmlFor="fullName" style={labelStyle}>Full name *</label>
        <input id="fullName" style={inputStyle} value={data.fullName} onChange={(e) => onChange("fullName", e.target.value)} placeholder="Maria Santos" />
        <FieldError msg={errors.fullName} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        <label htmlFor="nickname" style={labelStyle}>Nickname</label>
        <input id="nickname" style={inputStyle} value={data.nickname} onChange={(e) => onChange("nickname", e.target.value)} placeholder="Example: Mia, Joy, Ate Rose" />
        <span style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
          Optional. This is the name clients may recognize during booking.
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        <label htmlFor="email" style={labelStyle}>Email address *</label>
        <input id="email" type="email" style={inputStyle} value={data.email} onChange={(e) => onChange("email", e.target.value)} placeholder="maria@example.com" />
        <FieldError msg={errors.email} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        <label htmlFor="phone" style={labelStyle}>Phone number *</label>
        <input id="phone" type="tel" style={inputStyle} value={data.phone} onChange={(e) => onChange("phone", e.target.value)} placeholder="+63 XXX XXX XXXX" />
        <FieldError msg={errors.phone} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        <label htmlFor="address" style={labelStyle}>Address</label>
        <input id="address" style={inputStyle} value={data.address} onChange={(e) => onChange("address", e.target.value)} placeholder="Street, City, Province" />
      </div>
    </div>
  );
}

function Step3Role({ data, onChange, branches, errors }: {
  data: WizardData;
  onChange: (k: keyof WizardData, v: unknown) => void;
  branches: Branch[];
  errors: Record<string, string>;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ textAlign: "center" }}>
        <h2 style={stepTitleStyle}>Role &amp; Branch</h2>
        <p style={stepSubStyle}>What role are you applying for?</p>
      </div>

      {/* Role cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        <span style={labelStyle}>Preferred role *</span>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.625rem", marginTop: 2 }}>
          {ONBOARDING_ROLE_OPTIONS.map((role) => {
            const selected = data.preferredRole === role.value;
            return (
              <button
                key={role.value}
                type="button"
                onClick={() => onChange("preferredRole", role.value)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.375rem",
                  padding: "0.875rem 0.5rem",
                  borderRadius: 10,
                  border: `2px solid ${selected ? "var(--cs-sand)" : "var(--cs-border)"}`,
                  backgroundColor: selected ? "rgba(180,148,111,0.08)" : "var(--cs-surface)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  gridColumn: ["other", "managerial", "salon_head"].includes(role.value) ? "1 / -1" : undefined,
                }}
              >
                <span style={{ fontSize: "1.75rem" }}>{role.icon}</span>
                <span style={{ fontSize: "0.875rem", fontWeight: 600, color: selected ? "var(--cs-sand)" : "var(--cs-text)" }}>
                  {role.label}
                </span>
                <span style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)" }}>{role.sublabel}</span>
              </button>
            );
          })}
        </div>
        <FieldError msg={errors.preferredRole} />
      </div>

      {/* Branch selector — only show if multiple branches */}
      {branches.length > 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <label htmlFor="branch" style={labelStyle}>Preferred branch</label>
          <select
            id="branch"
            title="Preferred branch"
            value={data.preferredBranchId}
            onChange={(e) => onChange("preferredBranchId", e.target.value)}
            style={selectStyle}
          >
            <option value="">No preference</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

function Step4Services({ data }: {
  data: WizardData;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ textAlign: "center" }}>
        <h2 style={stepTitleStyle}>Services You Offer</h2>
        <p style={stepSubStyle}>
          Choose the services you can confidently perform. A manager will review and confirm before your profile becomes fully active.
        </p>
      </div>

      <div
        style={{
          padding: "0.75rem",
          backgroundColor: "var(--cs-surface-warm)",
          borderRadius: 8,
          fontSize: "0.8125rem",
          color: "var(--cs-text-muted)",
          lineHeight: 1.5,
        }}
      >
        <strong style={{ color: "var(--cs-text)" }}>Tip:</strong> If you are unsure, leave this empty and a manager will assign services during your review.
        You will still be visible for booking under legacy scheduling until specialization is configured.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <span style={labelStyle}>Selected: {data.serviceIds.length} service(s)</span>
        <div
          style={{
            padding: "0.75rem",
            backgroundColor: "var(--cs-surface)",
            border: "1px solid var(--cs-border)",
            borderRadius: 8,
            fontSize: "0.8125rem",
            color: "var(--cs-text-muted)",
          }}
        >
          Service selection will be enabled once your application is submitted and reviewed by a manager.
          For now, your preferred role is recorded and services will be assigned during approval.
        </div>
      </div>
    </div>
  );
}

function Step4Emergency({ data, onChange }: {
  data: WizardData;
  onChange: (k: keyof WizardData, v: unknown) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ textAlign: "center" }}>
        <h2 style={stepTitleStyle}>Emergency Contact</h2>
        <p style={stepSubStyle}>Who should we contact in an emergency?</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        <label htmlFor="ecName" style={labelStyle}>Contact name</label>
        <input id="ecName" style={inputStyle} value={data.emergencyContactName} onChange={(e) => onChange("emergencyContactName", e.target.value)} placeholder="Juan Santos" />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        <label htmlFor="ecPhone" style={labelStyle}>Contact phone</label>
        <input id="ecPhone" type="tel" style={inputStyle} value={data.emergencyContactPhone} onChange={(e) => onChange("emergencyContactPhone", e.target.value)} placeholder="+63 XXX XXX XXXX" />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        <label htmlFor="expNotes" style={labelStyle}>Experience &amp; background</label>
        <textarea
          id="expNotes"
          rows={4}
          value={data.experienceNotes}
          onChange={(e) => onChange("experienceNotes", e.target.value)}
          placeholder="Tell us about your relevant experience, certifications, or anything you'd like us to know…"
          style={{
            ...inputStyle,
            height: "auto",
            resize: "vertical",
            lineHeight: 1.55,
            paddingTop: "0.625rem",
            paddingBottom: "0.625rem",
          }}
        />
      </div>
    </div>
  );
}

function Step5Account({ data, onChange, errors }: {
  data: WizardData;
  onChange: (k: keyof WizardData, v: unknown) => void;
  errors: Record<string, string>;
}) {
  const strength = data.password ? passwordStrength(data.password) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ textAlign: "center" }}>
        <h2 style={stepTitleStyle}>Create Your Password</h2>
        <p style={stepSubStyle}>You&apos;ll use this to log in once your account is approved.</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        <label htmlFor="password" style={labelStyle}>Password *</label>
        <input
          id="password"
          type="password"
          style={inputStyle}
          value={data.password}
          onChange={(e) => onChange("password", e.target.value)}
          placeholder="Min. 8 characters"
        />
        {/* Strength meter */}
        {data.password && strength && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 2 }}>
            <div style={{ display: "flex", gap: 4 }}>
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: n <= strength.level ? strength.color : "var(--cs-border)",
                    transition: "background-color 0.2s",
                  }}
                />
              ))}
            </div>
            <span style={{ fontSize: "0.75rem", color: strength.color, fontWeight: 500 }}>
              {strength.label}
            </span>
          </div>
        )}
        <FieldError msg={errors.password} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        <label htmlFor="confirmPassword" style={labelStyle}>Confirm password *</label>
        <input
          id="confirmPassword"
          type="password"
          style={{
            ...inputStyle,
            borderColor: data.confirmPassword && data.password !== data.confirmPassword
              ? "#DC2626"
              : data.confirmPassword && data.password === data.confirmPassword
              ? "#16A34A"
              : undefined,
          }}
          value={data.confirmPassword}
          onChange={(e) => onChange("confirmPassword", e.target.value)}
          placeholder="Re-enter password"
        />
        {data.confirmPassword && data.password === data.confirmPassword && (
          <span style={{ fontSize: "0.75rem", color: "#16A34A", fontWeight: 500 }}>Passwords match ✓</span>
        )}
        <FieldError msg={errors.confirmPassword} />
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div style={{ display: "flex", gap: "0.5rem", fontSize: "0.8125rem", padding: "0.375rem 0", borderBottom: "1px solid var(--cs-border)" }}>
      <span style={{ color: "var(--cs-text-muted)", minWidth: 140, flexShrink: 0 }}>{label}</span>
      <span style={{ color: "var(--cs-text)", fontWeight: 500, wordBreak: "break-word" }}>{value || "—"}</span>
    </div>
  );
}

function Step6Review({ data, onChange, serverError, isPending, onSubmit }: {
  data: WizardData;
  onChange: (k: keyof WizardData, v: unknown) => void;
  serverError?: string;
  isPending: boolean;
  onSubmit: () => void;
}) {
  const roleLabel = getOnboardingRoleLabel(data.preferredRole);
  const serviceCount = data.serviceIds.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ textAlign: "center" }}>
        <h2 style={stepTitleStyle}>Review Your Application</h2>
        <p style={stepSubStyle}>Check everything before submitting.</p>
      </div>

      {/* Avatar preview */}
      {data.profilePreviewUrl && (
        <div style={{ display: "flex", justifyContent: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.profilePreviewUrl}
            alt="Profile"
            style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--cs-border)" }}
          />
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column" }}>
        <ReviewRow label="Full name"             value={data.fullName} />
        <ReviewRow label="Nickname"              value={data.nickname} />
        <ReviewRow label="Email"                 value={data.email} />
        <ReviewRow label="Phone"                 value={data.phone} />
        <ReviewRow label="Address"               value={data.address} />
        <ReviewRow label="Preferred role"        value={roleLabel} />
        <ReviewRow label="Services selected"     value={serviceCount > 0 ? `${serviceCount} service(s)` : "None selected — manager will assign during review"} />
        <ReviewRow label="Emergency contact"     value={data.emergencyContactName} />
        <ReviewRow label="Emergency phone"       value={data.emergencyContactPhone} />
        {data.experienceNotes && (
          <ReviewRow label="Experience notes" value={data.experienceNotes.slice(0, 80) + (data.experienceNotes.length > 80 ? "…" : "")} />
        )}
      </div>

      {serverError && (
        <div role="alert" style={{ padding: "0.75rem", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: "0.875rem", color: "#991B1B" }}>
          {serverError}
        </div>
      )}

      {/* Consent */}
      <label
        style={{ display: "flex", alignItems: "flex-start", gap: "0.625rem", cursor: "pointer", fontSize: "0.8125rem", color: "var(--cs-text-secondary)", lineHeight: 1.55 }}
      >
        <input
          type="checkbox"
          checked={data.consent}
          onChange={(e) => onChange("consent", e.target.checked)}
          style={{ marginTop: 3, flexShrink: 0 }}
        />
        I confirm that all information is accurate and I understand that my account
        will only be activated once approved by a manager or owner.
      </label>

      <button
        type="button"
        disabled={!data.consent || isPending}
        onClick={onSubmit}
        style={{
          width: "100%",
          padding: "0.875rem",
          borderRadius: 10,
          border: "none",
          backgroundColor: data.consent && !isPending ? "var(--cs-sand)" : "var(--cs-border)",
          color: data.consent && !isPending ? "#fff" : "var(--cs-text-muted)",
          fontSize: "1rem",
          fontWeight: 700,
          cursor: data.consent && !isPending ? "pointer" : "not-allowed",
          transition: "all 0.2s",
          letterSpacing: "0.02em",
        }}
      >
        {isPending ? "Submitting…" : "Submit Application 🚀"}
      </button>
    </div>
  );
}

// ── Shared styles ──────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: "100%",
  height: "2.5rem",
  padding: "0 0.75rem",
  borderRadius: 8,
  border: "1px solid var(--cs-border)",
  backgroundColor: "var(--cs-surface)",
  color: "var(--cs-text)",
  fontSize: "0.9375rem",
  fontFamily: "inherit",
  boxSizing: "border-box",
  outline: "none",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.8125rem",
  fontWeight: 600,
  color: "var(--cs-text-secondary)",
};

const stepTitleStyle: React.CSSProperties = {
  fontFamily: "var(--font-playfair), serif",
  fontSize: "1.375rem",
  fontWeight: 600,
  color: "var(--cs-text)",
  margin: "0 0 0.375rem",
};

const stepSubStyle: React.CSSProperties = {
  fontSize: "0.875rem",
  color: "var(--cs-text-muted)",
  lineHeight: 1.5,
  margin: 0,
};

// ── Main wizard ────────────────────────────────────────────────────────────
export function StaffOnboardingForm({ branches }: { branches: Branch[] }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(INITIAL_DATA);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | undefined>();
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  const update = useCallback((key: keyof WizardData, value: unknown) => {
    setData((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => { const next = { ...prev }; delete next[key]; return next; });
  }, []);

  // Per-step validation
  function validate(): boolean {
    const errs: Record<string, string> = {};

    if (step === 0) {
      if (!data.accessCode.trim()) errs.accessCode = "Access code is required";
    }
    if (step === 1) {
      if (!data.fullName.trim()) errs.fullName = "Full name is required";
      if (!data.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errs.email = "Valid email is required";
      if (!data.phone.trim()) errs.phone = "Phone number is required";
    }
    if (step === 2) {
      if (!data.preferredRole) errs.preferredRole = "Please choose a role";
    }
    if (step === 4) {
      // Services step is optional — no validation required
    }
    if (step === 5) {
      if (data.password.length < 8) errs.password = "Password must be at least 8 characters";
      if (data.password !== data.confirmPassword) errs.confirmPassword = "Passwords do not match";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleNext() {
    if (!validate()) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function handleBack() {
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
  }

  function handleSubmit() {
    setServerError(undefined);
    const fd = new FormData();
    fd.append("accessCode",           data.accessCode);
    fd.append("fullName",             data.fullName);
    fd.append("nickname",             data.nickname);
    fd.append("email",                data.email);
    fd.append("phone",                data.phone);
    fd.append("address",              data.address);
    fd.append("preferredBranchId",    data.preferredBranchId);
    fd.append("preferredRole",        data.preferredRole);
    data.serviceIds.forEach((id) => fd.append("serviceIds", id));
    fd.append("emergencyContactName", data.emergencyContactName);
    fd.append("emergencyContactPhone",data.emergencyContactPhone);
    fd.append("experienceNotes",      data.experienceNotes);
    fd.append("password",             data.password);
    fd.append("confirmPassword",      data.confirmPassword);
    fd.append("consent",              "on");
    if (data.profilePicture) fd.append("profilePicture", data.profilePicture);

    startTransition(async () => {
      const result = await submitStaffOnboardingAction({} as OnboardingFormState, fd);
      if (result.success) {
        setSubmitted(true);
      } else if (result.error) {
        setServerError(result.error);
      }
    });
  }

  // ── Success screen ─────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div
        style={{
          backgroundColor: "var(--cs-surface)",
          border: "1px solid var(--cs-border)",
          borderRadius: 16,
          padding: "2.5rem 1.5rem",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "3rem", marginBottom: "0.875rem" }}>🎉</div>
        <h2 style={{ fontFamily: "var(--font-playfair), serif", fontSize: "1.5rem", fontWeight: 600, color: "var(--cs-text)", marginBottom: "0.625rem" }}>
          Application Submitted!
        </h2>
        <p style={{ fontSize: "0.9375rem", color: "var(--cs-text-muted)", lineHeight: 1.65, maxWidth: 380, margin: "0 auto 2rem" }}>
          Great, {data.fullName.split(" ")[0]}! Your application is now pending review. A manager will activate your account — you&apos;ll be able to log in once approved.
        </p>
        <a
          href="/login"
          style={{
            display: "inline-block",
            padding: "10px 24px",
            borderRadius: 10,
            backgroundColor: "var(--cs-sand)",
            color: "#fff",
            fontSize: "0.9375rem",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Go to Login
        </a>
      </div>
    );
  }

  // ── Wizard card ────────────────────────────────────────────────────────
  return (
    <div
      style={{
        backgroundColor: "var(--cs-surface)",
        border: "1px solid var(--cs-border)",
        borderRadius: 16,
        padding: "1.75rem 1.5rem 1.5rem",
      }}
    >
      <StepIndicator current={step} />

      {/* Step content */}
      <div style={{ minHeight: 320 }}>
        {step === 0 && <Step1Access  data={data} onChange={update} errors={errors} />}
        {step === 1 && <Step2Profile data={data} onChange={update} errors={errors} />}
        {step === 2 && <Step3Role    data={data} onChange={update} branches={branches} errors={errors} />}
        {step === 3 && <Step4Services data={data} />}
        {step === 4 && <Step4Emergency data={data} onChange={update} />}
        {step === 5 && <Step5Account data={data} onChange={update} errors={errors} />}
        {step === 6 && (
          <Step6Review
            data={data}
            onChange={update}
            serverError={serverError}
            isPending={isPending}
            onSubmit={handleSubmit}
          />
        )}
      </div>

      {/* Navigation */}
      {step < 6 && (
        <div
          style={{
            display: "flex",
            justifyContent: step === 0 ? "flex-end" : "space-between",
            marginTop: "1.5rem",
            paddingTop: "1rem",
            borderTop: "1px solid var(--cs-border)",
          }}
        >
          {step > 0 && (
            <button
              type="button"
              onClick={handleBack}
              style={{
                padding: "9px 20px",
                borderRadius: 8,
                border: "1px solid var(--cs-border)",
                backgroundColor: "var(--cs-surface)",
                color: "var(--cs-text-secondary)",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              ← Back
            </button>
          )}
          <button
            type="button"
            onClick={handleNext}
            style={{
              padding: "9px 24px",
              borderRadius: 8,
              border: "none",
              backgroundColor: "var(--cs-sand)",
              color: "#fff",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {step === 5 ? "Review Application →" : "Continue →"}
          </button>
        </div>
      )}
    </div>
  );
}
