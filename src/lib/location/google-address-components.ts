import type {
  GoogleAddressComponent,
  PlaceSelectResult,
} from "@/components/public/places-autocomplete";

export function getGoogleAddressComponent(
  components: GoogleAddressComponent[],
  types: string[]
): string {
  return (
    components.find((component) =>
      types.some((type) => component.types.includes(type))
    )?.long_name ?? ""
  );
}

export function getBarangayFromGooglePlace(result: PlaceSelectResult): string {
  return getGoogleAddressComponent(result.addressComponents, [
    "sublocality_level_1",
    "sublocality",
    "neighborhood",
    "administrative_area_level_3",
  ]);
}

export function getCityFromGooglePlace(result: PlaceSelectResult): string {
  return getGoogleAddressComponent(result.addressComponents, [
    "locality",
    "administrative_area_level_2",
    "administrative_area_level_1",
  ]);
}
