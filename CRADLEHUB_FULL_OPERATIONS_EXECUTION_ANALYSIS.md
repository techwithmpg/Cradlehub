# CradleHub Full Operations Execution Analysis

## 1. Executive Summary
This document outlines a comprehensive implementation plan for the CradleHub operations upgrade. The goal is to move the system from a manual, siloed workflow to an integrated, real-time operations environment. Key improvements include centralizing branch data, enabling manual payment recording, creating a unified Booking Control Console, and implementing a robust home-service tracking system with customer-facing live maps.

## 2. Current Architecture Findings
- **Branches:** Database has `address`, `phone`, `email`, `maps_embed_url`, `messenger_link`. These are fetched via `getAllBranches()` but UI often contains hardcoded variants or formatting.
- **Booking Progress:** A state machine exists in `src/lib/bookings/progress.ts` supporting `home_service`, `walkin`, and `online`. It tracks stages like `travel_started`, `arrived`, `session_started`.
- **Home Service:** Database supports `travel_started_at`, `arrived_at`, `session_started_at`, and `completed_at`. Dispatch conflict detection exists in `src/lib/bookings/dispatch-conflict.ts`.
- **Payments:** Basic fields (`payment_method`, `payment_status`, `amount_paid`) exist on the `bookings` table. Daily cash reconciliation table exists for EOD audits.
- **Portals:** Staff portal is functional but lacks deep differentiation for home-service vs in-spa. Driver portal is a "Coming Soon" placeholder.
- **Public Site Content:** `public_site_sections` and `public_site_assets` exist for marketing copy but aren't fully utilized for branch-specific contact details.

## 3. Existing Files/Routes/Tables Involved
- **Tables:** `branches`, `bookings`, `staff`, `daily_cash_reconciliations`, `public_site_sections`.
- **Routes:** `/owner`, `/manager/operations`, `/crm/today`, `/staff-portal`, `/driver`.
- **Key Components:** `StaffAppointmentCard`, `BookingWizard`, `Sidebar`, `BookingProgressActions`.
- **Logic Utilities:** `src/lib/bookings/progress.ts`, `src/lib/queries/branches.ts`, `src/lib/actions/online-booking.ts`.

## 4. Public Branch Address Cleanup Plan
- **Centralize:** Ensure `getAllBranches()` is the only source of truth.
- **Contact Page:** Update `src/app/(public)/contact/page.tsx` to map through `branches` instead of hardcoded JSX. Use `maps_embed_url` or generate `google.com/maps` links dynamically from address.
- **Footer/Headers:** Scan for any other hardcoded phone/address strings (e.g., in `site-footer.tsx`).
- **Data Gap:** Add `business_hours` (JSONB) and `support_phone` (if different from branch phone) to the `branches` table.

## 5. Manual Payment Recording Plan
- **UI:** Add a "Record Payment" button to the booking detail view (in CRM and Manager workspaces).
- **Form:** A modal capturing `payment_method` (Cash, GCash, Maya, Card, Other), `amount_paid`, and `payment_reference`.
- **Validation:** Ensure `amount_paid` does not exceed the calculated total (unless allowed for tips, which should be tracked separately).
- **Audit:** Booking status transitions or metadata updates should record who recorded the payment.

## 6. Booking Control Console / Manual Booking Plan
- **Ops Console:** Enhance `/manager/operations` (and create `/crm/operations`) to show a "Live Ops View". 
- **Filters:** Branch-scoped for CRM/Manager; all-access for Owner.
- **Grid View:** A real-time updating grid of today's bookings, color-coded by delivery type and tracking status.
- **Manual Booking:** Ensure `BookingWizard` (inhouse mode) is accessible from the console for phone/walk-in bookings.

## 7. Booking Delivery Type Plan
- **Visuals:** Use distinct icons (🏠 Home, 🏢 Spa) and color strips in all booking lists.
- **Staff Portal:** When a booking is `home_service`, the primary action should be "Start Travel" rather than "Check In".
- **Metadata:** Display "Address & Landmark" prominently for home-service; display "Room/Bed" for in-spa.

## 8. Home-Service Trip Workflow State Machine
- **Refinement:** Ensure the transition from `confirmed` -> `travel_started` -> `arrived` -> `session_started` -> `completed` is strictly enforced.
- **Driver Role:** Enable drivers to "Pick Up Staff" which marks a `driver_trip_started` (new status).
- **Automation:** When `travel_started` is clicked, auto-generate the tracking link.

## 9. Customer Tracking Link and Message Plan
- **Token Generation:** Use a crypto-secure random token (stored in `booking_tracking_tokens`).
- **Messages:** Provide a "Copy Dispatch Message" button for CSRs: *"Hi [Name], your therapist [Staff] and driver are on the way! Track them here: [Link]"*.
- **Automation:** Future Phase could use a WhatsApp/SMS API.

## 10. Customer Live Tracking Page Plan
- **Route:** `/track/[token]` (Public, no auth).
- **Components:**
  - Map (Google Maps JS API).
  - Staff Info (Name, Photo).
  - Trip Status (In Transit, Arrived).
  - ETA (Dynamic calculation).
- **Security:** Token must expire 2 hours after booking completion.

## 11. Internal CRM/Manager/Owner Live Map Plan
- **Internal Map:** A full-screen or large-panel map showing all active trips.
- **Markers:** Staff/Drivers (moving), Customers (fixed).
- **Overlays:** Polylines for active routes.

## 12. Traffic/Conflict Warning Plan
- **Integration:** Use Google Routes API with `departure_time: 'now'`.
- **Logic:** If `current_time + travel_time > booking_start_time`, flag a "Delay Warning".
- **Conflict:** If a delay on Trip A affects the start of Trip B for the same staff/driver, show an "Operational Conflict" alert.

## 13. Payroll Plan
- **Tables:**
  - `payroll_periods` (start_date, end_date, status).
  - `payroll_items` (staff_id, type: salary|commission|reimbursement|deduction, amount, status).
- **Workflow:** Auto-calculate commissions from completed bookings based on staff tier/rate.

## 14. Staff Performance Plan
- **Metrics:** On-time arrival rate, customer rating (metadata), total hours worked, total commission earned.
- **Leaderboard:** Internal view for managers/owners to reward top performers.

## 15. Proposed Database Additions
```sql
-- Track real-time movement
CREATE TABLE staff_locations (
  staff_id UUID PRIMARY KEY REFERENCES staff(id),
  lat NUMERIC,
  lng NUMERIC,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Secure tracking links
CREATE TABLE booking_tracking_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id),
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

-- Future Payroll
CREATE TABLE payroll_periods (...);
CREATE TABLE payroll_items (...);
```

## 16. Proposed UI Surfaces by Role
- **Staff:** Mobile-first tracking buttons, location toggle.
- **Driver:** Trip list, navigation link, staff pickup confirm.
- **CRM/Manager:** Operations Console, Live Map, Payment Recorder.
- **Owner:** Global Ops View, Payroll Dashboard, Reports.
- **Customer:** /track/[token] page.

## 17. Tool/API Requirements
- **Google Maps Platform:**
  - Maps JavaScript API (for all maps).
  - Routes API (for ETA and traffic).
  - Places API (for address entry).
- **Supabase Realtime:** For pushing location updates and status changes.

## 18. Security and RLS Plan
- **Locations:** Staff can only `UPSERT` their own record. `SELECT` restricted to relevant Manager/Owner.
- **Tracking Tokens:** Anonymous access to `/track/[token]` allowed, but token must be linked to a `booking_id` that is active.
- **Payments:** RLS must ensure CRM can only record for their assigned branch.

## 19. Gaps and Risks
- **Background Tracking:** Browser-based geolocation often stops when the phone is locked. PWA or persistent "Keep Screen On" might be needed.
- **Cost:** Google Maps API costs can scale with many real-time updates.
- **Data Accuracy:** ETA is an estimate; traffic can change rapidly.

## 20. Phased Implementation Roadmap
- **Phase 1: Foundation & Cleanup**
  - Centralize branch data.
  - Fix hardcoded public contact info.
  - Add `business_hours` to DB.
- **Phase 2: Payments & Console**
  - Implement manual payment recording UI.
  - Create the base Operations Console (list view).
- **Phase 3: Tracking Logic (Backend)**
  - Tracking token generation.
  - Message generation tool.
  - Staff location table & update action.
- **Phase 4: Customer Tracking (Frontend)**
  - `/track/[token]` route.
  - Basic map integration (marker only).
- **Phase 5: Real-time Ops**
  - Live Map in Operations Console.
  - Supabase Realtime integration for location updates.
  - ETA calculation via Routes API.
- **Phase 6: Admin & Future**
  - Payroll system.
  - Staff performance stats.

## 21. Phase 1 Implementation Prompt
"Centralize branch data and clean up hardcoded contact information. 
1. Add `business_hours` (JSONB) and `support_phone` (TEXT) columns to the `branches` table via migration.
2. Update `src/lib/queries/branches.ts` to include these new fields.
3. Modify `src/app/(public)/contact/page.tsx` and `src/app/(public)/branches/page.tsx` to fetch all branch data from the database and remove hardcoded address/phone/map-link strings.
4. Ensure the UI remains responsive and follows existing 'spa' design tokens."
