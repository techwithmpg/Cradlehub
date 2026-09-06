# Hosted Stage 03 — Desktop Customer API Evidence

## Target

Hosted CradleHub (`techwithmpg/Cradlehub`)

## Stage

Stage 03 - Customers hosted read boundary (Harden Security & Correctness Boundary)

## Branch

`stage/03-desktop-customer-api`

## Historical Commit Timeline

- **BASE_SHA**: `f8455078d212b55595c277c577a80d89995c7585`
- **Original Implementation Snapshot**: `b8c5f2e0e5eab7cc46c179ea34cba7eac1655a4e`
- **Original Evidence Snapshot**: `6074331fed4f64ef57d1fc8da1fa5b27224fac7a`
- **Security/Correctness Correction Implementation HEAD**: `176de5f8d22f6d893d4166462861d1b835886cdf`

## Desktop Dependency

`stage/03-customers` @ `ec87769bba591d87f98a04640004f35c71086d80`

## Security & Correctness Boundary Correction Summary

1. **User-Scoped Authenticated Supabase Client**:
   - The Stage 03 customer read engine now strictly executes queries using the authenticated user's Supabase client instantiated inside `verifyDesktopBearerAuth` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `Authorization: Bearer <token>`).
   - `createAdminClient`, `SUPABASE_SERVICE_ROLE_KEY`, and service-role / RLS-bypass access have been completely removed from the Stage 03 customer engine.
   - The user-scoped client is passed in the execution context (`{ operator, supabase }`).
   - The raw Bearer token is never returned and the client is never serialized into HTTP responses.
2. **Database Error Truthfulness & Fail-Closed Behavior**:
   - **Branch Lookup**: Database error returns `SERVER_DATABASE_ERROR` (500); missing branch returns `BRANCH_NOT_FOUND` (400).
   - **Branch Customer Membership**: Database error returns `SERVER_DATABASE_ERROR` (500); true 0 rows returns legitimate empty state (`{ data: [], total: 0 }`).
   - **KPI Queries**: Errors from `repeat`, `lapsed`, `newThisMonth`, or `totalVisits` queries fail closed with `SERVER_DATABASE_ERROR` (500). No 0s or false defaults are substituted for failed database queries.
   - **Customer Detail & History**: Membership check errors and query errors fail closed with `SERVER_DATABASE_ERROR` (500).
3. **Strict Request Parameter Validation**:
   - **`tab`**: Optional (defaults to `all`). If present, must be strictly one of: `all`, `repeat`, `lapsed`, `followup`. Any other value returns 400 `VALIDATION_ERROR`.
   - **`page`**: Optional (defaults to 1). If present, must be an integer >= 1. Rejects `0`, `-1`, `1.5`, `abc`, and empty strings with 400 `VALIDATION_ERROR`.
   - **`pageSize`**: Optional (defaults to 25). If present, must be an integer between 1 and 100 inclusive. Rejects `0`, `101`, `1.5`, `abc`, and empty strings with 400 `VALIDATION_ERROR`.
   - **`q`**: Optional trimmed search string. Maximum length 100 characters. Rejects strings longer than 100 characters with 400 `VALIDATION_ERROR`.
   - **`branchId`**: Validated as UUID string and authorized against operator role context.

## Implementation Scope

Owner-authorized, read-only hosted customer API boundary:

- `GET /api/desktop/v1/customers` (paginated customer list with segment tabs, search, KPIs)
- `GET /api/desktop/v1/customers/[customerId]` (customer profile & branch-filtered booking history)

## Changed Files vs Base

- `src/lib/auth/desktop-bearer-auth.ts` - Extended `DesktopBearerAuthResult` on success to return user-scoped `client`
- `src/lib/customers/desktop-customer-engine.ts` - User-scoped customer read engine, strict parameter validation, fail-closed DB error handling, 0 service-role usage
- `src/app/api/desktop/v1/customers/route.ts` - Dedicated authenticated GET endpoint passing `{ operator, supabase: authResult.client }`
- `src/app/api/desktop/v1/customers/[customerId]/route.ts` - Dedicated authenticated GET endpoint passing `{ operator, supabase: authResult.client }`
- `tests/lib/auth/desktop-bearer-auth.test.ts` - Unit tests asserting authenticated client return, token privacy, and error handling
- `tests/lib/customers/desktop-customer-engine.test.ts` - Unit tests for context validation, strict parameter rejection, fail-closed DB error truthfulness, segment filtering, KPIs, and branch history isolation
- `tests/api/desktop-v1-customers.test.ts` - Route-level tests for Bearer auth enforcement, parameter validation mapping to 400, and HTTP status codes
- `tests/api/desktop-v1-bookings.test.ts` - Updated mock bearer auth results to include `client` for compatibility
- `docs/50-state/evidence/stage-03-desktop-customer-api.md` - Corrected hosted evidence document

## Security Grep Checks

- `git grep -n "createAdminClient" -- src/app/api/desktop/v1/customers src/lib/customers` -> 0 results.
- `git grep -n "SUPABASE_SERVICE_ROLE" -- src/app/api/desktop/v1/customers src/lib/customers` -> 0 results.
- `git grep -n -E "Access-Control-Allow-Origin|pricePaid|paymentMethod|paymentReference|totalRevenue|revenue" -- src/app/api/desktop/v1/customers src/lib/customers` -> 0 results.

## Data Minimization & Privacy

- **List Rows (`data`)**: Operational listing fields only (`id`, `fullName`, `phone`, `email`, `totalBookings`, `firstBookingDate`, `lastBookingDate`, `preferredStaffId`, `preferredStaffName`). Sensitive notes are omitted.
- **Detail Profile (`customer`)**: Operational profile fields required for the Customer Inspector (`id`, `fullName`, `phone`, `email`, `firstBookingDate`, `lastBookingDate`, `totalBookings`, `notes`, `preferredStaffId`, `preferredStaffName`, `preferredVisitType`, `pressurePreference`, `healthNotes`, `birthday`, `loyaltyTier`).
- **Booking History (`bookingHistory`)**: Operational booking fields only (`id`, `bookingDate`, `startTime`, `status`, `type`, `serviceName`, `staffName`, `branchName`).
- **Zero Finance / Payments**: NO `pricePaid`, `amount`, `paymentMethod`, `paymentStatus`, `paymentReference`, `totalRevenue`, `averageSpend`, or `revenue` exposed anywhere.

## RLS Compatibility Audit

### 1. Canonical Application CRM Roles

From `src/constants/staff-roles.ts` and `src/lib/auth/crm-permissions.ts`, application-level authorization allows the following roles to access CRM workspace functions (`canAccessCrmWorkspace`):

- `owner`
- `manager`
- `assistant_manager`
- `store_manager`
- `crm` (including legacy aliases `csr`, `csr_head`, `csr_staff` normalized to `crm` per `20260701130406_normalize_front_desk_crm_roles.sql`)

### 2. Database Role Resolution

In PostgreSQL, `get_auth_role()` (defined in `20260429000003_helper_functions.sql`) returns the exact `system_role` text from `staff` for the authenticated user (`auth.uid()`):

```sql
SELECT system_role FROM staff WHERE auth_user_id = (SELECT auth.uid()) AND is_active = TRUE LIMIT 1;
```

`get_auth_role()` does NOT alias or canonicalize `assistant_manager` or `store_manager` to `manager`. They evaluate as `'assistant_manager'` and `'store_manager'` in RLS expressions.

### 3. Target Table RLS Policy Matrix

| Target Table            | `owner`     | `manager`            | `assistant_manager`  | `store_manager`      | `crm` (and legacy `csr_*`) | Effective Migration / Policy Proof                                                                                                                                                                                                                           |
| :---------------------- | :---------- | :------------------- | :------------------- | :------------------- | :------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`branches`**          | ALLOW       | ALLOW                | ALLOW                | ALLOW                | ALLOW                      | `branches_public_read` (`is_active = true`), `branches_owner_all` (`20260429000005_rls_policies.sql`)                                                                                                                                                        |
| **`services`**          | ALLOW       | ALLOW                | ALLOW                | ALLOW                | ALLOW                      | `services_public_read` (`is_active = true`), `services_owner_all` (`20260429000005_rls_policies.sql`)                                                                                                                                                        |
| **`bookings`**          | ALLOW       | ALLOW                | **DENY**             | **DENY**             | ALLOW                      | `bookings_owner_all`, `bookings_manager_read_branch`, `bookings_crm_read_all` (`20260429000005_rls_policies.sql`), `bookings_csr_read_branch` (`20260510000004_csr_roles_rls.sql`). No policy exists for `assistant_manager` or `store_manager`.             |
| **`customers`**         | ALLOW       | ALLOW                | **DENY**             | **DENY**             | ALLOW                      | `customers_owner_all`, `customers_manager_read_branch`, `customers_crm_read_all` (`20260429000005_rls_policies.sql`), `customers_csr_read_branch` (`20260510000004_csr_roles_rls.sql`). No policy exists for `assistant_manager` or `store_manager`.         |
| **`waitlist_requests`** | ALLOW       | ALLOW                | **DENY**             | **DENY**             | ALLOW                      | `waitlist_owner_all`, `waitlist_desk_read` (`20260510000003_waitlist_rls.sql` for `manager`, `crm`, `csr_*`). No policy exists for `assistant_manager` or `store_manager`.                                                                                   |
| **`staff`** (joined)    | ALLOW (all) | CONDITIONAL (branch) | CONDITIONAL (branch) | CONDITIONAL (branch) | CONDITIONAL (branch)       | `staff_owner_all`, `staff_manager_read_branch` (`20260429000005_rls_policies.sql`), `staff_operational_read_branch` (`20260529000002_crm_csr_schedule_rls.sql`). Branch staff resolve; cross-branch preferred staff evaluate to `null` for branch operators. |

### 4. Compatibility Findings by Operational Flow

- **Customer List / Search**:
  - `owner`: **YES**
  - `manager`: **YES**
  - `crm`: **YES**
  - `assistant_manager`: **NO** (blocked by RLS on `bookings` and `customers`)
  - `store_manager`: **NO** (blocked by RLS on `bookings` and `customers`)
- **KPI Queries**:
  - `owner`: **YES**
  - `manager`: **YES**
  - `crm`: **YES**
  - `assistant_manager`: **NO** (blocked by RLS on `bookings` and `customers`)
  - `store_manager`: **NO** (blocked by RLS on `bookings` and `customers`)
- **Follow-up Tab (`waitlist_requests`)**:
  - `owner`: **YES**
  - `manager`: **YES**
  - `crm`: **YES**
  - `assistant_manager`: **NO** (blocked by RLS on `waitlist_requests`)
  - `store_manager`: **NO** (blocked by RLS on `waitlist_requests`)
- **Customer Detail & History**:
  - `owner`: **YES**
  - `manager`: **YES**
  - `crm`: **YES**
  - `assistant_manager`: **NO** (blocked by RLS on `customers` and `bookings`)
  - `store_manager`: **NO** (blocked by RLS on `customers` and `bookings`)
- **Staff Joined Data**:
  - All roles have branch-scoped SELECT on `staff`. When a customer's `preferred_staff_id` or booking history belongs to the operator's branch, `preferredStaffName` and `staffName` resolve correctly. If a preferred staff member belongs to another branch, RLS evaluates the joined row to `null` for non-owner roles.

### 5. Mocked Test Limitations

- Existing unit tests in `tests/lib/customers/desktop-customer-engine.test.ts` and route tests in `tests/api/desktop-v1-customers.test.ts` mock the Supabase query builder responses.
- These tests verify application logic, error propagation, parameters, and query shapes.
- They do **not** execute live PostgreSQL RLS policy evaluation against a real database engine.

### 6. RLS Compatibility Status

**STAGE 03 HOSTED CUSTOMER API NOT MERGEABLE YET — RLS COMPATIBILITY CHANGE REQUIRES OWNER AUTHORIZATION.**

### 7. Minimum RLS Correction Proposal (Pending Owner Authorization)

To allow `assistant_manager` and `store_manager` to perform read-only Customer queries at their own branch matching `manager` privileges:

```sql
-- 1. Bookings branch SELECT
CREATE POLICY "bookings_management_operational_read_branch"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (
    public.get_auth_role() IN ('assistant_manager', 'store_manager')
    AND branch_id = public.get_auth_branch_id()
  );

-- 2. Customers branch SELECT (booking-derived)
CREATE POLICY "customers_management_operational_read_branch"
  ON public.customers FOR SELECT
  TO authenticated
  USING (
    public.get_auth_role() IN ('assistant_manager', 'store_manager')
    AND id IN (
      SELECT customer_id FROM public.bookings
      WHERE branch_id = public.get_auth_branch_id()
        AND customer_id IS NOT NULL
    )
  );

-- 3. Waitlist requests branch SELECT
CREATE POLICY "waitlist_management_operational_read_branch"
  ON public.waitlist_requests FOR SELECT
  TO authenticated
  USING (
    public.get_auth_role() IN ('assistant_manager', 'store_manager')
    AND branch_id = public.get_auth_branch_id()
  );
```

**Rollback SQL**:

```sql
DROP POLICY IF EXISTS "bookings_management_operational_read_branch" ON public.bookings;
DROP POLICY IF EXISTS "customers_management_operational_read_branch" ON public.customers;
DROP POLICY IF EXISTS "waitlist_management_operational_read_branch" ON public.waitlist_requests;
```

**Security Analysis**:

- Read-only (`FOR SELECT`). No `INSERT`, `UPDATE`, or `DELETE` permissions broadened.
- Branch-scoped: `assistant_manager` and `store_manager` can only read customers, bookings, and waitlist items associated with their own `branch_id`.
- Zero schema or table DDL changes.

## Verification Results

1. **Focused Vitest Suite**:
   `pnpm vitest run tests/lib/customers/ tests/api/desktop-v1-customers.test.ts tests/lib/auth/desktop-bearer-auth.test.ts tests/api/desktop-v1-bookings.test.ts`
   - 4 test files, 62 tests passed (0 failures).
2. **Full Repository Test Suite**:
   `pnpm test`
   - 217 test files, 1586 tests passed (0 failures).
3. **ESLint**:
   `pnpm lint` - Passed with 0 errors.
4. **TypeScript**:
   `pnpm type-check` - Passed with 0 errors.
5. **Next.js Production Build**:
   `pnpm build` - Compiled successfully with Turbopack, all 116 static/dynamic routes generated cleanly.
6. **Formatting**:
   `npx prettier --write` executed cleanly across all modified files.
7. **Git Cleanliness**:
   `git diff --check` passed cleanly.

## Production Runtime Statement

No claim of live production verification is made in this evidence document. All verification was executed via strict automated tests, type checks, lint checks, and Next.js production builds on the local workspace.

## Rollback

`git reset --hard f8455078d212b55595c277c577a80d89995c7585`
