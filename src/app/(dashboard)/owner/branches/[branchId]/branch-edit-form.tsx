"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PlacesAutocomplete,
  type PlaceSelectResult,
  type PlacesAutocompleteStatus,
} from "@/components/public/places-autocomplete";
import {
  updateBranchAction,
  toggleBranchActiveAction,
} from "@/app/(dashboard)/owner/branches/actions";
import {
  getBarangayFromGooglePlace,
  getCityFromGooglePlace,
} from "@/lib/location/google-address-components";
import type { Database } from "@/types/supabase";

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];

type BranchActionState = {
  success?: boolean;
  error?: string;
};

type BranchFormValues = {
  name: string;
  address: string;
  phone: string;
  email: string;
  messenger: string;
  placeId: string;
  latitude: string;
  longitude: string;
  city: string;
  barangay: string;
  mapUrl: string;
  addressComponents: PlaceSelectResult["addressComponents"];
};

const initialState: BranchActionState = {};

function optionalString(formValue: FormDataEntryValue | null): string | undefined {
  const value = String(formValue ?? "").trim();
  return value.length > 0 ? value : undefined;
}

function parseSlotInterval(value: FormDataEntryValue | null): 15 | 30 | 60 {
  const n = Number(value);
  if (n === 15 || n === 30 || n === 60) return n;
  return 30;
}

function readMetadataRecord(value: BranchRow["location_metadata"]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function readMetadataString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function readMetadataAddressComponents(
  record: Record<string, unknown>
): PlaceSelectResult["addressComponents"] {
  const components = record.address_components;
  if (!Array.isArray(components)) return [];

  return components
    .map((component) => {
      if (!component || typeof component !== "object" || Array.isArray(component)) {
        return null;
      }
      const recordComponent = component as Record<string, unknown>;
      const longName = recordComponent.long_name;
      const shortName = recordComponent.short_name;
      const types = recordComponent.types;
      if (typeof longName !== "string" || typeof shortName !== "string" || !Array.isArray(types)) {
        return null;
      }
      return {
        long_name: longName,
        short_name: shortName,
        types: types.filter((type): type is string => typeof type === "string"),
      };
    })
    .filter((component): component is PlaceSelectResult["addressComponents"][number] =>
      Boolean(component)
    );
}

function coordinateToInput(value: number | null): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function inputToCoordinate(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getBranchFormValues(branch: BranchRow): BranchFormValues {
  const metadata = readMetadataRecord(branch.location_metadata);
  return {
    name: branch.name ?? "",
    address: branch.address ?? "",
    phone: branch.phone ?? "",
    email: branch.email ?? "",
    messenger: branch.messenger_link ?? "",
    placeId: branch.place_id ?? readMetadataString(metadata, "place_id"),
    latitude: coordinateToInput(branch.latitude),
    longitude: coordinateToInput(branch.longitude),
    city: branch.city ?? readMetadataString(metadata, "city"),
    barangay: branch.barangay ?? readMetadataString(metadata, "barangay"),
    mapUrl: branch.maps_embed_url ?? readMetadataString(metadata, "map_url"),
    addressComponents: readMetadataAddressComponents(metadata),
  };
}

export function BranchEditForm({ branch }: { branch: BranchRow }) {
  return <BranchEditFormInner key={branch.id} branch={branch} />;
}

function BranchEditFormInner({ branch }: { branch: BranchRow }) {
  const [values, setValues] = useState<BranchFormValues>(() => getBranchFormValues(branch));
  const [placesStatus, setPlacesStatus] = useState<PlacesAutocompleteStatus>("idle");
  const [state, formAction, pending] = useActionState(
    async (_prev: BranchActionState, formData: FormData): Promise<BranchActionState> => {
      const latitude = inputToCoordinate(values.latitude);
      const longitude = inputToCoordinate(values.longitude);
      const hasCoordinates = latitude !== null && longitude !== null;
      const result = await updateBranchAction({
        branchId: branch.id,
        name: String(formData.get("name") ?? "").trim(),
        address: values.address.trim(),
        phone: optionalString(formData.get("phone")),
        email: optionalString(formData.get("email")),
        messengerLink: optionalString(formData.get("messenger")),
        mapsEmbedUrl: values.mapUrl || null,
        placeId: values.placeId || null,
        latitude: hasCoordinates ? latitude : null,
        longitude: hasCoordinates ? longitude : null,
        city: values.city || null,
        barangay: values.barangay || null,
        locationMetadata: hasCoordinates
          ? {
              formatted_address: values.address,
              place_id: values.placeId,
              city: values.city,
              barangay: values.barangay,
              map_url: values.mapUrl,
              source: "google_places",
              address_components: values.addressComponents,
            }
          : null,
        slotIntervalMinutes: parseSlotInterval(formData.get("slotInterval")),
      });

      return {
        success: result.success,
        error: result.error,
      };
    },
    initialState
  );

  function updateValue(name: keyof BranchFormValues, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function updateAddress(value: string) {
    setValues((current) => ({ ...current, address: value }));
  }

  function handleBranchPlaceSelect(result: PlaceSelectResult | null) {
    if (!result) {
      setValues((current) => ({
        ...current,
        placeId: "",
        latitude: "",
        longitude: "",
        city: "",
        barangay: "",
        mapUrl: "",
        addressComponents: [],
      }));
      return;
    }

    setValues((current) => ({
      ...current,
      address: result.formattedAddress,
      placeId: result.placeId,
      latitude: String(result.lat),
      longitude: String(result.lng),
      city: getCityFromGooglePlace(result),
      barangay: getBarangayFromGooglePlace(result),
      mapUrl: result.mapUrl,
      addressComponents: result.addressComponents,
    }));
  }

  const [toggleState, toggleAction, togglePending] = useActionState(
    async (): Promise<BranchActionState> => {
      const result = await toggleBranchActiveAction(branch.id, !branch.is_active);
      return {
        success: result.success,
        error: result.error,
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
        Branch Details
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
              Saved successfully
            </div>
          )}

          <EditField
            label="Name"
            name="name"
            value={values.name}
            onChange={(value) => updateValue("name", value)}
          />
          <BranchLocationEditor
            values={values}
            placesStatus={placesStatus}
            disabled={pending}
            onAddressChange={updateAddress}
            onPlaceSelect={handleBranchPlaceSelect}
            onPlacesStatusChange={setPlacesStatus}
          />
          <EditField
            label="Phone"
            name="phone"
            value={values.phone}
            onChange={(value) => updateValue("phone", value)}
          />
          <EditField
            label="Email"
            name="email"
            value={values.email}
            onChange={(value) => updateValue("email", value)}
          />
          <EditField
            label="Messenger"
            name="messenger"
            value={values.messenger}
            onChange={(value) => updateValue("messenger", value)}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            <Label htmlFor="edit-slot-interval" style={{ fontSize: "0.8125rem" }}>
              Slot interval
            </Label>
            <select
              id="edit-slot-interval"
              name="slotInterval"
              defaultValue={String(branch.slot_interval_minutes)}
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
              <option value="15">Every 15 minutes</option>
              <option value="30">Every 30 minutes</option>
              <option value="60">Every 60 minutes</option>
            </select>
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
            {pending ? "Saving…" : "Save Changes"}
          </Button>
        </form>

        <form action={toggleAction} style={{ marginTop: "0.625rem" }}>
          {toggleState.error && (
            <div
              style={{
                padding: "0.625rem",
                backgroundColor: "#FEF2F2",
                border: "1px solid #FECACA",
                borderRadius: 6,
                fontSize: "0.8125rem",
                color: "#991B1B",
                marginBottom: "0.5rem",
              }}
            >
              {toggleState.error}
            </div>
          )}
          <Button
            type="submit"
            variant="outline"
            disabled={togglePending}
            style={{
              width: "100%",
              fontSize: "0.875rem",
              color: branch.is_active ? "#EF4444" : "#15803D",
              borderColor: branch.is_active ? "#FCA5A5" : "#BBF7D0",
            }}
          >
            {branch.is_active ? "Deactivate Branch" : "Reactivate Branch"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function BranchLocationEditor({
  values,
  placesStatus,
  disabled,
  onAddressChange,
  onPlaceSelect,
  onPlacesStatusChange,
}: {
  values: BranchFormValues;
  placesStatus: PlacesAutocompleteStatus;
  disabled: boolean;
  onAddressChange: (value: string) => void;
  onPlaceSelect: (result: PlaceSelectResult | null) => void;
  onPlacesStatusChange: (status: PlacesAutocompleteStatus) => void;
}) {
  const hasCoordinates = values.latitude !== "" && values.longitude !== "";
  const derivedLocation = [values.barangay, values.city].filter(Boolean).join(", ");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <div>
        <Label htmlFor="edit-branch-service-address" style={{ fontSize: "0.8125rem" }}>
          Branch service address
        </Label>
        <p style={{ marginTop: 2, fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
          Used as the origin for CRM Home Service distance and travel-fee quotes.
        </p>
      </div>

      <div style={{ opacity: disabled ? 0.65 : 1, pointerEvents: disabled ? "none" : "auto" }}>
        <PlacesAutocomplete
          id="edit-branch-service-address"
          value={values.address}
          onChange={onAddressChange}
          onPlaceSelect={onPlaceSelect}
          onStatusChange={onPlacesStatusChange}
          placeholder="Search branch address"
          theme="default"
        />
      </div>

      {placesStatus === "loading" ? (
        <p
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            margin: 0,
            fontSize: "0.75rem",
            color: "var(--cs-text-muted)",
          }}
        >
          <Loader2 size={12} className="animate-spin" />
          Loading address search...
        </p>
      ) : null}

      {placesStatus === "missing_key" ? (
        <LocationNotice tone="error">
          Google address search is not configured. Configure the browser Maps key to update
          branch origin coordinates.
        </LocationNotice>
      ) : null}

      {placesStatus === "failed" || placesStatus === "place_missing_coordinates" ? (
        <LocationNotice tone="error">
          Address search could not get coordinates. Please select another Google result.
        </LocationNotice>
      ) : null}

      {hasCoordinates ? (
        <LocationNotice tone="success">
          Origin saved: {Number(values.latitude).toFixed(6)},{" "}
          {Number(values.longitude).toFixed(6)}
          {derivedLocation ? ` · ${derivedLocation}` : ""}
        </LocationNotice>
      ) : (
        <LocationNotice tone="warning">
          Select a Google address result to save branch coordinates for Home Service distance.
          {values.address ? ` Current text: ${values.address}` : ""}
        </LocationNotice>
      )}
    </div>
  );
}

function LocationNotice({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "success" | "warning" | "error";
}) {
  const styles = {
    success: {
      backgroundColor: "#F0FDF4",
      borderColor: "#BBF7D0",
      color: "#15803D",
    },
    warning: {
      backgroundColor: "#FFFBEB",
      borderColor: "#FDE68A",
      color: "#92400E",
    },
    error: {
      backgroundColor: "#FEF2F2",
      borderColor: "#FECACA",
      color: "#991B1B",
    },
  }[tone];

  return (
    <p
      style={{
        margin: 0,
        padding: "0.5rem",
        border: `1px solid ${styles.borderColor}`,
        borderRadius: 6,
        fontSize: "0.75rem",
        backgroundColor: styles.backgroundColor,
        color: styles.color,
      }}
    >
      {children}
    </p>
  );
}

function EditField({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
      <Label htmlFor={`edit-${name}`} style={{ fontSize: "0.8125rem" }}>
        {label}
      </Label>
      <Input
        id={`edit-${name}`}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{ fontSize: "0.875rem" }}
      />
    </div>
  );
}
