# Hosted Stage 03 — Desktop Customer API Evidence

## Target

Hosted CradleHub (`techwithmpg/Cradlehub`)

## Stage

Stage 03 - Customers hosted read boundary (Consolidated Read-Only RLS Reconciliation)

## Branch

`stage/03-desktop-customer-api`

## Historical Commit Timeline

- **BASE_SHA**: `f8455078d212b55595c277c577a80d89995c7585`
- **Original Implementation Snapshot**: `b8c5f2e0e5eab7cc46c179ea34cba7eac1655a4e`
- **Original Evidence Snapshot**: `6074331fed4f64ef57d1fc8da1fa5b27224fac7a`
- **Security/Correctness Correction Implementation HEAD**: `176de5f8d22f6d893d4166462861d1b835886cdf`
- **Pre-RLS Authorization Snapshot**: `2e21b7ec84b08190e85608b78ab794219f903868`
- **RLS Implementation HEAD**: `88531b673fa48f10bbccf3268b6f5df855907598`

## Desktop Dependency

`stage/03-customers` @ `ec87769bba591d87f98a04640004f35c71086d80`

## Stage 03 RLS Reconciliation Summary

1. **Owner Authorization**:
   - The owner explicitly authorized the Stage 03 consolidated read-only RLS migration to reconcile database SELECT authority with application-level CRM permissions.
2. **Consolidated Policy Updates (`supabase/migrations/20260906150500_stage03_customer_read_rls_reconciliation.sql`)**:
   - **`public.bookings`**:
     - Dropped legacy over-broad global policy `bookings_crm_read_all`.
     - Created `bookings_crm_management_read_branch` granting branch-scoped `SELECT` to `crm`, `assistant_manager`, and `store_manager` where `branch_id = get_auth_branch_id()`.
     - Preserved `bookings_manager_read_branch` and `bookings_owner_all` untouched.
   - **`public.customers`**:
     - Dropped legacy over-broad global policy `customers_crm_read_all`.
     - Created `customers_crm_management_read_branch` granting booking-derived branch-scoped `SELECT` to `crm`, `assistant_manager`, and `store_manager` where customer has at least one booking at `get_auth_branch_id()`.
     - Preserved `customers_manager_read_branch` and `customers_owner_all` untouched.
   - **`public.waitlist_requests`**:
     - Created `waitlist_management_read_branch` granting branch-scoped `SELECT` to `assistant_manager` and `store_manager` where `branch_id = get_auth_branch_id()`.
     - Preserved existing branch-scoped `waitlist_desk_read` for `manager` and `crm` untouched.
3. **Strictly Read-Only**:
   - The migration contains only `FOR SELECT` policies. Zero `INSERT`, `UPDATE`, or `DELETE` permissions were added or modified.
4. **Data API Table Privileges**:
   - Explicit `GRANT SELECT ON TABLE` for `branches`, `services`, `branch_services`, `staff`, `customers`, `bookings`, and `waitlist_requests` to `authenticated` remain established in `20260521000001_data_api_explicit_grants.sql`.

## Policy Reconciliation Matrix

| Target Table            | `owner`        | `manager`               | `assistant_manager`       | `store_manager`           | `crm` (Canonical Front Desk) | Post-Migration Authority State                                                                              |
| :---------------------- | :------------- | :---------------------- | :------------------------ | :------------------------ | :--------------------------- | :---------------------------------------------------------------------------------------------------------- |
| **`branches`**          | ALLOW — GLOBAL | ALLOW — GLOBAL (active) | ALLOW — GLOBAL (active)   | ALLOW — GLOBAL (active)   | ALLOW — GLOBAL (active)      | Active branches readable by all authenticated roles.                                                        |
| **`services`**          | ALLOW — GLOBAL | ALLOW — GLOBAL (active) | ALLOW — GLOBAL (active)   | ALLOW — GLOBAL (active)   | ALLOW — GLOBAL (active)      | Active services readable by all authenticated roles.                                                        |
| **`bookings`**          | ALLOW — GLOBAL | ALLOW — BRANCH SCOPED   | **ALLOW — BRANCH SCOPED** | **ALLOW — BRANCH SCOPED** | **ALLOW — BRANCH SCOPED**    | Global CRM read removed; branch-scoped read added for `crm`, `assistant_manager`, `store_manager`.          |
| **`customers`**         | ALLOW — GLOBAL | ALLOW — BRANCH SCOPED   | **ALLOW — BRANCH SCOPED** | **ALLOW — BRANCH SCOPED** | **ALLOW — BRANCH SCOPED**    | Global CRM read removed; booking-derived branch read added for `crm`, `assistant_manager`, `store_manager`. |
| **`waitlist_requests`** | ALLOW — GLOBAL | ALLOW — BRANCH SCOPED   | **ALLOW — BRANCH SCOPED** | **ALLOW — BRANCH SCOPED** | ALLOW — BRANCH SCOPED        | Branch read added for `assistant_manager`, `store_manager`; existing `crm` policy preserved.                |
| **`staff`** (joined)    | ALLOW — GLOBAL | CONDITIONAL (Branch)    | CONDITIONAL (Branch)      | CONDITIONAL (Branch)      | CONDITIONAL (Branch)         | Branch staff resolve; cross-branch staff evaluate to `null` for branch operators.                           |

## Implementation Scope & Code Changes

Owner-authorized, read-only hosted customer API boundary and RLS reconciliation:

- `src/lib/auth/desktop-bearer-auth.ts` - Returns user-scoped authenticated `client` on success
- `src/lib/customers/desktop-customer-engine.ts` - User-scoped customer read engine, strict parameter validation, fail-closed DB error handling, 0 service-role usage
- `src/app/api/desktop/v1/customers/route.ts` - Dedicated authenticated GET endpoint passing `{ operator, supabase: authResult.client }`
- `src/app/api/desktop/v1/customers/[customerId]/route.ts` - Dedicated authenticated GET endpoint passing `{ operator, supabase: authResult.client }`
- `supabase/migrations/20260906150500_stage03_customer_read_rls_reconciliation.sql` [NEW] - Owner-authorized RLS migration reconciling database SELECT policies
- `tests/lib/customers/customer-read-rls-migration.test.ts` [NEW] - Migration contract test asserting dropped global policies, new branch policies, and read-only constraints
- `tests/lib/auth/desktop-bearer-auth.test.ts` - Unit tests asserting authenticated client return, token privacy, and error handling
- `tests/lib/customers/desktop-customer-engine.test.ts` - Unit tests for context validation, strict parameter rejection, fail-closed DB error truthfulness, segment filtering, KPIs, and branch history isolation
- `tests/api/desktop-v1-customers.test.ts` - Route-level tests for Bearer auth enforcement, parameter validation mapping to 400, and HTTP status codes
- `tests/api/desktop-v1-bookings.test.ts` - Compatibility update for mock auth results

## Security Grep Checks

- `git grep -n "createAdminClient" -- src/app/api/desktop/v1/customers src/lib/customers` -> 0 results.
- `git grep -n "SUPABASE_SERVICE_ROLE" -- src/app/api/desktop/v1/customers src/lib/customers` -> 0 results.
- `git grep -n -E "Access-Control-Allow-Origin|pricePaid|paymentMethod|paymentReference|totalRevenue|revenue" -- src/app/api/desktop/v1/customers src/lib/customers` -> 0 results.

## Data Minimization & Privacy

- **List Rows (`data`)**: Operational listing fields only (`id`, `fullName`, `phone`, `email`, `totalBookings`, `firstBookingDate`, `lastBookingDate`, `preferredStaffId`, `preferredStaffName`). Sensitive notes are omitted.
- **Detail Profile (`customer`)**: Operational profile fields required for the Customer Inspector (`id`, `fullName`, `phone`, `email`, `firstBookingDate`, `lastBookingDate`, `totalBookings`, `notes`, `preferredStaffId`, `preferredStaffName`, `preferredVisitType`, `pressurePreference`, `healthNotes`, `birthday`, `loyaltyTier`).
- **Booking History (`bookingHistory`)**: Operational booking fields only (`id`, `bookingDate`, `startTime`, `status`, `type`, `serviceName`, `staffName`, `branchName`).
- **Zero Finance / Payments**: NO `pricePaid`, `amount`, `paymentMethod`, `paymentStatus`, `paymentReference`, `totalRevenue`, `averageSpend`, or `revenue` exposed anywhere.

## Verification Results

1. **Migration Contract Suite**:
   `pnpm vitest run tests/lib/customers/customer-read-rls-migration.test.ts`
   - 1 test file, 5 tests passed (0 failures).
2. **Focused Vitest Suite**:
   `pnpm vitest run tests/lib/customers/ tests/api/desktop-v1-customers.test.ts tests/lib/auth/desktop-bearer-auth.test.ts tests/api/desktop-v1-bookings.test.ts`
   - 5 test files, 67 tests passed (0 failures).
3. **Full Repository Test Suite**:
   `pnpm test`
   - 218 test files, 1591 tests passed (0 failures).
4. **ESLint**:
   `pnpm lint` - Passed with 0 errors.
5. **TypeScript**:
   `pnpm type-check` - Passed with 0 errors.
6. **Next.js Production Build**:
   `pnpm build` - Compiled successfully with Turbopack, all 116 static/dynamic routes generated cleanly.
7. **Formatting**:
   `npx prettier --write` executed cleanly across all modified files.
8. **Git Cleanliness**:
   `git diff --check` passed cleanly.

## Database Verification Statement

- **Repository Implementation Evidence**: SQL migration and Vitest migration contract tests verified locally.
- **Live RLS Execution Environment Limitation**: No local Docker daemon / Supabase database container was active on the host machine; therefore, no live PostgreSQL RLS query execution was performed.
- **Production Runtime Statement**: Zero claims of live production execution or production migration deployment are made.

## Rollback

1. **Technical Migration Rollback**:

```sql
-- Remove branch-scoped operational read policies
DROP POLICY IF EXISTS "bookings_crm_management_read_branch" ON public.bookings;
DROP POLICY IF EXISTS "customers_crm_management_read_branch" ON public.customers;
DROP POLICY IF EXISTS "waitlist_management_read_branch" ON public.waitlist_requests;

-- Restore historical global read policies (restores legacy over-broad state)
CREATE POLICY "bookings_crm_read_all"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (public.get_auth_role() = 'crm');

CREATE POLICY "customers_crm_read_all"
  ON public.customers FOR SELECT
  TO authenticated
  USING (public.get_auth_role() = 'crm');
```

2. **Full Git Baseline Rollback**:
   `git reset --hard f8455078d212b55595c277c577a80d89995c7585`
