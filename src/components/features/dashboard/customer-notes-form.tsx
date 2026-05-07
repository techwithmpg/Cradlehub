"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { updateCustomerAction } from "@/app/(dashboard)/crm/actions";

type StaffOption = { id: string; full_name: string; tier: string };

type Props = {
  customerId: string;
  initialFullName: string;
  initialPhone: string;
  initialEmail: string | null;
  initialNotes: string | null;
  initialPreferredStaffId: string | null;
  initialPreferredVisitType?: string | null;
  initialPressurePreference?: string | null;
  initialHealthNotes?: string | null;
  initialBirthday?: string | null;
  initialLoyaltyTier?: string | null;
  staff: StaffOption[];
};

type UpdateResult = { success: boolean; error?: string };

const SELECT_STYLE: React.CSSProperties = {
  width: "100%",
  height: 36,
  borderRadius: 6,
  border: "1px solid var(--cs-border)",
  padding: "0 0.5rem",
  fontSize: "0.875rem",
  backgroundColor: "var(--cs-surface)",
  color: "var(--cs-text)",
};

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  height: 36,
  borderRadius: 6,
  border: "1px solid var(--cs-border)",
  padding: "0 0.5rem",
  fontSize: "0.875rem",
  backgroundColor: "var(--cs-surface)",
  color: "var(--cs-text)",
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 600,
  color: "var(--cs-text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: "0.375rem",
  display: "block",
};

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} style={LABEL_STYLE}>{label}</label>
      {children}
    </div>
  );
}

export function CustomerNotesForm({
  customerId,
  initialFullName,
  initialPhone,
  initialEmail,
  initialNotes,
  initialPreferredStaffId,
  initialPreferredVisitType,
  initialPressurePreference,
  initialHealthNotes,
  initialBirthday,
  initialLoyaltyTier,
  staff,
}: Props) {
  const [fullName,          setFullName]          = useState(initialFullName);
  const [phone,             setPhone]             = useState(initialPhone);
  const [email,             setEmail]             = useState(initialEmail ?? "");
  const [notes,             setNotes]             = useState(initialNotes ?? "");
  const [preferredId,       setPreferredId]       = useState(initialPreferredStaffId ?? "");
  const [visitType,         setVisitType]         = useState(initialPreferredVisitType ?? "");
  const [pressure,          setPressure]          = useState(initialPressurePreference ?? "");
  const [healthNotes,       setHealthNotes]       = useState(initialHealthNotes ?? "");
  const [birthday,          setBirthday]          = useState(initialBirthday ?? "");
  const [loyaltyTier,       setLoyaltyTier]       = useState(initialLoyaltyTier ?? "standard");
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  function handleSave() {
    startTransition(async () => {
      const result = (await updateCustomerAction({
        customerId,
        fullName:            fullName.trim() || undefined,
        phone:               phone.trim() || undefined,
        email:               email.trim(),
        notes:               notes || undefined,
        preferredStaffId:    preferredId || null,
        preferredVisitType:  visitType   || null,
        pressurePreference:  pressure    || null,
        healthNotes:         healthNotes || null,
        birthday:            birthday    || null,
        loyaltyTier:         loyaltyTier as "standard" | "silver" | "gold" | "vip",
      })) as UpdateResult;

      if (result.success) {
        setFeedback("Saved");
        setTimeout(() => setFeedback(null), 2000);
      } else {
        setFeedback(result.error ?? "Failed to save");
        setTimeout(() => setFeedback(null), 3000);
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
      <Field label="Full Name" id="cnf-name">
        <input id="cnf-name" value={fullName} onChange={(e) => setFullName(e.target.value)} style={INPUT_STYLE} />
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        <Field label="Phone" id="cnf-phone">
          <input id="cnf-phone" value={phone} onChange={(e) => setPhone(e.target.value)} style={INPUT_STYLE} />
        </Field>
        <Field label="Email" id="cnf-email">
          <input id="cnf-email" value={email} type="email" onChange={(e) => setEmail(e.target.value)} style={INPUT_STYLE} />
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        <Field label="Birthday" id="cnf-birthday">
          <input id="cnf-birthday" value={birthday} type="date" onChange={(e) => setBirthday(e.target.value)} style={INPUT_STYLE} />
        </Field>
        <Field label="Loyalty Tier" id="cnf-loyalty">
          <select id="cnf-loyalty" value={loyaltyTier} onChange={(e) => setLoyaltyTier(e.target.value)} style={SELECT_STYLE}>
            <option value="standard">Standard</option>
            <option value="silver">Silver</option>
            <option value="gold">Gold</option>
            <option value="vip">VIP</option>
          </select>
        </Field>
      </div>

      {/* Divider */}
      <div style={{ borderTop: "1px solid var(--cs-border)", paddingTop: "0.75rem" }}>
        <div style={{ ...LABEL_STYLE, marginBottom: "0.875rem", color: "var(--cs-sand)", fontSize: "0.6875rem" }}>
          Preferences
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        <Field label="Preferred Therapist" id="cnf-staff">
          <select id="cnf-staff" value={preferredId} onChange={(e) => setPreferredId(e.target.value)} style={SELECT_STYLE}>
            <option value="">No preference</option>
            {staff.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name} ({m.tier})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Visit Type" id="cnf-visit">
          <select id="cnf-visit" value={visitType} onChange={(e) => setVisitType(e.target.value)} style={SELECT_STYLE}>
            <option value="">No preference</option>
            <option value="in_spa">In-Spa</option>
            <option value="home_service">Home Service</option>
          </select>
        </Field>
      </div>

      <Field label="Pressure Preference" id="cnf-pressure">
        <select id="cnf-pressure" value={pressure} onChange={(e) => setPressure(e.target.value)} style={SELECT_STYLE}>
          <option value="">No preference</option>
          <option value="light">Light</option>
          <option value="medium">Medium</option>
          <option value="firm">Firm</option>
          <option value="deep_tissue">Deep Tissue</option>
        </select>
      </Field>

      <Field label="Health Notes / Contraindications" id="cnf-health">
        <textarea
          id="cnf-health"
          value={healthNotes}
          onChange={(e) => setHealthNotes(e.target.value)}
          placeholder="Allergies, injuries, medical conditions..."
          rows={2}
          style={{
            width: "100%",
            borderRadius: 6,
            border: "1px solid var(--cs-border)",
            padding: "0.5rem 0.75rem",
            fontSize: "0.875rem",
            color: "var(--cs-text)",
            backgroundColor: "var(--cs-surface)",
            resize: "vertical",
            fontFamily: "inherit",
          }}
        />
      </Field>

      <Field label="CRM Notes" id="cnf-notes">
        <textarea
          id="cnf-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Internal notes visible to staff..."
          rows={3}
          style={{
            width: "100%",
            borderRadius: 6,
            border: "1px solid var(--cs-border)",
            padding: "0.5rem 0.75rem",
            fontSize: "0.875rem",
            color: "var(--cs-text)",
            backgroundColor: "var(--cs-surface)",
            resize: "vertical",
            fontFamily: "inherit",
          }}
        />
      </Field>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <Button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          size="sm"
          style={{ backgroundColor: "var(--cs-sand)", color: "#fff", border: "none", opacity: isPending ? 0.7 : 1 }}
        >
          {isPending ? "Saving..." : "Save Profile"}
        </Button>
        {feedback && (
          <span style={{ fontSize: "0.8125rem", color: feedback === "Saved" ? "#15803D" : "#DC2626" }}>
            {feedback}
          </span>
        )}
      </div>
    </div>
  );
}
