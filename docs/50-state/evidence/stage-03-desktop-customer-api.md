# Hosted Stage 03 Desktop Customer Read Boundary Evidence

## Target

Hosted CradleHub (`techwithmpg/Cradlehub`)

## Stage

Stage 03 — Customers hosted read boundary

## Branch

`stage/03-desktop-customer-api`

## BASE_SHA

`f8455078d212b55595c277c577a80d89995c7585`

## Implementation HEAD

`b8c5f2e0436d4bc2eb76fbe6d52571efc565fc36`

## Desktop Dependency

`stage/03-customers` @ `ec87769bba591d87f98a04640004f35c71086d80`

## Implementation Scope

Owner-authorized, read-only hosted customer API boundary:

- `GET /api/desktop/v1/customers` (paginated customer list with segment tabs, search, KPIs)
- `GET /api/desktop/v1/customers/[customerId]` (customer profile & branch-filtered booking history)

## Changed Files vs Base

- `src/lib/customers/desktop-customer-engine.ts` [NEW] — Authoritative server-only customer read engine (`import "server-only";`)
- `src/app/api/desktop/v1/customers/route.ts` [NEW] — Dedicated authenticated GET endpoint for customer list, search, segments, and KPIs
- `src/app/api/desktop/v1/customers/[customerId]/route.ts` [NEW] — Dedicated authenticated GET endpoint for customer detail and branch-filtered history
- `tests/lib/customers/desktop-customer-engine.test.ts` [NEW] — Unit tests for authorization, branch privacy, segments, KPIs, detail membership, history filtering, and data minimization
- `tests/api/desktop-v1-customers.test.ts` [NEW] — Route-level tests for Bearer auth enforcement, HTTP status mapping, error responses, and `Cache-Control: no-store`
- `docs/50-state/evidence/stage-03-desktop-customer-api.md` [NEW] — This hosted evidence document

## Authentication Model

- Reuses canonical `verifyDesktopBearerAuth(request)` from `@/lib/auth/desktop-bearer-auth`.
- Authenticates incoming Bearer token against Supabase auth.
- Resolves active staff profile linked to `auth_user_id` (`staff` table).
- Enforces CRM workspace role permission (`canAccessCrmWorkspace(staffRole)`).
- Strictly fail-closed (`isDevBypass: false`; no dev bypass shortcuts).
- Returns 401 `UNAUTHORIZED` on missing, malformed, or invalid tokens.
- Returns 403 `STAFF_NOT_FOUND` if user has no active staff record.
- Returns 403 `CRM_PERMISSION_DENIED` if staff role is not authorized for CRM workspace.

## Server-Side Branch Privacy & Authorization

Because the `customers` table contains no `branch_id` column:

1. **Non-Owner Operators**:
   - Authoritative branch is strictly `operator.staff.branch_id`.
   - Renderer-supplied `branchId` cannot override the staff branch.
   - Supplying a different `branchId` immediately returns 403 `CRM_BRANCH_FORBIDDEN`.
2. **Owner Operators**:
   - Supports selecting a branch context via query parameter `branchId` (or falling back to `staff.branch_id`).
   - Verifies the selected branch exists in the `branches` table before querying; returns 400 `BRANCH_NOT_FOUND` if invalid.
   - If no branch context is provided and staff has no branch, returns 400 `BRANCH_REQUIRED`.
3. **List & Search Membership Scoping**:
   - Customer branch membership is resolved server-side through `bookings` records where `branch_id = effectiveBranchId` and `customer_id IS NOT NULL`.
   - Never loads global customers for desktop filtering.
4. **Detail Membership Scoping**:
   - Before returning customer profile, the server verifies the customer has at least one booking in `bookings` for `effectiveBranchId`.
   - If no booking membership exists, returns 404 `CUSTOMER_NOT_FOUND`.
5. **Booking History Filtering**:
   - Booking history is queried strictly with composite filter: `customer_id = customerId` AND `branch_id = effectiveBranchId`.
   - Never returns global booking history from other branches.

## List Endpoint Contract

`GET /api/desktop/v1/customers`

- **Query Parameters**:
  - `tab`: `all` | `repeat` | `lapsed` | `followup` (default `all`)
  - `q`: optional name/phone search query (trimmed, sanitized)
  - `page`: default 1
  - `pageSize`: default 25, maximum 100
  - `branchId`: optional UUID string (validated per server-side branch rules)
- **Business Definitions**:
  - `Repeat`: $\ge 2$ bookings (`total_bookings >= 2`)
  - `Lapsed`: $\ge 30$ days since last booking and at least one booking (`total_bookings >= 1` and `last_booking_date < 30_days_ago`)
  - `KPIs`:
    - `totalCustomers`: count of distinct customers with bookings at effective branch
    - `repeatClients`: count of branch customers with $\ge 2$ bookings
    - `lapsedClients`: count of branch customers with $\ge 1$ booking and last visit $\ge 30$ days ago
    - `newThisMonth`: count of branch customers whose `first_booking_date` falls in the current month
    - `totalVisits`: sum of `total_bookings` across branch customers

## Data Minimization & Privacy

- **List Rows (`data`)**: Contains only operational listing fields:
  - `id`
  - `fullName`
  - `phone`
  - `email`
  - `totalBookings`
  - `firstBookingDate`
  - `lastBookingDate`
  - `preferredStaffId`
  - `preferredStaffName`
- **List Prohibitions**: Sensitive notes (`notes`, `healthNotes`, `pressurePreference`, `birthday`) are strictly omitted from list and search payloads.
- **Detail Profile (`customer`)**: Operational profile fields required for the Customer Inspector:
  - `id`, `fullName`, `phone`, `email`, `firstBookingDate`, `lastBookingDate`, `totalBookings`, `notes`, `preferredStaffId`, `preferredStaffName`, `preferredVisitType`, `pressurePreference`, `healthNotes`, `birthday`, `loyaltyTier`.
- **Booking History (`bookingHistory`)**: Allowed operational fields only:
  - `id`, `bookingDate`, `startTime`, `status`, `type`, `serviceName`, `staffName`, `branchName`.
- **Zero Finance / Payments**: NO `pricePaid`, `amount`, `paymentMethod`, `paymentStatus`, `paymentReference`, `totalRevenue`, `averageSpend`, `revenue` exposed anywhere in any customer payload.

## Follow-up Architecture

- Read-only direct query on `waitlist_requests` where `branch_id = effectiveBranchId`.
- Completely decoupled from cookie-authenticated web Server Actions (`getWaitlistAction`).
- Zero mutations (does not alter status `waiting`, `contacted`, `converted`, `cancelled`, `expired`).
- Zero notification triggers.

## Error Contract & Headers

Standardized JSON error format:

```json
{
  "ok": false,
  "code": "...",
  "message": "..."
}
```

HTTP status mappings:

- 401 `UNAUTHORIZED`
- 403 `STAFF_NOT_FOUND`, `CRM_PERMISSION_DENIED`, `CRM_BRANCH_FORBIDDEN`
- 404 `CUSTOMER_NOT_FOUND`
- 400 `VALIDATION_ERROR`, `BRANCH_REQUIRED`, `BRANCH_NOT_FOUND`, `BRANCH_MISSING`
- 500 `SERVER_CONFIG_ERROR`, `SERVER_DATABASE_ERROR`, `UNKNOWN_ERROR`

All responses include:

- `Cache-Control: no-store`
- No raw database error leakage
- No wildcard CORS headers

## Security & Data Impact

- **Read-Only**: Zero database mutations, zero writes.
- **No Schema Changes**: No migrations, table alterations, or DDL.
- **No RLS / Auth Changes**: No policy alterations or Supabase auth config changes.
- **No Dev Bypass**: Engine strictly requires explicit verified operator context.
- **No Service Role Leak**: Service role client operates solely within server-only boundaries; no service role keys or admin tokens reach responses.

## Verification Results

1. **Focused Vitest Suite**:
   `pnpm vitest run tests/lib/customers/ tests/api/desktop-v1-customers.test.ts tests/lib/auth/desktop-bearer-auth.test.ts tests/api/desktop-v1-bookings.test.ts`
   - 4 test files, 54 tests passed (0 failures).
2. **ESLint**:
   `pnpm lint` — Passed with 0 errors.
3. **TypeScript**:
   `pnpm type-check` — Passed with 0 errors.
4. **Next.js Production Build**:
   `pnpm build` — Compiled successfully in 44s, all 116 static/dynamic pages and routes built without error.
5. **Formatting**:
   `npx prettier --write` executed cleanly across all new/modified files.
6. **Git Cleanliness**:
   `git diff --check` passed cleanly.

## Limitations

- Customer updates (`PATCH` / `POST` customers) remain out of scope for Stage 03.
- Finance and Payments metrics remain dormant and excluded from the customer boundary.

## Rollback

`git reset --hard f8455078d212b55595c277c577a80d89995c7585`
