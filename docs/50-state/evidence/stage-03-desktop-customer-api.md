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

## RLS Compatibility & Security Audit

### 1. Canonical Application CRM Roles vs Legacy Semantics

- **Current Canonical Meaning**: In current application code (`src/constants/staff-roles.ts` and `src/lib/auth/crm-permissions.ts`), `crm` is strictly the canonical Front Desk CRM workspace access role. It operates on branch-scoped front desk tasks. Legacy roles (`csr`, `csr_head`, `csr_staff`) were unified and normalized to `crm` in migration `20260701130406_normalize_front_desk_crm_roles.sql`.
- **Application Role Set**: Application authorization (`canAccessCrmWorkspace`) accepts:
  - `owner` (Cross-branch executive access)
  - `manager` (Branch-scoped management access)
  - `assistant_manager` (Branch-scoped management access)
  - `store_manager` (Branch-scoped management access)
  - `crm` (Branch-scoped Front Desk CRM access)

### 2. Database Role Resolution

In PostgreSQL, `get_auth_role()` (defined in `20260429000003_helper_functions.sql`) returns the raw `staff.system_role` column value:

```sql
SELECT system_role FROM staff WHERE auth_user_id = (SELECT auth.uid()) AND is_active = TRUE LIMIT 1;
```

It does NOT alias or canonicalize roles dynamically. `assistant_manager` evaluates as `'assistant_manager'`, `store_manager` as `'store_manager'`, and `crm` as `'crm'`.

### 3. Table SELECT Privileges (Data API)

Per migrations `20260521000001_data_api_explicit_grants.sql` and `20260521000002_data_api_explicit_grants_fix.sql`, explicit PostgreSQL table-level grants (`GRANT SELECT ON TABLE public.<table_name> TO authenticated`) exist for:

- `branches`
- `services`
- `branch_services`
- `staff`
- `customers`
- `bookings`
- `waitlist_requests`

Because table privileges are granted to all authenticated users, row visibility is governed entirely by PostgreSQL Row Level Security (RLS) policies.

### 4. Effective RLS Policy Matrix

| Target Table            | `owner`        | `manager`               | `assistant_manager`     | `store_manager`         | `crm` (Canonical Front Desk)    | Effective Migration / Policy Findings                                                                                                                                                                                         |
| :---------------------- | :------------- | :---------------------- | :---------------------- | :---------------------- | :------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`branches`**          | ALLOW — GLOBAL | ALLOW — GLOBAL (active) | ALLOW — GLOBAL (active) | ALLOW — GLOBAL (active) | ALLOW — GLOBAL (active)         | `branches_public_read` (`is_active = true`), `branches_owner_all` (`20260429000005_rls_policies.sql`)                                                                                                                         |
| **`services`**          | ALLOW — GLOBAL | ALLOW — GLOBAL (active) | ALLOW — GLOBAL (active) | ALLOW — GLOBAL (active) | ALLOW — GLOBAL (active)         | `services_public_read` (`is_active = true`), `services_owner_all` (`20260429000005_rls_policies.sql`)                                                                                                                         |
| **`bookings`**          | ALLOW — GLOBAL | ALLOW — BRANCH SCOPED   | **DENY**                | **DENY**                | **ALLOW — GLOBAL** (Over-broad) | `bookings_owner_all`, `bookings_manager_read_branch`, `bookings_crm_read_all` (`20260429000005_rls_policies.sql`). `bookings_crm_read_all` survives un-dropped.                                                               |
| **`customers`**         | ALLOW — GLOBAL | ALLOW — BRANCH SCOPED   | **DENY**                | **DENY**                | **ALLOW — GLOBAL** (Over-broad) | `customers_owner_all`, `customers_manager_read_branch`, `customers_crm_read_all` (`20260429000005_rls_policies.sql`). `customers_crm_read_all` survives un-dropped.                                                           |
| **`waitlist_requests`** | ALLOW — GLOBAL | ALLOW — BRANCH SCOPED   | **DENY**                | **DENY**                | ALLOW — BRANCH SCOPED           | `waitlist_owner_all`, `waitlist_desk_read` (`20260510000003_waitlist_rls.sql` for `manager`, `crm`, `csr_*`).                                                                                                                 |
| **`staff`** (joined)    | ALLOW — GLOBAL | CONDITIONAL (Branch)    | CONDITIONAL (Branch)    | CONDITIONAL (Branch)    | CONDITIONAL (Branch)            | `staff_owner_all`, `staff_manager_read_branch` (`20260429000005_rls_policies.sql`), `staff_operational_read_branch` (`20260529000002_crm_csr_schedule_rls.sql`). Branch staff resolve; cross-branch staff evaluate to `null`. |

### 5. Audit of Surviving Global CRM Read Policies

- `bookings_crm_read_all` and `customers_crm_read_all` were introduced in initial migration `20260429000005_rls_policies.sql` under an obsolete early assumption that CRM was a global analytics role.
- Later migrations (`20260510000004_csr_roles_rls.sql`, `20260529165843_crm_operational_rls_bookings.sql`, `20260529165855_crm_operational_rls_customers.sql`, `20260701130406_normalize_front_desk_crm_roles.sql`) added branch-scoped write policies and normalized Front Desk roles to `crm`, but **never dropped or narrowed `bookings_crm_read_all` or `customers_crm_read_all`**.
- **Security Consequence**: A user authenticated with `system_role = 'crm'` issuing a direct Supabase Data API query can SELECT all bookings and customers across all branches at the database layer. While the Stage 03 server engine explicitly enforces branch filters, the database RLS layer fails to enforce branch isolation for `crm`.
- **Authority Mismatch**:
  1. `assistant_manager` and `store_manager` lack SELECT policies on `bookings`, `customers`, and `waitlist_requests` (**Missing Read Authority**).
  2. `crm` has global SELECT policies on `bookings` and `customers` (**Over-Broad Read Authority**).

### 6. Legacy CSR Policy Status

Policies referencing legacy roles (`bookings_csr_read_branch`, `customers_csr_read_branch`, `staff_csr_read_branch`, etc.) remain harmless compatibility residue for environments where legacy role strings might linger, but are superseded for active users whose roles are normalized to `crm`.

### 7. Adjacent Pre-Existing Material (Outside Stage 03 Scope)

- `booking_events`: Read-only policy for staff own bookings and trigger-managed audit logs. Not accessed by Stage 03 customer reads.

### 8. Mocked Test Limitations

- Unit tests in `tests/lib/customers/desktop-customer-engine.test.ts` and `tests/api/desktop-v1-customers.test.ts` mock Supabase query builders.
- These tests verify application logic, query construction, and error mapping; they do **not** execute live PostgreSQL RLS policy evaluation.
- No live production RLS claims are made.

### 9. RLS Compatibility & Security Status

**STAGE 03 HOSTED CUSTOMER API NOT MERGEABLE YET — RLS COMPATIBILITY & SECURITY RECONCILIATION REQUIRES OWNER AUTHORIZATION.**

---

### 10. Consolidated Minimum RLS Proposal (Pending Owner Authorization)

A single future migration should resolve both the missing management read access and the over-broad Front Desk CRM read access:

```sql
-- =============================================================================
-- 1. BOOKINGS: Narrow CRM to branch scope; add assistant_manager & store_manager
-- =============================================================================
DROP POLICY IF EXISTS "bookings_crm_read_all" ON public.bookings;
DROP POLICY IF EXISTS "bookings_crm_management_read_branch" ON public.bookings;

CREATE POLICY "bookings_crm_management_read_branch"
  ON public.bookings
  FOR SELECT
  TO authenticated
  USING (
    public.get_auth_role() IN ('crm', 'assistant_manager', 'store_manager')
    AND branch_id = public.get_auth_branch_id()
  );

-- =============================================================================
-- 2. CUSTOMERS: Narrow CRM to booking-derived branch scope; add assistant_manager & store_manager
-- =============================================================================
DROP POLICY IF EXISTS "customers_crm_read_all" ON public.customers;
DROP POLICY IF EXISTS "customers_crm_management_read_branch" ON public.customers;

CREATE POLICY "customers_crm_management_read_branch"
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (
    public.get_auth_role() IN ('crm', 'assistant_manager', 'store_manager')
    AND id IN (
      SELECT customer_id
      FROM public.bookings
      WHERE branch_id = public.get_auth_branch_id()
        AND customer_id IS NOT NULL
    )
  );

-- =============================================================================
-- 3. WAITLIST REQUESTS: Add assistant_manager & store_manager (CRM already branch-scoped)
-- =============================================================================
DROP POLICY IF EXISTS "waitlist_management_read_branch" ON public.waitlist_requests;

CREATE POLICY "waitlist_management_read_branch"
  ON public.waitlist_requests
  FOR SELECT
  TO authenticated
  USING (
    public.get_auth_role() IN ('assistant_manager', 'store_manager')
    AND branch_id = public.get_auth_branch_id()
  );
```

**Technical Rollback Proposal**:

```sql
-- Rollback removes branch-scoped operational policies
DROP POLICY IF EXISTS "bookings_crm_management_read_branch" ON public.bookings;
DROP POLICY IF EXISTS "customers_crm_management_read_branch" ON public.customers;
DROP POLICY IF EXISTS "waitlist_management_read_branch" ON public.waitlist_requests;

-- Restores historical global read-all policies for crm (restores over-broad state for compatibility)
CREATE POLICY "bookings_crm_read_all"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (public.get_auth_role() = 'crm');

CREATE POLICY "customers_crm_read_all"
  ON public.customers FOR SELECT
  TO authenticated
  USING (public.get_auth_role() = 'crm');
```

**Security Analysis of Proposal**:

- Strictly `FOR SELECT` (read-only). Zero `INSERT`, `UPDATE`, or `DELETE` expansion.
- Strictly branch-scoped for all operational roles (`manager`, `assistant_manager`, `store_manager`, `crm`).
- Closes the cross-branch data exposure vector for `crm` on `bookings` and `customers`.
- Eliminates the RLS read block for `assistant_manager` and `store_manager`.
- Zero schema or table DDL changes.

---

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
