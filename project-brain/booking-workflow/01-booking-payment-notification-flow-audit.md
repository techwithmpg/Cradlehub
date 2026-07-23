# Booking Payment, Confirmation, Availability, and Notification Flow Audit

## Purpose

This Phase 1 audit maps the current public booking, CRM booking, payment, availability, notification, and route behavior before any workflow fixes are implemented. It identifies where bookings are created, how slots are blocked, why online bookings are risky while payment is manual, why notifications can look duplicated, where the broken staff notification link comes from, and where later Phase 2+ changes should land.

No app source code, migrations, RLS policies, booking logic, notification logic, or UI behavior were changed during this audit.

## Audit Date

2026-05-17, Asia/Singapore.

## Current Problems

- Public online bookings are inserted immediately with booking status `pending`, default payment status `unpaid`, and no hold expiry. The selected slot is blocked by availability logic until the booking is cancelled/no-showed.
- Public online bookings notify staff immediately even though CRM has not confirmed payment yet.
- A single booking can create more than one notification because booking creation emits both a staff assignment notification and a CRM payment follow-up notification. Home service bookings can emit additional CRM action notifications.
- Exact same-type notification dedupe exists, but only through `workspace_notifications.dedupe_key` and the open-notification unique index. If that migration is absent or older rows lack dedupe keys, same-type duplicates can still exist.
- Staff notification links can become `/staff/bookings?bookingId=...`, but no `/staff/bookings` route exists.
- The public submit toast says `Booking confirmed!`, while the actual online booking status is `pending` and payment is unpaid.
- CRM in-house bookings are created as `confirmed` before payment is recorded.
- There is no booking hold expiry, payment confirmation timestamp/user, confirmation timestamp/user, or CRM follow-up status in the current booking schema.
- Therapist nickname support exists partially, but public therapist cards can still show full legal names as secondary text.

## Routes Inspected

- `/book` -> `src/app/(public)/book/page.tsx`
- `/book/success` -> `src/app/(public)/book/success/page.tsx`
- `/book/confirm` -> `src/app/(public)/book/confirm/page.tsx`
- `/book/[branchId]` -> `src/app/(public)/book/[branchId]/page.tsx`
- `/book/[branchId]/[serviceId]` -> `src/app/(public)/book/[branchId]/[serviceId]/page.tsx`
- `/api/public/booking-context` -> `src/app/api/public/booking-context/route.ts`
- `/api/booking/available-slots` -> `src/app/api/booking/available-slots/route.ts`
- `/api/public/dispatch-slots` -> `src/app/api/public/dispatch-slots/route.ts`
- `/crm/bookings` -> `src/app/(dashboard)/crm/bookings/page.tsx`
- `/crm/bookings/new` -> `src/app/(dashboard)/crm/bookings/new/page.tsx`
- `/crm/notifications` -> `src/app/(dashboard)/crm/notifications/page.tsx`
- `/crm/today` -> `src/app/(dashboard)/crm/today/page.tsx`
- `/manager/bookings` -> `src/app/(dashboard)/manager/bookings/page.tsx`
- `/manager/notifications` -> `src/app/(dashboard)/manager/notifications/page.tsx`
- `/owner/bookings` -> `src/app/(dashboard)/owner/bookings/page.tsx`
- `/owner/notifications` -> `src/app/(dashboard)/owner/notifications/page.tsx`
- `/staff-portal` -> `src/app/(dashboard)/staff-portal/page.tsx`
- `/staff-portal/notifications` -> `src/app/(dashboard)/staff-portal/notifications/page.tsx`
- `/staff-portal/schedule`, `/staff-portal/today`, `/staff-portal/week`, `/staff-portal/dispatch`, `/staff-portal/profile`, `/staff-portal/stats`
- No route exists for `/staff/bookings`.
- No route exists for `/staff-portal/bookings`.
- No `[bookingId]` booking detail route was found under CRM, manager, owner, or staff portal.

## Files Inspected

- `src/app/(public)/book/page.tsx`
- `src/app/(public)/book/success/page.tsx`
- `src/app/(public)/book/confirm/page.tsx`
- `src/app/(public)/book/[branchId]/page.tsx`
- `src/app/(public)/book/[branchId]/[serviceId]/page.tsx`
- `src/components/public/booking-wizard.tsx`
- `src/components/public/booking-service-picker.tsx`
- `src/app/api/public/booking-context/route.ts`
- `src/app/api/booking/available-slots/route.ts`
- `src/app/api/public/dispatch-slots/route.ts`
- `src/lib/actions/online-booking.ts`
- `src/lib/actions/inhouse-booking.ts`
- `src/app/(dashboard)/manager/walkin/actions.ts`
- `src/app/(dashboard)/manager/bookings/actions.ts`
- `src/app/(dashboard)/owner/bookings/actions.ts`
- `src/app/(dashboard)/crm/bookings/page.tsx`
- `src/app/(dashboard)/crm/bookings/new/page.tsx`
- `src/app/(dashboard)/manager/bookings/page.tsx`
- `src/app/(dashboard)/owner/bookings/page.tsx`
- `src/components/features/bookings/bookings-workspace.tsx`
- `src/components/features/bookings/bookings-table.tsx`
- `src/components/features/dashboard/payment-action-menu.tsx`
- `src/components/features/dashboard/booking-action-menu.tsx`
- `src/components/features/notifications/notification-bell.tsx`
- `src/components/features/notifications/notification-popover.tsx`
- `src/components/features/notifications/notification-row.tsx`
- `src/components/features/notifications/notification-card.tsx`
- `src/components/features/notifications/action-required-list.tsx`
- `src/components/features/notifications/notification-list-client.tsx`
- `src/lib/notifications/create.ts`
- `src/lib/notifications/workflow-notifications-store.ts`
- `src/lib/notifications/workflow-dedupe.ts`
- `src/lib/notifications/types.ts`
- `src/lib/notifications/queries.ts`
- `src/lib/notifications/notification-targets.ts`
- `src/lib/engine/availability.ts`
- `src/lib/engine/resource-availability.ts`
- `src/lib/queries/bookings.ts`
- `src/lib/queries/branches.ts`
- `src/lib/queries/branch-booking-rules.ts`
- `src/lib/validations/booking.ts`
- `src/types/index.ts`
- `src/types/supabase.ts`
- `src/lib/staff/display-name.ts`
- `src/lib/staff/service-providers.ts`
- `supabase/migrations/20260429000001_core_tables.sql`
- `supabase/migrations/20260429000004_triggers.sql`
- `supabase/migrations/20260429000006_availability_rpc.sql`
- `supabase/migrations/20260502000002_payment_fields.sql`
- `supabase/migrations/20260512000001_workspace_notifications.sql`
- `supabase/migrations/20260517000001_booking_payment_logs.sql`
- `supabase/migrations/20260519000001_workflow_signal_foundation.sql`
- `supabase/migrations/20260521000003_add_staff_nickname.sql`

## Current Public Booking Flow

The public booking route `/book` renders `BookingWizard` in public mode. The wizard loads branches, branch services, staff/provider lookup, booking rules, available slots, and then calls `createOnlineBookingMultiAction` on submit.

| Step | Component/File | Data Used | User Action | Current Behavior | Problem/Risk |
| --- | --- | --- | --- | --- | --- |
| Public route | `src/app/(public)/book/page.tsx` | None beyond page render | Customer opens `/book` | Renders `BookingWizard` | Correct entry point. |
| Branch selection | `src/components/public/booking-wizard.tsx`, `/api/public/booking-context` | Active branches from `getAllBranches()` | Customer selects branch | Defaults selected branch from request or first active branch | Branches are active-only; no payment issue here. |
| Visit type | `BookingWizard`, `src/lib/bookings/visit-type-availability.ts` | Branch booking rules, in-spa/home-service flags | Customer chooses in-spa or home service | Filters services by visit type eligibility | Correctly shapes service list, but final booking is still manual-payment pending. |
| Service selection | `src/components/public/booking-service-picker.tsx` | Branch services returned by booking context | Customer selects one or more services | Displays category tabs and service cards with title, one-line description, duration, price | Cards can still be bulky with long service names; future compact pass belongs here. |
| Location step | `BookingWizard`, `src/components/public/places-autocomplete.tsx` | Google place details for home service | Customer selects address for home service | Requires precise Google location for public home service | Relevant only to home service; no payment capture. |
| Date/time selection | `BookingWizard`, `/api/booking/available-slots` | Branch ID, selected service IDs, date, booking rules, availability slots | Customer selects date and slot | Fetches availability, normalizes per-staff rows to public time rows, filters by visit type | Pending bookings block availability indefinitely because there is no hold expiry. |
| Therapist selection | `BookingWizard` `StepTherapist` | Available staff at selected slot plus staff lookup | Customer picks Any Available or a provider | Shows `staff.staff_name`, provider type badge, and sometimes full legal name as secondary | Nickname is partially supported, but full name can appear publicly as secondary when nickname exists. |
| Customer details | `BookingWizard` `StepDetails` | Name, phone, email, notes, home address recap | Customer enters details | No payment fields appear | Public booking can submit without payment. |
| Submit | `BookingWizard.handleSubmit` | Branch, service IDs, staff ID, date, time, customer details, home-service fields | Customer clicks Confirm Booking | Calls `createOnlineBookingMultiAction` for public mode | Creates DB booking(s) before payment; status pending, payment unpaid. |
| Final toast | `BookingWizard.handleSubmit` | Action result | Submit succeeds | Shows toast `Booking confirmed!` for public booking | Misleading because payment and CRM confirmation have not happened. |
| Final screen | `BookingWizard.StepSuccess` | Booking ID, selected services | Submit succeeds | Shows `Booking Received`, says team will contact customer shortly | Better than toast, but does not mention payment confirmation or temporary hold. |

## Current Booking Creation Flow

| Function/Action | File | Called From | Tables Touched | Status Set | Notifications Created | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| `createOnlineBookingMultiAction` | `src/lib/actions/online-booking.ts` | Public `BookingWizard.handleSubmit` | `customers` via `upsert_customer`, `bookings`; reads branch services, rules, dispatch conflicts | `pending` | Staff assignment/home-service assignment plus CRM `payment_pending`; optional CRM home-service location/dispatch warnings | Main risky path: staff gets notified before payment, slot is blocked indefinitely, no hold expiry. |
| `createOnlineBookingAction` | `src/lib/actions/online-booking.ts` | Legacy/single-service path; not the current multi-service wizard path | `customers`, `bookings` | `pending` | Staff `booking_assigned` and CRM `payment_pending` | Same payment/notification risks if still reachable. |
| `createInhouseBookingMultiAction` | `src/lib/actions/inhouse-booking.ts` | `/crm/bookings/new` via `BookingWizard mode="inhouse"` | `customers`, `bookings`; reads branch services, rules, resources, dispatch conflicts | `confirmed` | Staff assignment plus CRM `payment_pending`; optional CRM home-service notifications | CRM booking is confirmed before payment is recorded. |
| `createWalkinBookingAction` | `src/app/(dashboard)/manager/walkin/actions.ts` | Manager walk-in flow | `customers`, `bookings`; reads resources and availability | `confirmed` | No explicit notification found in this action | Also confirms before payment; appears older/single-service flow. |
| `create_online_booking` RPC | `supabase/migrations/20260429000006_availability_rpc.sql` | Legacy DB function; current action inserts directly | `customers`, `bookings`; triggers booking events | `pending` | No workspace notification; DB trigger logs `booking_events` only | Still documents old atomic intent, but not current notification behavior. |

Current `createOnlineBookingMultiAction` inputs:

- `branchId`
- `serviceIds`
- optional `staffId`
- `date`
- `startTime`
- `type` (`online` or `home_service`)
- optional `deliveryType`
- optional `travelBufferMins`
- customer `fullName`, `phone`, `email`, `notes`
- home-service address/place fields

Current validation:

- Zod validation in `createOnlineBookingMultiSchema`.
- Branch rules validation through `validateBookingAgainstBranchRules`.
- Branch service checks for active service and in-spa/home-service availability flags.
- Staff assignment through `assignTherapistBySeniorityMulti` or `assertMultiServiceSlotAvailable`.
- Home-service precise location and dispatch conflict checks.

Current inserts:

- One row per selected service is inserted into `bookings`.
- Multi-service rows are chained by advancing `currentStart`; the returned `bookingId` is the first inserted row.
- Group metadata is attached to notifications as `group_booking_ids`, not as a first-class booking group table or booking group ID.

## Current Booking Status Model

| Status Value | Found In | Meaning In Current Code | Blocks Availability? | Used By UI? | Notes |
| --- | --- | --- | --- | --- | --- |
| `pending` | `src/types/index.ts`, `bookings.status` check, public booking actions | Online request created but not fully confirmed by CRM/payment workflow | Yes. Availability blocks everything except `cancelled` and `no_show` | Yes, badges/lists can display it | Public online default. No expiry. |
| `confirmed` | `src/types/index.ts`, booking status validation, in-house/walk-in actions | Confirmed appointment | Yes | Yes | CRM in-house and walk-in actions use this immediately. |
| `in_progress` | `src/types/index.ts`, status validation, progress UI | Active service/session | Yes | Yes | Status action can set this. |
| `completed` | `src/types/index.ts`, status validation, reports | Finished booking | Yes in availability logic because only cancelled/no-show are excluded | Yes | Future completed bookings should not matter for future dates, but same-date logic treats them as busy. |
| `cancelled` | `src/types/index.ts`, status validation | Cancelled appointment | No | Yes | Frees availability. |
| `no_show` | `src/types/index.ts`, status validation | Customer did not arrive | No | Yes | Frees availability. |

Answers:

- Booking status and payment status are separate fields.
- Booking status values are `pending`, `confirmed`, `in_progress`, `completed`, `cancelled`, `no_show`.
- Payment status values are `unpaid`, `pending`, `paid`, `refunded`.
- There is a source-like `bookings.type` field with `online`, `walkin`, and `home_service`, plus `delivery_type` with `in_spa` or `home_service`.
- There is no `hold_expires_at` or equivalent booking hold field.
- There is no `confirmed_at` or `confirmed_by_user_id` field.
- There is no `payment_confirmed_at` or `payment_confirmed_by_user_id` field.
- There is no `crm_follow_up_status` field.

## Current Payment Model

| Payment Field/Table | Found In | Current Use | Used In Booking? | Gap |
| --- | --- | --- | --- | --- |
| `bookings.payment_method` | `supabase/migrations/20260502000002_payment_fields.sql`, `src/types/supabase.ts` | Defaults to `pay_on_site`; updated by manager/CRM payment action | Yes, queried in bookings workspace and daily payment summary | No confirmation actor/timestamp. |
| `bookings.payment_status` | Same | Defaults to `unpaid`; updated to `unpaid`, `pending`, `paid`, `refunded` | Yes | Does not drive booking confirmation automatically. |
| `bookings.payment_reference` | Same | Optional reference entered during payment update | Yes | No proof upload or provider metadata model. |
| `bookings.amount_paid` | Same | Defaults to 0; updated by payment action and used in summaries | Yes | No balance due field; balance is computed from metadata price. |
| `booking_payment_logs` | `supabase/migrations/20260517000001_booking_payment_logs.sql` | Append-only audit of payment changes | Yes, manager/owner payment actions insert logs | RLS is broad authenticated insert/select; future tightening may be needed. |
| Payment proof upload | Not found | Not supported | No | Needed later if customers submit proof or CRM attaches receipt images. |
| Payment confirmed by | Not found | Not supported | No | Need field or log semantics later. |
| Payment confirmed at | Not found | Not supported | No | Need field or log semantics later. |
| Separate payments table | Not found beyond `booking_payment_logs` | No transaction table | No | Current log is audit trail, not payment ledger. |

The current manual payment model is enough to mark a booking paid/unpaid/pending/refunded, but it is not enough to model "slot held pending payment until X", "CRM confirmed payment at X", "CRM confirmed booking at X", or "this online request is awaiting CRM follow-up".

## Current Availability And Slot Blocking Logic

| Availability Rule | File/Function | Current Behavior | Problem/Risk | Future Needed Behavior |
| --- | --- | --- | --- | --- |
| Public slot API | `src/app/api/booking/available-slots/route.ts` | Accepts `branchId`, `serviceIds` or `serviceId`, `date`, optional `staffId`; calls `getAvailableSlotsMulti` or `getAvailableSlots` | No hold/payment awareness | Include hold expiry semantics once added. |
| Core RPC | `supabase/migrations/20260429000006_availability_rpc.sql` `get_available_slots` | Generates staff slots from schedules/overrides and marks busy if booking status is not `cancelled` or `no_show` | `pending` and unpaid bookings block indefinitely | Pending online holds should block only until `hold_expires_at`, unless CRM extends/confirms. |
| Multi-service conflict check | `src/lib/engine/availability.ts` `getAvailableSlotsMulti` | Fetches existing bookings for candidate staff/date and excludes statuses `cancelled`, `no_show` | Same indefinite pending block | Use same status/hold rule as single-service RPC. |
| Insert-time race checks | `assertSlotAvailable`, `assertMultiServiceSlotAvailable`, RPC legacy race check | Rejects if a conflicting non-cancelled/no-show booking exists | Correct for confirmed appointments, too broad for expired holds | Treat expired holds as non-blocking. |
| Resource availability | `src/lib/engine/resource-availability.ts` | Room/bed conflict ignores only `cancelled`, `no_show` | Pending unpaid booking holds resources forever | Apply hold expiry to resource conflicts too. |
| Dispatch slots | `src/app/api/public/dispatch-slots/route.ts` | Home-service slots count bookings with statuses `pending`, `confirmed`, `in_progress` | Pending home-service booking blocks dispatch capacity forever | Expired holds should not block dispatch capacity. |
| Branch services | `src/lib/queries/branches.ts`, `src/app/api/public/booking-context/route.ts` | Public context loads active branch services, joins services/categories, filters visibility public, uses override fallbacks | Creation re-checks active and mode flags but does not clearly re-check public visibility | Public insert should re-verify public visibility for online bookings. |
| Staff eligibility | `src/lib/engine/availability.ts`, `src/lib/staff/service-providers.ts`, booking context | Filters to active service providers; excludes non-provider staff types; uses staff service mappings when present | Reasonable current MVP behavior | Keep excluding driver/utility/admin. |
| Booking rules | `src/lib/queries/branch-booking-rules.ts`, `src/lib/bookings/visit-type-availability.ts` | Rules determine visit type availability, booking windows, same-day, buffers, etc. | No payment/hold rule integration | Add hold duration/expiry policy in rules or workflow config. |

Important answer:

A pending manual-payment online booking currently blocks the selected slot forever until its booking status is changed to `cancelled` or `no_show`. It does not become confirmed automatically, and it does not expire automatically.

Cancelled bookings do not block slots. No-show bookings do not block slots. Pending, confirmed, in-progress, and completed bookings block slots.

## Current CRM Booking Flow

| CRM Flow Step | Component/File | Current Behavior | Payment Included? | Gap |
| --- | --- | --- | --- | --- |
| CRM new booking route | `src/app/(dashboard)/crm/bookings/new/page.tsx` | Renders `BookingWizard mode="inhouse"` | No payment step before submit | CRM can create a confirmed booking without recording payment first. |
| In-house branch/service/date flow | `src/components/public/booking-wizard.tsx` | Reuses same wizard but with in-house mode | No | Online and CRM share too much confirmation UX/logic. |
| In-house submit | `src/lib/actions/inhouse-booking.ts` `createInhouseBookingMultiAction` | Inserts booking rows as `confirmed` | Defaults to unpaid/pay-on-site | Should require payment capture or explicit unpaid exception before final confirmation. |
| CRM payment update | `src/components/features/dashboard/payment-action-menu.tsx`, `src/app/(dashboard)/manager/bookings/actions.ts` | CRM can mark payment after booking exists from bookings workspace/details panel | Yes, after creation | Payment confirmation is not linked to booking confirmation. |
| CRM booking list/detail | `src/app/(dashboard)/crm/bookings/page.tsx`, `BookingsWorkspace`, `BookingsTable` | Shows bookings and a side details panel after selecting a row | Payment menu exists in panel | No deep-linked booking detail route or auto-open from notification link. |

Answers:

- CRM cannot currently record payment before creating a booking in `/crm/bookings/new`.
- CRM-created bookings become `confirmed` immediately.
- CRM has a booking list with side detail panel, not a standalone booking detail page.
- The future payment confirmation panel can live first inside `BookingsTable` `BookingDetailsPanel`; a dedicated `/crm/bookings/[bookingId]` route or query-param auto-open behavior would be safer for notifications.

## Current Notification Creation Flow

| Notification Trigger | Function/File | Recipient | Title/Message | href | Duplicate Risk |
| --- | --- | --- | --- | --- | --- |
| Public online booking created | `createOnlineBookingMultiAction` | Staff provider (`targetWorkspace: "staff"`) | `New booking assigned` or `Home Service booking assigned` | `/staff-portal` | High workflow risk: staff notified before payment confirmation. |
| Public online booking created | `createOnlineBookingMultiAction` | CRM workspace | `Payment needs follow-up` | `/crm/bookings` | Intended second notification for same booking. |
| Public home-service location review | `createOnlineBookingMultiAction` | CRM workspace | `Home Service location needs review` | `/crm/today` | Additional CRM action item for same booking. |
| Public home-service dispatch warning | `createOnlineBookingMultiAction` | CRM workspace | `Possible Home Service dispatch conflict` | `/crm/today` | Additional CRM action item for same booking. |
| Legacy public single-service booking | `createOnlineBookingAction` | Staff and CRM | Same staff assignment and CRM payment pending titles | `/staff-portal`, `/crm/bookings` | Same risks if path is still used. |
| CRM/in-house booking created | `createInhouseBookingMultiAction` | Staff provider | `New booking assigned` or `Home Service booking assigned` | `/staff-portal` | Appropriate only after payment/confirmation policy is decided. |
| CRM/in-house booking created | `createInhouseBookingMultiAction` | CRM workspace | `Payment needs follow-up` | `/crm/bookings` | Creates payment follow-up after a booking that is already `confirmed`. |
| Payment marked unpaid/pending | `updateBookingPaymentAction` | CRM workspace | `Payment needs follow-up` | `/crm/bookings?bookingId=<id>` | Dedupe should update existing open notification, but older/no-dedupe rows can duplicate. |
| Payment marked paid/refunded | `updateBookingPaymentAction` | CRM workspace | Resolves `payment_pending` | N/A | Correct direction, but does not confirm booking status. |
| Booking cancelled | `updateBookingStatusAction` | Staff provider | `Booking cancelled` | staff route helper | Low; action-specific. |
| Booking confirmed/status change | `updateBookingStatusAction` | Staff provider | Current code path references `customer_arrived` on confirmation | staff route helper | Naming/action semantics need review in Phase 2/5. |
| DB booking insert trigger | `supabase/migrations/20260429000004_triggers.sql` | `booking_events`, not notification | Logs from/to status | N/A | Not a workspace notification duplicate source. |

Notifications are inserted through `createNotification`, which calls `createOrUpdateNotification`. The store builds a dedupe key and updates an existing open notification with the same key before inserting. The dedupe migration adds `workspace_notifications.dedupe_key` and a unique index for open `unread`/`read` notifications.

## Duplicate Notification Analysis

| Duplicate Source Candidate | Evidence | Confirmed? | Recommended Fix |
| --- | --- | --- | --- |
| Public booking action intentionally creates staff and CRM notifications | `createOnlineBookingMultiAction` creates a staff assignment notification and a CRM `payment_pending` notification for the first booking ID | Confirmed as multi-notification behavior | Future online request should initially create one actionable CRM notification only; staff notification waits for payment/confirmation. |
| Home-service online booking creates multiple CRM action notifications | Same action can add `home_service_location_review` and `home_service_dispatch_conflict` | Confirmed when conditions apply | Keep distinct task types if genuinely actionable, but group/label them clearly and avoid duplicate payment notifications. |
| In-house booking creates staff notification plus CRM payment follow-up | `createInhouseBookingMultiAction` creates both after inserting confirmed booking | Confirmed | CRM in-house flow should collect payment before final submit or explicitly create one payment task when unpaid exception is chosen. |
| Same-type notification duplicate | `createOrUpdateNotification` dedupes by key and unique open index exists in migration | Not confirmed from code alone | Verify production/local DB has `dedupe_key` column/index and rows are populated. |
| Client-side duplicate creation | Notification UI only queries/marks/dismisses; no client-side creation found | Not confirmed | No Phase 2 fix needed unless runtime evidence says server action is double-called. |
| DB trigger duplicate | Booking insert trigger writes `booking_events`, not `workspace_notifications` | Ruled out for workspace notification duplicates | No notification-trigger DB fix needed. |
| Notification panel showing multiple workspaces | Owner RLS can see all notifications; CRM/staff RLS should scope by target workspace/recipient | Possible depending on logged-in role | Distinguish "same booking, different audience" from true duplicate rows in UI and queries. |

Most likely user-visible cause: one booking creates more than one notification by design today. For the future manual-payment online flow, that behavior is wrong because the only first actionable event should be CRM payment/confirmation follow-up.

## Broken Notification Link Analysis

| Notification href | Generated In | Route Exists? | Correct Route | Notes |
| --- | --- | --- | --- | --- |
| `/staff/bookings?bookingId=<id>` | Derived by `computeHref` in `notification-row.tsx` and `notification-card.tsx` when `target_workspace` is `staff` | No | `/staff-portal` for current staff portal, or a future real staff booking detail route | Root cause is workspace naming mismatch: DB uses `staff`, URL helper knows `staff-portal`. |
| `/staff-portal` | Stored by public and in-house booking actions for staff notifications | Yes | `/staff-portal` or more specific `/staff-portal/schedule` | Stored href is valid, but UI normalization can rewrite it incorrectly. |
| `/staff-portal/bookings?bookingId=<id>` | `getNotificationTargetPath({ workspace: "staff-portal", entityType: "booking" })` would produce this | No | `/staff-portal` or future detail page | Helper assumes every workspace has `/bookings`. Staff portal does not. |
| `/crm/bookings` | Stored by booking creation payment notifications | Yes | `/crm/bookings?bookingId=<id>` or future `/crm/bookings/[bookingId]` | Current route exists but does not auto-open detail. |
| `/crm/bookings?bookingId=<id>` | `getNotificationTargetPath({ workspace: "crm", entityType: "booking" })` | Page route exists, but no detail auto-open | Make `/crm/bookings` read `bookingId` and select/open the booking, or create `/crm/bookings/[bookingId]` | Best target for online pending-payment CRM action. |
| `/manager/bookings?bookingId=<id>` | Helper can produce it | Page route exists, but no detail auto-open | Same query-param auto-open or detail route pattern | Manager route currently ignores `bookingId`. |
| `/owner/bookings?bookingId=<id>` | Helper can produce it | Page route exists, but no detail auto-open | Same query-param auto-open or detail route pattern | Owner route currently ignores `bookingId`. |

Broken href root cause:

- `workspace_notifications.target_workspace` allows `staff`, not `staff-portal`.
- `src/lib/notifications/notification-targets.ts` defines URL workspace contexts as `owner`, `manager`, `crm`, `staff-portal`, `driver`, `utility`.
- `NotificationRow` and `NotificationCard` cast `n.target_workspace` directly to the URL workspace type. For a staff notification, `ws` becomes runtime string `staff`.
- `getWorkspacePathPrefix("staff" as any)` returns `undefined`.
- Since `/staff-portal`.startsWith(undefined) is false, the row/card computes a fallback with `workspace: "staff"`, producing `/staff/bookings?bookingId=<id>`.
- `/staff/bookings` does not exist, so the notification opens a 404.

Recommended future behavior:

- Online booking pending-payment notifications should route to CRM booking detail or CRM bookings list with auto-selected booking.
- Staff booking notification should not exist for online bookings until CRM confirms payment and finalizes the appointment.
- If staff notification is needed after confirmation, route it to a real staff portal target, not `/staff/bookings`.

## Existing Booking Detail Routes

- No standalone booking detail route exists for CRM, manager, owner, or staff portal.
- `src/lib/queries/bookings.ts` has `getBookingById(bookingId)`.
- `src/app/(dashboard)/owner/bookings/actions.ts` exposes `getOwnerBookingDetailAction(bookingId)`.
- `BookingsTable` has an in-page `BookingDetailsPanel`, opened by local selected row state.
- `ScheduleWorkspace` has a sheet/details panel opened by local selected booking state.
- `/crm/bookings` accepts `highlight` in `searchParams`, but that value is not passed into `BookingsWorkspace` and no auto-select behavior was found.
- `/crm/bookings?bookingId=<id>` currently lands on the list page but does not open the booking.
- `/manager/bookings?bookingId=<id>` and `/owner/bookings?bookingId=<id>` similarly do not auto-open details.

Practical Phase 2 route choices:

- Fastest safe route fix: make notification target `/crm/bookings?bookingId=<id>` and teach `BookingsWorkspace`/`BookingsTable` to select that booking if present in the loaded list.
- More complete route fix: add `/crm/bookings/[bookingId]` and reuse `getBookingById`/payment actions in a focused detail page.

## Public Booking Final Confirmation Screen

| Screen/Component | File | Current Message | Problem | Recommended Copy |
| --- | --- | --- | --- | --- |
| Success toast | `src/components/public/booking-wizard.tsx` `handleSubmit` | `Booking confirmed!` with `We look forward to welcoming you at Cradle.` | Misleading because online payment is manual and booking status is `pending` | Use request/pending wording, not confirmed wording. |
| Wizard success screen | `src/components/public/booking-wizard.tsx` `StepSuccess` | `Booking Received`; `Your appointment request has been received and our team will contact you shortly to confirm.` | Does not mention manual payment or temporary hold | `Booking request received ✨ Our CRM team will contact you shortly to confirm your payment and finalize your appointment. We're temporarily holding your selected time while we process your request.` |
| Separate success route | `src/app/(public)/book/success/page.tsx` | `Your Booking Request Was Received`; front desk will review and confirm details | Not currently the main wizard success state | Keep aligned with wizard if still used later. |

Do not implement this copy in Phase 1. The implementation should happen in Phase 3.

## Staff/Therapist Public Display Inventory

| Display Area | Component/File | Current Name Field | Nickname Available? | Tier Shown? | Recommended Future |
| --- | --- | --- | --- | --- | --- |
| Public booking staff context | `src/app/api/public/booking-context/route.ts` | Returns `name` from `getStaffDisplayName(member)`, plus `fullName`, `nickname`, `staffType`, `serviceIds` | Yes, `staff.nickname` is selected when column exists | Tier is selected internally | Return only public-safe display fields for public mode; avoid exposing legal full name unless it is the intended public display. |
| Staff display helper | `src/lib/staff/display-name.ts` | `nickname` -> `full_name` | Yes | No | Extend later to `nickname` -> `public_display_name` -> `first_name` -> `full_name` after schema supports those fields. |
| Therapist selection cards | `src/components/public/booking-wizard.tsx` `StepTherapist` | `staff.staff_name` | Yes via lookup | Tier not rendered; provider type badge is rendered | Do not show full legal name as secondary in public mode. |
| Therapist sorting | `staffAtSlot` in `booking-wizard.tsx` | Sorts by `staff_tier`, then display name | Yes | Tier not rendered | Internal sorting can remain, but no tier label should be public. |
| Staff schema | `supabase/migrations/20260429000001_core_tables.sql`, `src/types/supabase.ts`, `20260521000003_add_staff_nickname.sql` | `full_name`, `nickname`, `tier`, `system_role`, `staff_type` | `nickname` exists in newer migration/types | No public_display_name or first_name field found | Future fallback requires schema support for `public_display_name` and/or `first_name`, or a derived first-name parser if approved. |

Current public display rule in code is effectively `nickname` -> `full_name`. The requested future rule `nickname` -> `public_display_name` -> `first_name` -> `full_name` is not fully supported by current schema because `public_display_name` and `first_name` were not found.

## Service Card Display Inventory

| Display Area | Component/File | Current Fields | Problem | Recommended Future |
| --- | --- | --- | --- | --- |
| Public service picker | `src/components/public/booking-service-picker.tsx` | Service category, `service.name`, `service.durationMinutes`, one-line `service.description`, formatted `service.price`, selection icon | Long names can still dominate; no expandable details state | Use compact layered card text: title, one-line short description, price, duration, badges, optional expand/details. |
| Public context service mapping | `src/app/api/public/booking-context/route.ts` | `public_title` or service name, `public_description` or service description, branch override duration/price fallback | Good fallback behavior after recent wiring | Preserve fallback behavior. |
| Booking summary sidebar | `src/components/public/booking-wizard.tsx` | Selected services, total duration, total price, date/time/provider | Not the main service-card issue | Keep summary concise. |
| Success service recap | `src/components/public/booking-wizard.tsx` `StepSuccess` | Selected service names | Fine for confirmation | Future copy should align with request/hold flow. |

Do not redesign service cards in Phase 1.

## CRM Payment Confirmation Gap

The CRM workspace can currently update payment after a booking exists through `PaymentActionMenu` in bookings/schedule details. However:

- CRM `/crm/bookings/new` does not collect payment before booking submission.
- `createInhouseBookingMultiAction` creates bookings as `confirmed` immediately.
- Payment updates do not automatically confirm booking status.
- Marking payment paid resolves CRM `payment_pending` notifications, but does not record `payment_confirmed_at`, `payment_confirmed_by_user_id`, `confirmed_at`, or `confirmed_by_user_id`.
- There is no dedicated CRM "Confirm payment and finalize booking" action.
- There is no booking detail route that notification links can reliably open.

Recommended later placement:

- Short term: add the CRM payment confirmation controls to the existing `BookingDetailsPanel` inside `BookingsTable`, because payment controls already live there.
- Better route behavior: add query-param auto-open on `/crm/bookings?bookingId=<id>` or add `/crm/bookings/[bookingId]`.
- The confirmation action should mark payment fields and booking confirmation fields/status atomically.

## Temporary Hold / Pending Payment Gap

Current schema and code do not model temporary holds.

Missing pieces:

- No `hold_expires_at`.
- No `pending_payment` booking status.
- No `expired` booking status.
- No hold-expiry worker/job/action.
- No availability logic that treats expired pending holds as non-blocking.
- No CRM UI to extend, confirm, or release a hold.
- No customer-facing explanation that the slot is held only temporarily.

Current behavior:

- Online booking inserts `status = pending`.
- Payment defaults to `payment_status = unpaid`.
- Availability blocks the slot because `pending` is not `cancelled` or `no_show`.
- Nothing expires the pending booking, so the hold is effectively permanent until manual status change.

## Notification Sound Readiness

Current notification UI structure:

- Header uses `NotificationBell` in `src/components/features/dashboard/header.tsx`.
- `NotificationBell` polls unread count every 30 seconds while closed.
- Opening the bell fetches recent notifications with `getRecentNotificationsAction`.
- Dropdown rendering is `NotificationPopover`.
- Full notification pages use `NotificationListClient`, `NotificationSection`, `NotificationRow`/`NotificationCard`.
- No `new Audio`, `audio`, sound file, browser notification permission flow, or one-shot sound state was found.

Readiness for future sound:

- The bell already has a polling loop and local notification item state.
- A future sound should compare newly fetched actionable CRM/manager notification IDs against a remembered seen set.
- It must be gated by user interaction or an explicit "enable notification sound" control to respect browser autoplay restrictions.
- Sound should trigger only for new actionable online booking request notifications, not every unread count change.

## Data Model Gap Analysis

| Future Need | Existing Field/Table? | Gap | Migration Needed Later? | Notes |
| --- | --- | --- | --- | --- |
| `bookings.status` | Yes | Current values lack `pending_payment`/`expired`; `pending` is generic | Maybe | Could reuse `pending`, but hold/payment semantics need clarity. |
| `bookings.payment_status` | Yes | Supports unpaid/pending/paid/refunded | No for basic status; maybe for confirmation audit | Does not confirm booking by itself. |
| `bookings.payment_method` | Yes | Basic methods exist | No for current methods | Add methods only if business requires. |
| `bookings.payment_reference` | Yes | Basic reference exists | No for simple manual proof | More structured proof/upload needs new field/table. |
| `bookings.amount_paid` | Yes | Amount paid exists | No | Balance is computed, not stored. |
| `bookings.payment_confirmed_at` | No | Cannot record when CRM confirmed payment | Yes | Important for audit trail. |
| `bookings.payment_confirmed_by_user_id` or staff ID | No | Cannot record who confirmed payment | Yes | Prefer staff ID if CRM users are staff records. |
| `bookings.hold_expires_at` | No | Cannot release unpaid online slots automatically | Yes | Required for temporary hold. |
| `bookings.source` | Partial | `type` is online/walkin/home_service; `delivery_type` is in_spa/home_service | Maybe | If source must distinguish public online vs CRM/manual, add explicit `source`. |
| `bookings.confirmed_at` | No | Cannot record final confirmation time | Yes | Useful when pending payment becomes confirmed. |
| `bookings.confirmed_by_user_id` or staff ID | No | Cannot record confirming CRM/manager | Yes | Pair with `confirmed_at`. |
| `bookings.crm_follow_up_status` | No | No structured CRM workflow state | Maybe | Could also use workflow tasks if fully wired. |
| `booking_payment_logs` | Yes | Audit logs exist for payment changes | No for logs; yes for linking confirmation | Could remain append-only payment audit. |
| `workspace_notifications.dedupe_key` | Yes in migration | Must verify DB has migration applied | No if applied | Needed for duplicate control. |
| `workflow_tasks` | Yes in migration | Not clearly used by booking flow yet | Maybe no table; yes wiring | Could be better than notification-only actionable items. |
| Booking group ID | No | Multi-service creates multiple booking rows with only notification metadata grouping | Maybe | Needed if CRM should confirm/pay group as one request. |
| Public staff display fields | Partial | `nickname` exists; `public_display_name` and `first_name` not found | Maybe | Needed to implement requested fallback exactly. |

## Actions And Mutations Inventory

| Action/Mutation | File | Purpose | Current Payment/Notification Relevance |
| --- | --- | --- | --- |
| `createOnlineBookingMultiAction` | `src/lib/actions/online-booking.ts` | Main public booking creation | Creates pending/unpaid booking rows and multiple notifications. |
| `createOnlineBookingAction` | `src/lib/actions/online-booking.ts` | Legacy single-service online creation | Same pending/unpaid/staff+CRM notification pattern. |
| `createInhouseBookingMultiAction` | `src/lib/actions/inhouse-booking.ts` | CRM/manager in-house booking creation | Creates confirmed/unpaid booking rows and notifications. |
| `createWalkinBookingAction` | `src/app/(dashboard)/manager/walkin/actions.ts` | Manager walk-in creation | Creates confirmed booking; no payment capture before insert. |
| `updateBookingStatusAction` | `src/app/(dashboard)/manager/bookings/actions.ts` | Manager/CRM status transition | Updates status and creates/resolves staff notifications for some transitions. |
| `editBookingAction` | `src/app/(dashboard)/manager/bookings/actions.ts` | Reschedule/reassign/edit booking | Re-validates slot/resource and creates reassignment/reschedule notifications. |
| `updateBookingPaymentAction` | `src/app/(dashboard)/manager/bookings/actions.ts` | CRM/manager payment update | Writes `booking_payment_logs`, updates payment fields, resolves/creates CRM `payment_pending`. |
| `ownerUpdateBookingStatusAction` | `src/app/(dashboard)/owner/bookings/actions.ts` | Owner status transition | Updates status without the same notification behavior. |
| `ownerUpdateBookingPaymentAction` | `src/app/(dashboard)/owner/bookings/actions.ts` | Owner payment update | Writes payment log and fields; no CRM notification side effect. |
| `createNotification` | `src/lib/notifications/create.ts` | Server notification creation wrapper | Calls deduping store; logs errors safely. |
| `createOrUpdateNotification` | `src/lib/notifications/workflow-notifications-store.ts` | Inserts or updates workspace notification | Dedupe point for duplicate prevention. |
| `resolveNotificationsForEntity` | `src/lib/notifications/create.ts` | Resolve entity notifications | Used by payment/status flows. |
| Notification query actions | `src/lib/notifications/queries.ts` | Read, mark read, dismiss, resolve notifications | UI retrieval/interaction only. |

## Query And API Inventory

| Query/API | File | Purpose | Notes |
| --- | --- | --- | --- |
| `/api/public/booking-context` | `src/app/api/public/booking-context/route.ts` | Loads branches, services, staff/provider data, rules | Public mode returns public branch services and active public-safe staff list. |
| `/api/booking/available-slots` | `src/app/api/booking/available-slots/route.ts` | Returns single/multi-service availability slots | No payment/hold awareness. |
| `/api/public/dispatch-slots` | `src/app/api/public/dispatch-slots/route.ts` | Returns home-service dispatch slot pressure | Counts pending/confirmed/in-progress bookings. |
| `getBranchServices` | `src/lib/queries/branches.ts` | Loads active branch services with public/management fallback paths | Uses override fallback for public data. |
| `getBranchBookingRulesOrDefault` | `src/lib/queries/branch-booking-rules.ts` | Loads branch rules or defaults | Used by public and in-house booking flows. |
| `getAvailableSlots` | `src/lib/engine/availability.ts` | Single-service slots | Calls RPC and filters provider eligibility. |
| `getAvailableSlotsMulti` | `src/lib/engine/availability.ts` | Multi-service slots | Sums duration/buffers and applies conflicts. |
| `get_available_slots` RPC | `supabase/migrations/20260429000006_availability_rpc.sql` | Core slot generation | Blocks all non-cancelled/no-show bookings. |
| `isResourceAvailable` | `src/lib/engine/resource-availability.ts` | Checks room/bed conflicts | Blocks all non-cancelled/no-show bookings. |
| `getTodaysSchedule` | `src/lib/queries/bookings.ts` | Booking list/schedule data for CRM/manager | Includes payment fields when present. |
| `getDailyPaymentSummary` | `src/lib/queries/bookings.ts` | Daily payment totals | Counts active rows excluding cancelled/no-show. |
| `getBookingById` | `src/lib/queries/bookings.ts` | Loads full booking detail with events | Exists but no route uses it as a standalone detail page. |
| Notification read queries | `src/lib/notifications/queries.ts` | Recent/unread/action-required/full list | Relies on RLS for workspace scoping. |

## Route Fix Recommendations

1. Fix workspace-to-URL mapping before changing notification behavior.
   - Treat DB workspace `staff` as URL workspace `/staff-portal`.
   - Do this in `notification-targets.ts` and notification row/card helpers.
   - Do not generate `/staff/bookings`.

2. Decide the CRM booking detail target.
   - Short term: support `/crm/bookings?bookingId=<id>` by passing `bookingId` into `BookingsWorkspace`/`BookingsTable` and selecting/opening the row if it is loaded.
   - More complete: add `/crm/bookings/[bookingId]` using `getBookingById` and existing payment/status actions.

3. Use CRM route for online pending-payment notifications.
   - Online booking request notification should point to CRM booking detail/list selection.
   - Staff notification should not be created until after payment confirmation.

4. Staff route later.
   - If staff need confirmed-booking notifications, route to `/staff-portal`, `/staff-portal/schedule`, or a new staff-safe booking detail route.
   - Staff should not receive pending-payment online booking notifications.

## Workflow Fix Recommendations

A. Public online booking future flow:

- Customer submits online request.
- App creates booking with pending-payment/hold semantics.
- App sets `payment_status = unpaid` or `pending`.
- App sets `hold_expires_at`.
- App creates one actionable CRM notification/task.
- Staff is not notified yet.
- Customer sees request-received/manual payment/temporary hold message.

B. CRM confirmation future flow:

- CRM opens booking detail from notification.
- CRM contacts customer and records payment method/reference/amount.
- CRM confirms payment.
- Booking becomes `confirmed`.
- Confirmation fields are recorded.
- Staff assignment becomes actionable/final.
- Customer/staff notification can be sent after final confirmation.

C. Expired hold future flow:

- Hold expires at `hold_expires_at`.
- Availability ignores expired pending holds.
- Booking is marked expired/cancelled/not_planned according to chosen model.
- CRM can see expired request and suggest next available times.

D. CRM in-house booking future flow:

- CRM selects service/staff/time.
- CRM records payment before final submit, or explicitly marks approved unpaid exception.
- In-house booking is confirmed immediately only after required payment step.

E. Notification future flow:

- One notification or workflow task per actionable online booking request.
- Later state changes update/resolve existing notification/task instead of creating duplicates.
- Notification sound plays once for new actionable CRM/manager booking request notifications only.

## Phased Implementation Plan

## Phase 2 — Fix notification link and duplicate notification behavior

- Files likely touched:
  - `src/lib/notifications/notification-targets.ts`
  - `src/components/features/notifications/notification-row.tsx`
  - `src/components/features/notifications/notification-card.tsx`
  - `src/components/features/notifications/action-required-list.tsx`
  - `src/lib/actions/online-booking.ts`
  - possibly `src/components/features/bookings/bookings-workspace.tsx`
  - possibly `src/components/features/bookings/bookings-table.tsx`
- Risk level: Medium.
- Acceptance criteria:
  - No notification generates `/staff/bookings`.
  - Online booking creates one actionable CRM notification for payment/confirmation.
  - Staff is not notified until confirmation, if that policy is approved.
  - CRM notification link opens a route that exists and surfaces the booking.
  - Existing CRM/manager/owner notification pages still render.

## Phase 3 — Fix public confirmation copy

- Files likely touched:
  - `src/components/public/booking-wizard.tsx`
  - `src/app/(public)/book/success/page.tsx` if still used
- Risk level: Low.
- Acceptance criteria:
  - Public toast and success screen no longer imply final confirmation before payment.
  - Copy mentions CRM payment follow-up and temporary hold.
  - In-house CRM success wording remains separate.

## Phase 4 — Add pending payment / temporary hold model

- Files likely touched:
  - New migration after approval for `hold_expires_at` and any status/source/confirmation fields.
  - `src/types/supabase.ts`
  - `src/lib/actions/online-booking.ts`
  - `src/lib/engine/availability.ts`
  - `src/lib/engine/resource-availability.ts`
  - availability RPC migration or replacement query logic
  - `src/app/api/public/dispatch-slots/route.ts`
  - possibly scheduled cleanup/expiry action
- Risk level: High.
- Acceptance criteria:
  - Pending online requests block slots only until hold expiry.
  - Expired holds no longer block staff, room/resource, or dispatch capacity.
  - Cancelled/no-show behavior remains unchanged.
  - Existing confirmed bookings still block correctly.

## Phase 5 — Add CRM payment confirmation panel

- Files likely touched:
  - `src/components/features/bookings/bookings-table.tsx`
  - `src/components/features/dashboard/payment-action-menu.tsx`
  - `src/app/(dashboard)/manager/bookings/actions.ts`
  - `src/app/(dashboard)/crm/bookings/page.tsx` or new detail route
  - `src/lib/queries/bookings.ts`
- Risk level: High.
- Acceptance criteria:
  - CRM can open pending online request.
  - CRM can record/confirm payment.
  - Booking becomes confirmed only through explicit payment/confirmation action.
  - Confirmation actor/time are recorded if schema is added.
  - CRM payment notification/task is resolved.
  - Staff notification is sent after confirmation if policy requires it.

## Phase 6 — Add CRM in-house payment step

- Files likely touched:
  - `src/components/public/booking-wizard.tsx`
  - `src/lib/actions/inhouse-booking.ts`
  - `src/lib/validations/booking.ts`
  - possibly dedicated CRM booking form components
- Risk level: Medium-high.
- Acceptance criteria:
  - CRM-created bookings require payment capture or explicit approved unpaid exception before final submit.
  - In-house bookings are confirmed only after the payment step rule is satisfied.
  - Public online booking remains separate.

## Phase 7 — Notification sound

- Files likely touched:
  - `src/components/features/notifications/notification-bell.tsx`
  - possibly a settings/preference component
  - possibly a small sound asset
- Risk level: Medium.
- Acceptance criteria:
  - CRM/manager users can enable sound after a user gesture.
  - Sound plays once per new actionable online booking request notification/task.
  - Sound does not replay on every poll.
  - Browser autoplay restrictions are respected.

## Phase 8 — Public booking UI polish

- Files likely touched:
  - `src/components/public/booking-service-picker.tsx`
  - `src/components/public/booking-wizard.tsx`
  - `src/app/api/public/booking-context/route.ts`
  - `src/lib/staff/display-name.ts`
  - possible staff display migration if `public_display_name`/`first_name` is approved
- Risk level: Low-medium.
- Acceptance criteria:
  - Therapist display uses nickname-first public-safe fallback.
  - Private legal/full names are not shown publicly unless no safer display name exists.
  - Therapist tier is not public.
  - Service and therapist cards are compact without changing booking behavior.

## Risk Map

| Area | Risk Level | Why Risky | Safe Approach |
| --- | --- | --- | --- |
| Booking creation | High | Creates rows, assigns staff/resources, emits notifications | Change in small steps with tests and manual booking verification. |
| Availability engine | High | Slot blocking affects revenue and double-booking safety | Add hold handling carefully; keep confirmed booking conflict checks strict. |
| Payment fields | High | Payment records affect cash reconciliation and audit | Prefer additive fields/actions; keep logs append-only. |
| Notification generation | Medium | Too many/few notifications affect CRM/staff operations | Centralize event policy and dedupe; verify RLS/user panels. |
| Staff assignment | Medium-high | Staff notified before/after confirmation affects operations | Separate tentative assignment from final assignment if needed. |
| Public route | Medium | Customer-facing conversion/clarity | Change copy and flow without redesigning wizard. |
| CRM route | Medium-high | CRM needs actionable booking detail and payment confirmation | Reuse existing `BookingsTable` detail panel first or add focused route. |
| RLS/security | High | Public/staff/CRM data visibility must stay constrained | Do not broaden policies; inspect and add minimal policies only after DB evidence. |
| Database migrations | High | Status/check constraints and availability queries depend on schema | Propose exact SQL separately and apply only after approval. |
| Multi-service booking groups | Medium | Current booking creates multiple rows but returns first ID | Decide whether group confirmation/payment should be first-class. |
| Notification sound | Medium | Browser autoplay and repeated polling can annoy users | Require opt-in/user gesture and track played notification IDs. |

## Open Questions

- What is the desired hold duration for public pending-payment bookings?
- Should future status be `pending_payment`, or should existing `pending` plus `payment_status` and `hold_expires_at` be used?
- What should happen to expired holds: new `expired` status, `cancelled` with reason, or separate CRM follow-up state?
- Should multi-service booking requests get a first-class group ID so payment/confirmation applies to the whole request?
- Should CRM confirmation set both `payment_status = paid` and `status = confirmed`, or should there be a separate confirmation action after payment?
- What payment proof, if any, should customers/CRM upload or record?
- Should CRM-created in-house bookings allow unpaid exceptions, and which roles can approve them?
- Should owner notification views intentionally show all workspace notifications, or should they show only owner-targeted notifications by default?
- Should staff ever see pending online requests, or only confirmed bookings?
- Should public therapist display add `public_display_name` and `first_name` fields, or should nickname/full-name remain the only supported schema for now?
