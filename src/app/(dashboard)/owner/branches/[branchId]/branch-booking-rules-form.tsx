"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateBranchBookingRulesAction } from "@/app/(dashboard)/owner/branches/actions";
import type { BranchBookingRules } from "@/lib/bookings/booking-rules-config";

type BranchRulesState = {
  success?: boolean;
  error?: string;
};

const initialState: BranchRulesState = {};

function numberFromForm(
  formData: FormData,
  name: string,
  fallback: number
): number {
  const value = Number(formData.get(name));
  return Number.isFinite(value) ? value : fallback;
}

export function BranchBookingRulesForm({
  rules,
}: {
  rules: BranchBookingRules;
}) {
  const [baseFee, setBaseFee] = useState(rules.homeServiceBaseFee ?? 100);
  const [includedKm, setIncludedKm] = useState(rules.homeServiceFreeKm ?? 1);
  const [perKmFee, setPerKmFee] = useState(rules.homeServiceExtraKmFee ?? 40);

  const [state, formAction, pending] = useActionState(
    async (_prev: BranchRulesState, formData: FormData): Promise<BranchRulesState> => {
      const result = await updateBranchBookingRulesAction({
        branchId: rules.branchId,
        inSpaStartTime: String(formData.get("inSpaStartTime") ?? ""),
        inSpaEndTime: String(formData.get("inSpaEndTime") ?? ""),
        homeServiceEnabled: formData.get("homeServiceEnabled") === "on",
        homeServiceStartTime: String(formData.get("homeServiceStartTime") ?? ""),
        homeServiceEndTime: String(formData.get("homeServiceEndTime") ?? ""),
        travelBufferMins: numberFromForm(
          formData,
          "travelBufferMins",
          rules.travelBufferMins
        ),
        maxAdvanceBookingDays: numberFromForm(
          formData,
          "maxAdvanceBookingDays",
          rules.maxAdvanceBookingDays
        ),
        homeServiceDriverCapacity: numberFromForm(
          formData,
          "homeServiceDriverCapacity",
          rules.homeServiceDriverCapacity
        ),
        homeServiceBaseFee: numberFromForm(
          formData,
          "homeServiceBaseFee",
          rules.homeServiceBaseFee ?? 100
        ),
        homeServiceFreeKm: numberFromForm(
          formData,
          "homeServiceFreeKm",
          rules.homeServiceFreeKm ?? 1
        ),
        homeServiceExtraKmFee: numberFromForm(
          formData,
          "homeServiceExtraKmFee",
          rules.homeServiceExtraKmFee ?? 40
        ),
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error,
        };
      }

      return {
        success: true,
      };
    },
    initialState
  );

  return (
    <div>
      <div
        style={{
          fontSize: "0.8125rem",
          fontWeight: 600,
          color: "var(--cs-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "0.625rem",
        }}
      >
        Booking Rules
      </div>

      <div
        style={{
          backgroundColor: "var(--cs-surface)",
          border: "1px solid var(--cs-border)",
          borderRadius: 10,
          padding: "1.25rem",
        }}
      >
        <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {state.error && (
            <div
              style={{
                padding: "0.625rem",
                backgroundColor: "#FEF2F2",
                border: "1px solid #FECACA",
                borderRadius: 6,
                fontSize: "0.8125rem",
                color: "#991B1B",
              }}
            >
              {state.error}
            </div>
          )}
          {state.success && (
            <div
              style={{
                padding: "0.625rem",
                backgroundColor: "#F0FDF4",
                border: "1px solid #BBF7D0",
                borderRadius: 6,
                fontSize: "0.8125rem",
                color: "#15803D",
              }}
            >
              Booking rules saved
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>
            <EditField
              label="In-spa start"
              name="inSpaStartTime"
              type="time"
              defaultValue={rules.inSpaStartTime}
            />
            <EditField
              label="In-spa end"
              name="inSpaEndTime"
              type="time"
              defaultValue={rules.inSpaEndTime}
            />
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.625rem",
              fontSize: "0.875rem",
              color: "var(--cs-text)",
            }}
          >
            <input
              type="checkbox"
              name="homeServiceEnabled"
              defaultChecked={rules.homeServiceEnabled}
              style={{ width: 16, height: 16 }}
            />
            Home service enabled
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>
            <EditField
              label="Home start"
              name="homeServiceStartTime"
              type="time"
              defaultValue={rules.homeServiceStartTime}
            />
            <EditField
              label="Home end"
              name="homeServiceEndTime"
              type="time"
              defaultValue={rules.homeServiceEndTime}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.875rem" }}>
            <EditField
              label="Travel buffer minutes"
              name="travelBufferMins"
              type="number"
              min={0}
              max={240}
              defaultValue={String(rules.travelBufferMins)}
            />
            <EditField
              label="Max advance days"
              name="maxAdvanceBookingDays"
              type="number"
              min={1}
              max={365}
              defaultValue={String(rules.maxAdvanceBookingDays)}
            />
            <EditField
              label="Home service driver capacity"
              name="homeServiceDriverCapacity"
              type="number"
              min={0}
              max={20}
              defaultValue={String(rules.homeServiceDriverCapacity)}
              helperText="Max concurrent home service trips"
            />
          </div>

          <div
            style={{
              marginTop: "0.5rem",
              paddingTop: "0.875rem",
              borderTop: "1px solid var(--cs-border)",
            }}
          >
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "var(--cs-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "0.75rem",
              }}
            >
              Home Service Transportation
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.875rem" }}>
              <EditField
                label="Base transportation fee"
                name="homeServiceBaseFee"
                type="number"
                min={0}
                max={50000}
                defaultValue={String(baseFee)}
                helperText="₱ (includes initial distance)"
                onChange={(e) => setBaseFee(Number(e.target.value) || 0)}
              />
              <EditField
                label="Included distance"
                name="homeServiceFreeKm"
                type="number"
                min={0}
                max={100}
                step="any"
                defaultValue={String(includedKm)}
                helperText="Covered by base fee (km)"
                onChange={(e) => setIncludedKm(Number(e.target.value) || 0)}
              />
              <EditField
                label="Additional fee per kilometer"
                name="homeServiceExtraKmFee"
                type="number"
                min={0}
                max={10000}
                step="any"
                defaultValue={String(perKmFee)}
                helperText="₱ per extra km"
                onChange={(e) => setPerKmFee(Number(e.target.value) || 0)}
              />
            </div>
            <div
              style={{
                marginTop: "0.625rem",
                padding: "0.5rem 0.75rem",
                backgroundColor: "var(--cs-surface-subtle, #F9FAFB)",
                borderRadius: 6,
                fontSize: "0.75rem",
                color: "var(--cs-text-secondary, #4B5563)",
                display: "flex",
                flexWrap: "wrap",
                gap: "1.25rem",
                alignItems: "center",
              }}
            >
              <span style={{ fontWeight: 600, color: "var(--cs-text)" }}>Fare preview:</span>
              <span>1 km · ₱{Math.round(baseFee + perKmFee * Math.max(0, 1 - includedKm))}</span>
              <span>3 km · ₱{Math.round(baseFee + perKmFee * Math.max(0, 3 - includedKm))}</span>
              <span>5 km · ₱{Math.round(baseFee + perKmFee * Math.max(0, 5 - includedKm))}</span>
            </div>
          </div>

          <Button
            type="submit"
            disabled={pending}
            style={{
              marginTop: "0.25rem",
              backgroundColor: "var(--cs-sand)",
              color: "#fff",
              border: "none",
              opacity: pending ? 0.7 : 1,
            }}
          >
            {pending ? "Saving..." : "Save Booking Rules"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function EditField({
  label,
  name,
  defaultValue,
  type = "text",
  min,
  max,
  step,
  helperText,
  onChange,
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: "text" | "time" | "number";
  min?: number;
  max?: number;
  step?: string | number;
  helperText?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
      <Label htmlFor={`booking-rule-${name}`} style={{ fontSize: "0.8125rem" }}>
        {label}
      </Label>
      <Input
        id={`booking-rule-${name}`}
        name={name}
        type={type}
        min={min}
        max={max}
        step={step}
        defaultValue={defaultValue}
        onChange={onChange}
        style={{ fontSize: "0.875rem" }}
      />
      {helperText && (
        <span style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)" }}>
          {helperText}
        </span>
      )}
    </div>
  );
}
