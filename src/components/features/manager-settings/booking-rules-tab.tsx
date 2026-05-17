"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Save } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { updateBranchBookingRulesAction } from "@/app/(dashboard)/owner/branches/actions";
import type { BranchBookingRules } from "@/lib/bookings/booking-rules-config";
import {
  CheckboxSwitch,
  TextInputField,
} from "./setting-controls";
import { SettingsSectionCard } from "./settings-section-card";

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

export function BookingRulesTab({ rules }: { rules: BranchBookingRules }) {
  const router = useRouter();
  const [homeServiceEnabled, setHomeServiceEnabled] = useState(
    rules.homeServiceEnabled
  );
  const [driverCapacity, setDriverCapacity] = useState(
    rules.homeServiceDriverCapacity
  );
  const [state, formAction, pending] = useActionState(
    async (
      _prev: BranchRulesState,
      formData: FormData
    ): Promise<BranchRulesState> => {
      const result = await updateBranchBookingRulesAction({
        branchId: rules.branchId,
        inSpaStartTime: String(formData.get("inSpaStartTime") ?? ""),
        inSpaEndTime: String(formData.get("inSpaEndTime") ?? ""),
        homeServiceEnabled: formData.get("homeServiceEnabled") === "on",
        homeServiceStartTime: String(
          formData.get("homeServiceStartTime") ?? ""
        ),
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
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error,
        };
      }

      return { success: true };
    },
    initialState
  );

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [router, state.success]);

  const driverCapacityWarning = homeServiceEnabled && driverCapacity === 0;

  return (
    <form action={formAction} className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--cs-text)]">
            Booking Rules
          </h2>
          <p className="mt-1 text-sm leading-6 text-[var(--cs-text-secondary)]">
            Set the booking window customers and staff use for this branch.
          </p>
        </div>
        <Button
          type="submit"
          disabled={pending}
          className="w-full bg-[var(--cs-sand)] text-white hover:bg-[var(--cs-sand-dark)] md:w-auto"
        >
          <Save className="size-4" aria-hidden="true" />
          {pending ? "Saving..." : "Save Booking Rules"}
        </Button>
      </div>

      {state.error ? (
        <Alert
          variant="destructive"
          className="border-[var(--cs-error-bg)] bg-[var(--cs-error-bg)]"
        >
          <AlertTriangle className="size-4" aria-hidden="true" />
          <AlertTitle>Could not save booking rules</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      {state.success ? (
        <Alert className="border-[var(--cs-success-bg)] bg-[var(--cs-success-bg)] text-[var(--cs-success-text)]">
          <CheckCircle2 className="size-4" aria-hidden="true" />
          <AlertTitle>Booking rules saved</AlertTitle>
          <AlertDescription className="text-[var(--cs-success-text)]/80">
            Public booking availability has been refreshed.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <SettingsSectionCard
            title="In-Spa Booking Hours"
            description="These hours control when customers and staff can create in-spa appointments."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInputField
                label="In-spa start"
                name="inSpaStartTime"
                type="time"
                defaultValue={rules.inSpaStartTime}
              />
              <TextInputField
                label="In-spa end"
                name="inSpaEndTime"
                type="time"
                defaultValue={rules.inSpaEndTime}
              />
            </div>
          </SettingsSectionCard>

          <SettingsSectionCard
            title="Booking Window"
            description="Controls how far into the future customers can book."
          >
            <div className="max-w-xs">
              <TextInputField
                label="Max advance booking days"
                name="maxAdvanceBookingDays"
                type="number"
                min={1}
                max={365}
                defaultValue={String(rules.maxAdvanceBookingDays)}
                helperText="Customers cannot book beyond this window."
              />
            </div>
          </SettingsSectionCard>
        </div>

        <SettingsSectionCard
          title="Home Service Rules"
          description="Buffer added around home-service bookings for travel time."
        >
          <div className="space-y-4">
            <div onChange={(event) => {
              const target = event.target as HTMLInputElement;
              if (target.name === "homeServiceEnabled") {
                setHomeServiceEnabled(target.checked);
              }
            }}>
              <CheckboxSwitch
                name="homeServiceEnabled"
                label="Home service enabled"
                defaultChecked={rules.homeServiceEnabled}
                helperText="Allow home-service bookings for this branch."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextInputField
                label="Home start"
                name="homeServiceStartTime"
                type="time"
                defaultValue={rules.homeServiceStartTime}
              />
              <TextInputField
                label="Home end"
                name="homeServiceEndTime"
                type="time"
                defaultValue={rules.homeServiceEndTime}
              />
            </div>

            <TextInputField
              label="Travel buffer minutes"
              name="travelBufferMins"
              type="number"
              min={0}
              max={240}
              defaultValue={String(rules.travelBufferMins)}
              helperText="Time added around home-service bookings so staff have room to travel."
            />

            <div
              onChange={(event) => {
                const target = event.target as HTMLInputElement;
                if (target.name === "homeServiceDriverCapacity") {
                  setDriverCapacity(Number(target.value));
                }
              }}
            >
              <TextInputField
                label="Home service driver capacity"
                name="homeServiceDriverCapacity"
                type="number"
                min={0}
                max={20}
                defaultValue={String(rules.homeServiceDriverCapacity)}
                helperText="Maximum concurrent home-service trips this branch can dispatch."
              />
            </div>

            {driverCapacityWarning ? (
              <Alert
                variant="destructive"
                className="border-[var(--cs-error-bg)] bg-[var(--cs-error-bg)]"
              >
                <AlertTriangle className="size-4" aria-hidden="true" />
                <AlertTitle>Driver capacity is 0</AlertTitle>
                <AlertDescription>
                  Home-service dispatch may be blocked.
                </AlertDescription>
              </Alert>
            ) : null}
          </div>
        </SettingsSectionCard>
      </div>
    </form>
  );
}
