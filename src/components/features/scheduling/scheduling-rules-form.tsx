"use client";

import { useState, useTransition } from "react";
import { upsertSchedulingRulesAction } from "@/app/(dashboard)/manager/scheduling/actions";
import type { SchedulingRules } from "@/lib/scheduling/types";

interface Props {
  rules: SchedulingRules;
}

type FormState = {
  min_daily_staff: number;
  min_daily_therapists: number;
  min_daily_csr: number;
  min_daily_drivers: number;
  default_days_off_per_week: number;
  max_same_role_off_per_day: number;
  max_therapists_off_per_day: number;
  protect_weekends: boolean;
  default_break_minutes: number;
  auto_breaks_enabled: boolean;
  max_working_hours_per_day: number;
  max_services_per_staff_per_day: number | null;
  auto_generate_breaks: boolean;
  auto_generate_travel_buffers: boolean;
  auto_generate_room_reset_buffers: boolean;
  room_reset_buffer_minutes: number;
  home_service_travel_buffer_minutes: number;
  suggestions_require_manager_approval: boolean;
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize:     "0.75rem",
        fontWeight:   600,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        color:        "#6B7280",
        margin:       "1.25rem 0 0.5rem",
      }}
    >
      {children}
    </p>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        gap:            "1rem",
        padding:        "0.375rem 0",
      }}
    >
      <span style={{ fontSize: "0.875rem", color: "#374151" }}>{label}</span>
      {children}
    </div>
  );
}

function NumberInput({
  value,
  min,
  max,
  onChange,
}: {
  value: number | null;
  min?: number;
  max?: number;
  onChange: (v: number | null) => void;
}) {
  return (
    <input
      type="number"
      value={value ?? ""}
      min={min}
      max={max}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "" ? null : Number(v));
      }}
      style={{
        width:        72,
        padding:      "0.25rem 0.5rem",
        border:       "1px solid #D1D5DB",
        borderRadius: 6,
        fontSize:     "0.875rem",
        textAlign:    "right",
      }}
    />
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width:           40,
        height:          22,
        borderRadius:    11,
        border:          "none",
        cursor:          "pointer",
        backgroundColor: checked ? "#7C3AED" : "#D1D5DB",
        position:        "relative",
        transition:      "background-color 150ms",
        flexShrink:      0,
      }}
    >
      <span
        style={{
          position:        "absolute",
          top:             2,
          left:            checked ? 20 : 2,
          width:           18,
          height:          18,
          borderRadius:    "50%",
          backgroundColor: "#fff",
          transition:      "left 150ms",
        }}
      />
    </button>
  );
}

export function SchedulingRulesForm({ rules }: Props) {
  const [form, setForm] = useState<FormState>({
    min_daily_staff:                    rules.min_daily_staff,
    min_daily_therapists:               rules.min_daily_therapists,
    min_daily_csr:                      rules.min_daily_csr,
    min_daily_drivers:                  rules.min_daily_drivers,
    default_days_off_per_week:          rules.default_days_off_per_week,
    max_same_role_off_per_day:          rules.max_same_role_off_per_day,
    max_therapists_off_per_day:         rules.max_therapists_off_per_day,
    protect_weekends:                   rules.protect_weekends,
    default_break_minutes:              rules.default_break_minutes,
    auto_breaks_enabled:                rules.auto_breaks_enabled,
    max_working_hours_per_day:          rules.max_working_hours_per_day,
    max_services_per_staff_per_day:     rules.max_services_per_staff_per_day,
    auto_generate_breaks:               rules.auto_generate_breaks,
    auto_generate_travel_buffers:       rules.auto_generate_travel_buffers,
    auto_generate_room_reset_buffers:   rules.auto_generate_room_reset_buffers,
    room_reset_buffer_minutes:          rules.room_reset_buffer_minutes,
    home_service_travel_buffer_minutes: rules.home_service_travel_buffer_minutes,
    suggestions_require_manager_approval: rules.suggestions_require_manager_approval,
  });

  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    setStatus("saving");
    setErrorMsg(null);
    startTransition(async () => {
      const res = await upsertSchedulingRulesAction(form);
      if (res.success) {
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 2000);
      } else {
        setStatus("error");
        setErrorMsg(res.error ?? "Save failed");
      }
    });
  }

  return (
    <div
      style={{
        backgroundColor: "#fff",
        border:          "1px solid #E5E7EB",
        borderRadius:    12,
        padding:         "1.25rem 1.5rem",
      }}
    >
      <div
        style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          marginBottom:   "0.25rem",
        }}
      >
        <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>
          Scheduling Rules
        </h2>
        <button
          type="button"
          disabled={isPending}
          onClick={handleSave}
          style={{
            padding:         "0.375rem 1rem",
            backgroundColor: status === "saved" ? "#059669" : "#7C3AED",
            color:           "#fff",
            border:          "none",
            borderRadius:    8,
            fontSize:        "0.875rem",
            fontWeight:      500,
            cursor:          isPending ? "not-allowed" : "pointer",
            opacity:         isPending ? 0.7 : 1,
          }}
        >
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved!" : "Save"}
        </button>
      </div>

      {errorMsg && (
        <p style={{ color: "#DC2626", fontSize: "0.8rem", margin: "0.5rem 0 0" }}>
          {errorMsg}
        </p>
      )}

      {/* Coverage thresholds */}
      <SectionTitle>Minimum daily coverage</SectionTitle>
      <Row label="Total staff">
        <NumberInput value={form.min_daily_staff} min={0} max={50} onChange={(v) => patch("min_daily_staff", v ?? 0)} />
      </Row>
      <Row label="Therapists">
        <NumberInput value={form.min_daily_therapists} min={0} max={50} onChange={(v) => patch("min_daily_therapists", v ?? 0)} />
      </Row>
      <Row label="CSR / front-desk">
        <NumberInput value={form.min_daily_csr} min={0} max={20} onChange={(v) => patch("min_daily_csr", v ?? 0)} />
      </Row>
      <Row label="Drivers">
        <NumberInput value={form.min_daily_drivers} min={0} max={20} onChange={(v) => patch("min_daily_drivers", v ?? 0)} />
      </Row>

      {/* Day-off limits */}
      <SectionTitle>Day-off limits</SectionTitle>
      <Row label="Default days off per week">
        <NumberInput value={form.default_days_off_per_week} min={0} max={7} onChange={(v) => patch("default_days_off_per_week", v ?? 1)} />
      </Row>
      <Row label="Max same-role off per day">
        <NumberInput value={form.max_same_role_off_per_day} min={0} max={20} onChange={(v) => patch("max_same_role_off_per_day", v ?? 2)} />
      </Row>
      <Row label="Max therapists off per day">
        <NumberInput value={form.max_therapists_off_per_day} min={0} max={20} onChange={(v) => patch("max_therapists_off_per_day", v ?? 1)} />
      </Row>
      <Row label="Protect weekends">
        <Toggle checked={form.protect_weekends} onChange={(v) => patch("protect_weekends", v)} />
      </Row>

      {/* Break & working hours */}
      <SectionTitle>Break & working hours</SectionTitle>
      <Row label="Default break (minutes)">
        <NumberInput value={form.default_break_minutes} min={0} max={240} onChange={(v) => patch("default_break_minutes", v ?? 60)} />
      </Row>
      <Row label="Auto-schedule breaks">
        <Toggle checked={form.auto_breaks_enabled} onChange={(v) => patch("auto_breaks_enabled", v)} />
      </Row>
      <Row label="Max working hours / day">
        <NumberInput value={form.max_working_hours_per_day} min={1} max={24} onChange={(v) => patch("max_working_hours_per_day", v ?? 8)} />
      </Row>
      <Row label="Max services / staff / day">
        <NumberInput value={form.max_services_per_staff_per_day} min={1} max={50} onChange={(v) => patch("max_services_per_staff_per_day", v)} />
      </Row>

      {/* Auto-blocking */}
      <SectionTitle>Auto-blocking</SectionTitle>
      <Row label="Generate break blocks">
        <Toggle checked={form.auto_generate_breaks} onChange={(v) => patch("auto_generate_breaks", v)} />
      </Row>
      <Row label="Generate travel buffers">
        <Toggle checked={form.auto_generate_travel_buffers} onChange={(v) => patch("auto_generate_travel_buffers", v)} />
      </Row>
      <Row label="Generate room-reset buffers">
        <Toggle checked={form.auto_generate_room_reset_buffers} onChange={(v) => patch("auto_generate_room_reset_buffers", v)} />
      </Row>
      <Row label="Room-reset buffer (minutes)">
        <NumberInput value={form.room_reset_buffer_minutes} min={0} max={120} onChange={(v) => patch("room_reset_buffer_minutes", v ?? 15)} />
      </Row>
      <Row label="Travel buffer — home service (minutes)">
        <NumberInput value={form.home_service_travel_buffer_minutes} min={0} max={120} onChange={(v) => patch("home_service_travel_buffer_minutes", v ?? 30)} />
      </Row>

      {/* Approval flow */}
      <SectionTitle>Approval flow</SectionTitle>
      <Row label="Suggestions require manager approval">
        <Toggle checked={form.suggestions_require_manager_approval} onChange={(v) => patch("suggestions_require_manager_approval", v)} />
      </Row>
    </div>
  );
}
