# Google Maps Integration

## Environment Variables

```bash
# Required for browser map rendering and Places Autocomplete
NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY=

# Server-side key (Geocoding, Routes API)
GOOGLE_MAPS_SERVER_API_KEY=
```

## Booking Wizard — Location Step

The booking wizard already stores the following fields inside `bookings.metadata.home_service_address`:

| Field              | Existing Key in Metadata                | Status     |
|--------------------|------------------------------------------|------------|
| formatted_address  | `formatted_address`                      | ✅ Ready   |
| place_id           | `place_id`                               | ✅ Ready   |
| latitude           | `lat`                                    | ✅ Ready   |
| longitude          | `lng`                                    | ✅ Ready   |
| location_notes     | `address_details` / `notes`              | ✅ Ready   |
| landmark           | `landmark`                               | ✅ Ready   |

No database migration is required. The online-booking action (`src/lib/actions/online-booking.ts`) already writes these fields.
