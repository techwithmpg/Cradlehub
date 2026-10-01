# CF0 — CRADLE CASH FLOW BUSINESS TRUTH, CURRENT-SYSTEM AUDIT & COMPLETE BUILD BLUEPRINT

**Target Repository:** `E:\cradlehub-booking-simplification`  
**Branch:** `stage/bkg-home-service-simplification`  
**Accepted Base SHA:** `f8977cce5c1286402eed2e6805ba0428c38dc660`  
**Program:** CradleHub Web — CONTROLLED STABILIZATION  
**Stage:** CF0 — FINANCIAL BUSINESS TRUTH + SYSTEM TRUTH + BUILD BLUEPRINT  
**Status:** COMPLETE AUDIT & SPECIFICATION (NO IMPLEMENTATION EXECUTED)

---

## A. EXECUTIVE SUMMARY

[REPOSITORY FACT] Cradle currently operates with a dual financial reality:
1. Operational service delivery, online booking, therapist scheduling, and attendance are handled within CradleHub Web.
2. Ground-truth financial accounting, multi-channel payment reconciliation (Cash, multiple GCash numbers, Maya, BDO bank transfers, card terminals), split payments, gift voucher redemptions, staff cash tips, travel/fuel charges, operational expenses (supplies, laundry, maintenance, petty cash), daily drawer balancing, and weekly executive summaries are tracked in **CRADLE MAINSHEETS** (Google Sheets).

[INFERENCE] The spreadsheet is used because the business has real-world operational cash flows that CradleHub simply cannot represent today:
- CradleHub has **zero** tables or models for operating expenses (the UI contains a locked placeholder: `"No expense ledger is configured for this workspace"`).
- CradleHub has **zero** support for multiple payment destinations or financial accounts (e.g. distinguishing GCash Account 1 vs GCash Account 2 vs BDO).
- CradleHub represents payments via a **mutable snapshot model** on `bookings` (`amount_paid`, `payment_method`, `payment_status`), rather than an immutable **event ledger** of money movements.
- When a customer makes a split payment or a second payment (e.g. ₱500 GCash deposit + ₱500 Cash final settlement), CradleHub overwrites `payment_method` with `"cash"` and sets `amount_paid = 1000`. The historical GCash collection is erased from daily payment queries.
- When a booking is cancelled or marked refunded, its collections disappear from active daily reporting without recording an offsetting refund outflow.
- Day Close (`daily_cash_reconciliations`) has no concept of opening drawer float, cash additions, cash pullouts, or expense deductions, and exhibits a critical zero-default save vulnerability.

[RECOMMENDATION] CF0 establishes the architectural truth and complete build blueprint to safely absorb the Master Sheet into CradleHub across phases CF1 through CF12. This migration will elevate CradleHub into the authoritative, audit-proof financial system of record for Cradle, preserving daily operational speed for front-desk CSRs while providing rigorous double-entry integrity, financial account reconciliation, and executive visibility.

---

## B. REPOSITORY / BRANCH / SHA

- **Repository:** `E:\cradlehub-booking-simplification`
- **Branch:** `stage/bkg-home-service-simplification`
- **HEAD SHA:** `f8977cce5c1286402eed2e6805ba0428c38dc660` *(with authorized uncommitted BKG3 / booking working tree changes preserved)*

---

## C. FILES CHANGED

[REPOSITORY FACT]
**NONE** (Zero application code, zero migrations, zero database changes). This stage is strictly inspection, audit, and blueprint design.

---

## D. MASTER SHEET FEATURE INVENTORY

[MASTER SHEET OBSERVED BUSINESS PRACTICE]
Direct inspection of the Cradle Master Sheet operational practices reveals the following concrete financial workflows:

1. **Service & Sales Capture:**
   - Date, appointment time, provider/attendant, client name, service duration (hours/mins), service package/type, service rate, Home Service fee, payment amount, payment channel.
   - Covers: In-spa massage/body treatments, salon/hair/nail services, retail wellness products (oils, sprays, shampoo), and miscellaneous receipts.

2. **Payment Channels & Multi-Account Destinations:**
   - Cash (physical drawer)
   - GCash (multiple distinct accounts/numbers used across branches and management)
   - Maya (QR/wallet)
   - Bank Transfers (BDO / other merchant bank accounts)
   - Card / POS Terminal
   - Gift Vouchers / Certificates (GV)
   - Customer advances / deposits

3. **Split & Multi-Party Settlements:**
   - Single guest paying via Cash + GCash.
   - Group/organizer paying for multiple attendees with combined Card + Cash.
   - Deposit paid days in advance via GCash, remainder settled in Cash on arrival.

4. **Home Service Financial Distinction:**
   - Explicit separation between **Customer Travel Charge** (Home Service fee / distance charge billed to customer) and **Business Travel Cost** (gas/fuel expense, driver allowance, Grab/tricycle fare).

5. **Staff Tips & Disbursals:**
   - Customer pays tip via Cash, GCash, or Card.
   - Tips belong to the service provider, NOT company service revenue.
   - Tips collected via digital channels (GCash/Card) create a company liability that is paid out to staff in cash.

6. **Commissions & Payroll Integration:**
   - Commission earned per service vs commission actually paid out.
   - Salary advances, staff emergency loans ("staff aid"), and payroll shortages deducted or disbursed through cash out.

7. **Operating Expenses (Outflows):**
   - Granular operational expense categories recorded daily: Fuel/gas, laundry, mineral water (H2O), salon supplies, office supplies, delivery/courier parcels, vehicle repair/maintenance, oil changes, load/telecom, transport/fare, food/staff meals ("love gifts"), SSS/statutory contributions, petty cash.

8. **Cash Drawer Corrections & Float Adjustments:**
   - Opening cash float, cash additions ("cash in"), cash removals ("cash out" / "safe drops"), change corrections, customer short payment ("kulang"), customer overpayment ("sobra"), customer refund ("balik / return").

9. **Shift & Day Balancing:**
   - Opening CSR, mid-shift CSR, closing CSR handovers.
   - Daily totals by payment channel, daily gross, daily expenses, daily net cash in drawer.

10. **Weekly/Monthly Rollups:**
    - Weekly aggregations across Cash, GCash, Maya, Bank Transfer, and Card, manually compiled from daily sheets.

---

## E. CURRENT CRADLEHUB FINANCIAL ARCHITECTURE

[REPOSITORY FACT]
The existing financial architecture in CradleHub consists of four fragmented layers:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 1. PUBLIC BOOKING & WIZARD (Unpaid Contract)                                            │
│    - Status: confirmed, Payment Status: unpaid, Amount Paid: 0, Method: pay_on_site   │
│    - BKG3 Order: booking_orders.payment_preference = 'pay_at_spa'                       │
└────────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 2. MUTABLE SNAPSHOT ON BOOKINGS TABLE                                                  │
│    - bookings.payment_status ('unpaid', 'pending', 'paid', 'refunded')                 │
│    - bookings.payment_method ('cash', 'gcash', 'maya', 'card', 'pay_on_site', 'other')  │
│    - bookings.amount_paid (NUMERIC)                                                    │
│    - bookings.payment_reference (TEXT)                                                 │
│    - metadata->>'price_paid' (Expected service price)                                  │
└────────────────────────────────────────────────────────────────────────────────────────┘
            │                                                      │
            ▼                                                      ▼
┌──────────────────────────────────────┐     ┌───────────────────────────────────────────┐
│ 3. AUDIT LOG (State Transitions)     │     │ 4. DAILY RECONCILIATION                   │
│    - booking_payment_logs            │     │    - daily_cash_reconciliations           │
│    - old_amount_paid, new_amount_paid│     │    - expected_cash/gcash/... vs actual    │
│    - old_status, new_status          │     │    - Derived from bookings WHERE date=... │
│    - reason                          │     │    - Zero-save default bug                │
└──────────────────────────────────────┘     └───────────────────────────────────────────┘
```

---

## F. SOURCE-OF-TRUTH MATRIX

| Financial Concept | Current CradleHub Representation | Source of Truth Classification | Critique & Architectural Risk |
| :--- | :--- | :--- | :--- |
| **Service Payable / Price** | `bookings.metadata->>'price_paid'` | **MUTABLE SNAPSHOT** | Stored inside JSONB. Name `price_paid` misleadingly implies it has been paid, when it actually represents the nominal price. |
| **Amount Paid** | `bookings.amount_paid` | **MUTABLE SNAPSHOT** | Single cumulative scalar. Overwritten on every payment change. Cannot show individual payment dates or amounts. |
| **Payment Status** | `bookings.payment_status` | **MUTABLE SNAPSHOT** | Enum: `unpaid`, `pending`, `paid`, `refunded`. Fails to reflect partial payment, overpayment, or split states. |
| **Payment Method** | `bookings.payment_method` | **MUTABLE SNAPSHOT** | Single string. Overwritten when a second payment method is used. |
| **Payment Destination / Account** | *None* | **MISSING** | No record of which bank account, cash drawer, or GCash number received the funds. |
| **Payment History / Ledger** | `booking_payment_logs` | **SNAPSHOT AUDIT TRAIL** | Records before/after mutations of booking fields. Not an event ledger of money received. |
| **Payment Event Timestamp** | `booking_payment_logs.created_at` | **AMBIGUOUS** | Only exists in log. Reporting queries use `bookings.booking_date`, completely ignoring payment time. |
| **Operating Expenses** | *None* | **MISSING** | No database table or model exists in the repository. |
| **Tips** | *None* | **MISSING** | No table, column, or tracking exists. |
| **Commissions** | `staff_pay_profiles.commission_percent` | **DERIVED ACCRUAL ONLY** | Calculated in Owner Payroll; no payout record or cash flow movement exists. |
| **Day Close** | `daily_cash_reconciliations` | **PARTIAL SNAPSHOT** | Compares `bookings.amount_paid` with CSR manual count. No drawer float, expenses, or voids accounted for. |
| **Home Service Fee** | `booking_orders.metadata->>'home_service_fee'` | **CANONICAL ORDER METADATA** | Captured in BKG3 order metadata; historically attached only to line 1 of bookings. |
| **Customer Credit / Advance** | *None* | **MISSING** | Pre-service payments have no balance tracking or allocation logic. |
| **Gift Vouchers** | *None* | **MISSING** | No voucher tables, balance tracking, or redemption mechanics. |

---

## G. PAYMENT WRITE PATHS

[REPOSITORY FACT]
Every code path capable of writing to payment fields was identified and audited:

### 1. `record_booking_payment_change` (PostgreSQL RPC)
- **File:** `supabase/migrations/20260702064926_transactional_booking_payment_update.sql`
- **Callers:** `src/lib/bookings/payment-transaction.ts`, CRM actions (`crm/bookings/actions.ts`), Manager actions (`manager/bookings/actions.ts`).
- **Authorization:** `SECURITY INVOKER`, granted to `authenticated` and `service_role`.
- **Database Action:** Locks `bookings` row `FOR UPDATE`, inserts into `booking_payment_logs`, updates `bookings` (`payment_method`, `payment_status`, `amount_paid`, `payment_reference`, `status`).
- **Defect:** Overwrites cumulative `amount_paid` and single `payment_method`. Does not verify whether `amount_paid` matches actual service prices.

### 2. `ownerUpdateBookingPaymentAction` (Server Action)
- **File:** `src/app/(dashboard)/owner/bookings/actions.ts`
- **Caller:** Owner workspace booking management.
- **Authorization:** Role check: `me.system_role === 'owner'`.
- **Database Action:** Executes **TWO NON-TRANSACTIONAL** statements:
  1. `ctx.supabase.from("booking_payment_logs").insert(...)`
  2. `ctx.supabase.from("bookings").update(...)`
- **Defect:** Bypasses the transactional RPC `record_booking_payment_change`. If the second query fails, an orphaned audit row is left behind.

### 3. `confirmBookingPaymentAction` (Server Action)
- **File:** `src/app/(dashboard)/crm/bookings/actions.ts`
- **Caller:** Front-desk CRM booking payment modal.
- **Authorization:** `canConfirmPayments(me.system_role)` + branch match (or owner).
- **Database Action:** Calls `recordBookingPaymentChange`.
- **Defect:** If `amountPaid` is omitted in the client payload, it defaults to `booking.amount_paid ?? 0` and sets `paymentStatus = "paid"`. A booking can be marked paid for ₱0!

### 4. `CradleFlowCheckoutDialog` (Client Component)
- **File:** `src/components/features/crm/today/cradle-flow-checkout-dialog.tsx`
- **Behavior:** Calculates `cumulativeAmount = previouslyPaid + paymentApplied`. Submits the current payment's method as the sole `paymentMethod`.
- **Defect:** Completely destroys multi-method payment history.

---

## H. PAYMENT LOG MODEL

[REPOSITORY FACT]
- **Table:** `public.booking_payment_logs`
- **Columns:** `id`, `booking_id`, `changed_by`, `old_payment_method`, `old_payment_status`, `old_amount_paid`, `old_payment_reference`, `new_payment_method`, `new_payment_status`, `new_amount_paid`, `new_payment_reference`, `reason`, `created_at`.
- **Classification:** **AUDIT LOG OF SNAPSHOT MUTATIONS** (NOT an event ledger).
- **Key Limitations:**
  - Has NO `branch_id` column (must join through `bookings`).
  - Has NO `amount` column representing the incremental cash received. It only records `old_amount_paid` and `new_amount_paid`.
  - Has NO account/destination identifier.
  - RLS policies allow any authenticated user to select and insert without branch scoping.

---

## I. CURRENT CASH FLOW WORKSPACE

[REPOSITORY FACT]
- **Route:** There is **NO** dedicated `/cash-flow` or `/crm/cash-flow` route in CradleHub!
- **Existing Financial Screens:**
  1. `/crm/reconciliation`: Daily cash reconciliation form comparing expected collections vs actual physical count.
  2. `/owner/reports`: Analytical dashboard displaying KPI cards (`Total Revenue`, `Total Bookings`), `RevenueByBranchCard`, `StaffProductivityCard`, and `DailyCashSummary`.
  3. `/crm/today` (Cradle Flow): Today's operational dashboard displaying payment status badges (`Paid`, `Pending`, `Unpaid`) and a checkout drawer.
- **Data Source for Numbers:**
  - `getDailyPaymentSummary(branchId, date)` in `src/lib/queries/bookings.ts`:
    - Queries `bookings` filtering by `booking_date = date`.
    - **CRITICAL DEFECT:** Filters out cancelled bookings (`!isBookingClosedForCrm(r.status)`). If a customer paid an advance deposit and later cancelled, their money disappears from the daily collected total!
    - Aggregates by `payment_method` on `bookings`. If a booking had split payments, only the last payment method receives the entire cumulative amount.

---

## J. DAY CLOSE

[REPOSITORY FACT]
- **Table:** `public.daily_cash_reconciliations`
- **Quality Classification:** **WEAK**
- **Specific Deficiencies:**
  1. **Zero-Save Vulnerability:** `reconciliation-form.tsx` initializes unrecorded payment methods to `"0"`. If a CSR clicks "Save Draft" or "Submit" without typing counts for all channels, it commits `0` to the database, creating false variance reports.
  2. **No Opening Float:** Does not track opening drawer cash (e.g. ₱2,000 float).
  3. **No Operating Expense Deductions:** Petty cash paid out from the drawer is not deducted from expected cash.
  4. **No Session Locks:** Submissions can be repeatedly overwritten via upsert (`onConflict: "branch_id,reconciliation_date"`).
  5. **Date Semantic Flaw:** Expects money based on `booking_date`, meaning cash collected today for a future booking is not expected in today's drawer.

---

## K. EXPENSE SYSTEM

[REPOSITORY FACT]
- **Status:** **COMPLETELY MISSING**
- **Evidence:** `src/components/features/crm/today/cradle-flow-side-rail.tsx` lines 126-137:
  ```tsx
  <div title="No expense ledger is configured for this workspace.">
    <LockKeyhole className="size-4" />
    <strong className="block text-xs">Record expense</strong>
    <span className="block text-[11px]">Not configured</span>
  </div>
  ```
- There are zero tables, zero migrations, zero types, and zero server actions for expenses in CradleHub.

---

## L. TIPS / COMMISSION / PAYROLL

[REPOSITORY FACT]
1. **Tips:**
   - Mentioned only once in a SQL comment in `20260429000001_core_tables.sql`: `Future keys: ... tip_amount`.
   - Zero database columns, zero tables, zero UI fields exist.
2. **Commissions:**
   - Stored as percentage on `staff_pay_profiles.commission_percent`.
   - Computed in Owner Payroll (`payroll_items.commission_pay`).
   - No payment movement or disbursement ledger exists.
3. **Payroll Payouts:**
   - Action `markStaffPayrollPaidAction` updates `payroll_items.status = 'paid'`.
   - **Zero Cash Flow Integration:** It does not debit any cash account, create any cash flow record, or reflect in Day Close.

---

## M. HOME SERVICE FINANCIALS

[REPOSITORY FACT]
1. **Customer Home Service Fee:**
   - Calculated during booking via `calculateHomeServiceFee(distanceKm, rules)`.
   - In BKG3, stored in `booking_orders.metadata->>'home_service_fee'`.
   - In legacy bookings, attached to `metadata.home_service_fee` of the first booking line only.
2. **Business Travel Expenses (Fuel / Driver Allowance):**
   - Completely unrepresented. No expense logging exists for drivers or vehicles.

---

## N. BUSINESS-DATE SEMANTICS

[REPOSITORY FACT]
Current queries confound three separate dates:
1. `booking_date`: Calendar date of service delivery.
2. `created_at`: Row creation timestamp in PostgreSQL.
3. Actual payment date: When money changed hands.

Because `getDailyPaymentSummary` and `getCrossbranchCashSummary` filter strictly on `booking_date`:
- Advance payments collected on Monday for a Saturday appointment are reported as Saturday revenue, and are invisible to Monday's cash reconciliation!
- Late-night walk-ins past midnight can be attributed to the wrong business shift.

---

## O. CANCELLATION / REFUND BEHAVIOR

[REPOSITORY FACT]
- When a booking is marked `status = 'cancelled'`, `getDailyPaymentSummary` filters it out (`!isBookingClosedForCrm(r.status)`).
- If money was collected (`amount_paid > 0`), that money **vanishes** from reported revenue.
- If a booking is marked `payment_status = 'refunded'`, `getCrossbranchCashSummary` excludes it from `paidRows`. No debit/refund transaction is recorded.

---

## P. PARTIAL / SPLIT PAYMENT SUPPORT

[REPOSITORY FACT]
- **Partial Payments:** `amount_paid` can be less than service price, but `bookings.payment_status` is forced to either `"pending"` or `"paid"`.
- **Split Payments:** **IMPOSSIBLE** in the current database schema without destroying historical payment methods. Only one string `payment_method` can exist on a booking row.

---

## Q. AUTHORIZATION

[REPOSITORY FACT]
- **CRM Workspace:** `canConfirmPayments` allows `owner`, `manager`, `assistant_manager`, `store_manager`, `crm`, `csr`, `csr_head`, `csr_staff` to record payments within their branch.
- **Owner Workspace:** `ownerUpdateBookingPaymentAction` allows cross-branch payment overrides without branch restrictions.
- **RLS Vulnerability:** `booking_payment_logs` RLS allows any authenticated user to insert or read logs across all branches (`with check (true)`).

---

## R. MASTER SHEET ↔ SYSTEM GAP MATRIX

| Business Capability | Master Sheet Support | Current CradleHub | Current Source of Truth | Quality | Risk | Recommended Action |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Service Sales Recording** | Full (Daily rows) | Full (Bookings) | `bookings` / `booking_orders` | STRONG | Low | **PRESERVE + EXTEND** |
| **Multi-Method Split Payment** | Full (Spread columns) | None (Overwritten) | `bookings.payment_method` | MISSING | High (Data Loss) | **NEW FOUNDATION** |
| **Financial Accounts (GCash 1, 2, BDO)** | Full (Account notes) | None | None | MISSING | High (Recon failure) | **NEW FOUNDATION** |
| **Advance / Deposit Tracking** | Full (Advance notes) | Partial (Reason tag) | None (Lost in snapshot) | WEAK | High | **NEW FOUNDATION** |
| **Gift Vouchers** | Full (GV Column) | None | None | MISSING | Medium | **NEW FOUNDATION** |
| **Home Service Customer Fee** | Full (Fee column) | Full (Order metadata)| `booking_orders.metadata` | STRONG | Low | **PRESERVE** |
| **Home Service Fuel/Driver Cost** | Full (Expense row) | None | None | MISSING | Medium | **NEW FOUNDATION** |
| **Staff Tips Tracking** | Full (Tip column) | None | None | MISSING | High (Tax/Liability) | **NEW FOUNDATION** |
| **Operational Expenses** | Full (Daily rows) | None ("Locked") | None | MISSING | High | **NEW FOUNDATION** |
| **Salon / Product Sales** | Full (Sales rows) | None | None | MISSING | Medium | **NEW FOUNDATION** |
| **Drawer Float & Adjustments** | Full (Float/Cash Out) | None | None | MISSING | High (Theft/Variance) | **NEW FOUNDATION** |
| **Day Close Reconciliation** | Full (CSR sheet) | Partial | `daily_cash_reconciliations` | WEAK | High (Zero-save bug)| **REPLACE SAFELY** |
| **Weekly Executive Summary** | Full (Weekly sheet) | Partial | Analytics query on bookings | WEAK | High (Wrong dates) | **REPLACE SAFELY** |

---

## S. FULL TARGET CAPABILITY BLUEPRINT

[RECOMMENDATION]
The complete Cradle Cash Flow system must encompass 40 capabilities across 8 functional modules:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                 CRADLE CASH FLOW MODULES                                │
├──────────────────────────┬───────────────────────────┬──────────────────────────────────┤
│ 1. CASH FLOW COMMAND     │ 2. PAYMENT MOVEMENTS      │ 3. EXPENSE REGISTER              │
│    - Today's Cash Flow   │    - Multi-method split   │    - Categorized outflows        │
│    - Drawer status       │    - Account destination  │    - Receipts / attachments      │
│    - Pending collections │    - Event-based ledger   │    - Approval workflows          │
├──────────────────────────┼───────────────────────────┼──────────────────────────────────┤
│ 4. CASH SESSIONS & CLOSE │ 5. VOUCHERS & CREDITS     │ 6. TIPS & COMPENSATION           │
│    - Opening float       │    - Voucher balances     │    - Tip collection & liability  │
│    - Mid-day cash out    │    - Customer deposits    │    - Cash tip payout             │
│    - Blind close count   │    - Advance allocations  │    - Commission disbursements    │
├──────────────────────────┴───────────────────────────┴──────────────────────────────────┤
│ 7. MULTI-ACCOUNT RECONCILIATION                                                         │
│    - Physical drawer, GCash #1, GCash #2, Maya, BDO Terminal match                       │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ 8. FINANCIAL REPORTING & AUDIT                                                          │
│    - Gross Receipts, Operating Outflows, Net Cash Flow, Shift Handover Audit            │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Domain Classification:
- **Required from Master Sheet:** Payment movements, multi-accounts, split payments, expenses, drawer float/cash-out, tips, fuel costs, product sales, day close.
- **Required from Current System:** BKG3 booking orders integration, public unpaid booking boundary, CRM check-in/check-out workflow.
- **Recommended Improvements:** Immutable double-entry event ledger, blind reconciliation count, immutable closed sessions.

---

## T. TARGET USER WORKFLOWS

[RECOMMENDATION]

### Workflow 1: Customer Pays Full Amount via Split Payment (Cash + GCash)
1. **User:** Front Desk CSR.
2. **Action:** Opens Booking Order Checkout dialog in CRM.
3. **Input:** Service total: ₱1,500. CSR enters:
   - Movement 1: ₱1,000 via `Cash` $\rightarrow$ Account: `Branch 1 Main Drawer`.
   - Movement 2: ₱500 via `GCash` $\rightarrow$ Account: `Cradle Main GCash #1` (Ref: `123456789`).
4. **Execution:** Atomic transaction:
   - Inserts 2 rows into `financial_payment_movements`.
   - Inserts allocation rows into `financial_payment_allocations` linking to `booking_orders` and `bookings`.
   - Updates `bookings.amount_paid` as a derived compatibility snapshot.
5. **Result:** Drawer cash increases by ₱1,000; GCash #1 balance increases by ₱500. Order marked fully paid.

### Workflow 2: Recording an Operational Expense (Laundry / Water / Fuel)
1. **User:** Front Desk CSR or Manager.
2. **Action:** Clicks "Record Expense" in Cash Flow workspace.
3. **Input:** Category: `Laundry`, Amount: ₱350, Account: `Branch 1 Main Drawer`, Payee: `QuickWash Laundry`, Receipt Number / Photo attached.
4. **Execution:**
   - Inserts into `financial_expenses`.
   - Inserts negative movement in `financial_cash_drawer_movements`.
5. **Result:** Expected cash in drawer decreases by ₱350 immediately.

### Workflow 3: CSR Shift Opening & Closing (Blind Day Close)
1. **Opening:** CSR enters opening float (e.g. ₱2,000). System opens a `cash_session`.
2. **Closing:** CSR performs a blind physical count (counts bills and coins without seeing system total first).
3. **Reconciliation:** System compares counted cash against `Opening Float + Cash Collections - Cash Expenses - Cash Out`. Any variance (`Over` or `Short`) is recorded with an explanation and submitted for Manager approval.

---

## U. TARGET WORKSPACE / INFORMATION ARCHITECTURE

[RECOMMENDATION]
A dedicated workspace route `/crm/cash-flow` (or integrated tab in CRM):

1. **Header & Context:** Active branch selector, current business date, active cash drawer session status.
2. **Top KPI Bar:**
   - **Cash in Drawer:** Current physical expected cash.
   - **Digital Collections Today:** Breakdown by GCash #1, GCash #2, Maya, Card.
   - **Operating Expenses Today:** Total outflows paid today.
   - **Unsettled Receivables:** Completed bookings pending payment.
3. **Main Workspace Panels:**
   - **Transactions Stream:** Live chronological stream of every payment movement, expense, and adjustment.
   - **Payment Collection Drawer:** Fast checkout interface for arriving/departing guests.
   - **Expense Register:** Quick entry form and daily expense ledger.
   - **Day Close / Session Panel:** Drawer float, mid-day drops, shift handover, and EOD reconciliation.

---

## V. TARGET DATA-DOMAIN RECOMMENDATIONS

[RECOMMENDATION]
To achieve database-level integrity, CF1-CF3 should design the following relational entities:

```sql
-- 1. Financial Accounts (Drawers, GCash numbers, Bank accounts)
public.financial_accounts (
  id UUID PRIMARY KEY,
  branch_id UUID REFERENCES branches(id),
  name TEXT NOT NULL,           -- 'Main Cash Drawer', 'GCash - 0917XXXXXXX', 'BDO Current'
  account_type TEXT NOT NULL,   -- 'cash_drawer', 'gcash', 'maya', 'bank_transfer', 'card_terminal'
  currency TEXT DEFAULT 'PHP',
  is_active BOOLEAN DEFAULT TRUE
);

-- 2. Financial Payment Movements (Immutable Event Ledger)
public.financial_payment_movements (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES booking_orders(id),
  account_id UUID REFERENCES financial_accounts(id),
  movement_type TEXT NOT NULL,  -- 'payment', 'refund', 'deposit', 'tip', 'adjustment'
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT DEFAULT 'PHP',
  payment_method TEXT NOT NULL,
  external_reference TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  recorded_by UUID REFERENCES staff(id),
  business_date DATE NOT NULL,
  notes TEXT
);

-- 3. Payment Allocations (Mapping money to specific service lines)
public.financial_payment_allocations (
  id UUID PRIMARY KEY,
  movement_id UUID REFERENCES financial_payment_movements(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id),
  allocated_amount NUMERIC(12,2) NOT NULL CHECK (allocated_amount > 0)
);

-- 4. Operational Expenses
public.financial_expenses (
  id UUID PRIMARY KEY,
  branch_id UUID NOT NULL REFERENCES branches(id),
  account_id UUID REFERENCES financial_accounts(id),
  category TEXT NOT NULL,       -- 'fuel', 'laundry', 'water', 'supplies', 'repairs', 'food', 'petty_cash'
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payee TEXT,
  receipt_reference TEXT,
  notes TEXT,
  business_date DATE NOT NULL,
  recorded_by UUID REFERENCES staff(id),
  approved_by UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Cash Sessions (Drawer float and blind close)
public.financial_cash_sessions (
  id UUID PRIMARY KEY,
  branch_id UUID NOT NULL REFERENCES branches(id),
  account_id UUID REFERENCES financial_accounts(id),
  opened_by UUID REFERENCES staff(id),
  closed_by UUID REFERENCES staff(id),
  opened_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ,
  opening_float NUMERIC(12,2) NOT NULL DEFAULT 0,
  expected_cash NUMERIC(12,2),
  counted_cash NUMERIC(12,2),
  variance NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'submitted', 'approved'))
);
```

---

## W. FINANCIAL INVARIANTS

[RECOMMENDATION]
The following hard constraints must be enforced at the application and database levels:
1. `amount > 0` for all payment movements and expenses.
2. `sum(allocations) <= movement.amount`.
3. `occurred_at` and `recorded_at` are immutable once written.
4. Historical payment movements cannot be updated or deleted; corrections must be issued as offsetting reversal movements.
5. Every movement must have a valid `recorded_by` staff ID, `business_date`, and `account_id`.
6. Closed cash sessions cannot receive new movements without reopening authorization.

---

## X. HISTORICAL DATA STRATEGY

[RECOMMENDATION]
1. **Do NOT fabricate historical event movements:** Existing `bookings.amount_paid` and `booking_payment_logs` records represent snapshot history, not granular multi-account transactions.
2. **Preserve Compatibility:** Keep `bookings.amount_paid`, `bookings.payment_status`, and `bookings.payment_method` maintained via database triggers or synchronization hooks for legacy views and PWA consumers.
3. **Cutover Boundary:** New event ledger tables take effect from CF4 onwards. Historical analytics before cutover query legacy snapshots; post-cutover analytics query the event ledger.

---

## Y. REPORTING DEFINITIONS

[RECOMMENDATION]
Replace ambiguous spreadsheet terms with standardized financial terminology:
- **Gross Receipts:** Total money collected across all payment channels during the period.
- **Refunds / Returns:** Total money returned to customers during the period.
- **Net Receipts:** `Gross Receipts - Refunds`.
- **Operating Outflows:** Total operational expenses paid during the period.
- **Net Operational Cash Flow:** `Net Receipts - Operating Outflows`.
- **Outstanding Receivables:** Value of completed services awaiting payment settlement.

---

## Z. P0/P1/P2/P3 RISKS

### P0 — Critical Financial Integrity Risks:
1. **Silent Overwrite of Payment Channels:** In the current system, split payments overwrite previous payment methods, permanently destroying GCash/Bank collection audit trails.
2. **Cancelled Bookings Erasing Real Cash:** Current daily summary queries exclude cancelled bookings, causing advance payments collected from clients who later cancelled to vanish from revenue reports.
3. **Zero-Save EOD Reconciliation:** `reconciliation-form.tsx` defaults unentered fields to 0, which commits false ₱0 actual collections upon submission.

### P1 — Operational Control Risks:
1. **No Expense Tracking:** Complete absence of operational expense tracking in CradleHub forces ongoing dependence on unverified Google Sheets for cash drawer balancing.
2. **Missing Destination Account:** Inability to specify which GCash or Bank account received funds prevents electronic statement reconciliation.
3. **No Drawer Float Concept:** Inability to record opening drawer cash makes true drawer balancing mathematically impossible in CradleHub.

### P2 — Business Workflow Gaps:
1. **Staff Tips Mixed with Revenue:** Cash and digital tips risk being counted as company service revenue rather than staff liabilities.
2. **Home Service Cost Blindness:** Customer travel fees are recorded, but fuel expenses and driver payouts are completely unmonitored.
3. **Non-Transactional Owner Payment Updates:** `ownerUpdateBookingPaymentAction` executes log insert and booking update non-transactionally.

### P3 — Minor UX Inconveniences:
1. **Misleading Field Names:** `metadata.price_paid` confuses developers and operators into thinking the service has already been paid.
2. **Static Marketing Products Page:** Products page is static text, preventing retail oil and shampoo sale tracking.

---

## AA. PRESERVE / IMPROVE / REPLACE MATRIX

| Subsystem | Strategy | Action Plan |
| :--- | :--- | :--- |
| `booking_orders` (BKG3) | **PRESERVE** | Anchor all future payment movements to aggregate orders. |
| `bookings.amount_paid` snapshot | **PRESERVE (COMPATIBILITY)** | Maintain as a derived rollup column for legacy mobile/PWA readers. |
| `booking_payment_logs` | **ISOLATE** | Retain as audit history of snapshot edits; do not rely on it as a transaction ledger. |
| `daily_cash_reconciliations` | **REPLACE SAFELY** | Replace with `financial_cash_sessions` supporting opening floats, expenses, and blind closes. |
| Cradle Flow Checkout Dialog | **IMPROVE** | Upgrade to support multi-movement split payments and destination account picker. |
| Expense System | **NEW FOUNDATION** | Build `financial_expenses` and category management. |
| Financial Accounts | **NEW FOUNDATION** | Build `financial_accounts` catalog (drawers, bank, GCash accounts). |

---

## AB. COMPLETE BUILD PROGRAM

```
CF1  ─── Financial Data Contract & Taxonomy Freeze
CF2  ─── Database Migration: Financial Accounts, Movements & Allocations
CF3  ─── Database Migration: Operational Expenses & Cash Sessions
CF4  ─── Server Action & Transactional RPC Engine for Payments
CF5  ─── Front-Desk Cash Flow & Multi-Method Checkout UI
CF6  ─── Operating Expense Register UI
CF7  ─── Drawer Float, Mid-Day Drops & Blind Day Close
CF8  ─── Customer Credit, Advances & Gift Voucher Mechanics
CF9  ─── Multi-Account Reconciliation (GCash/Bank/Terminal)
CF10 ─── Financial Reporting Engine (Receipts, Outflows, Net Cash Flow)
CF11 ─── Security, RLS Hardening & Audit Trail Certification
CF12 ─── Final Release Certification & Master Sheet Cutover
```

---

## AC. OPEN QUESTIONS FOR OWNER REVIEW

1. **GCash Destinations:** How many distinct GCash accounts are actively used across branches, and who holds ownership of each account?
2. **Gift Voucher Policy:** When a gift voucher is redeemed, should it be treated as a cash equivalent against a pre-paid liability, or as a promotional discount?
3. **Tip Disbursement Timing:** Are digital tips (GCash/Card) paid out in cash from the drawer at the end of the shift, or aggregated and distributed via payroll?
4. **Expense Approval Limits:** What is the maximum expense amount a front-desk CSR can disburse from the cash drawer without manager pre-approval?

---

## AD. CF1 CONTRACT DECISIONS REQUIRED

Before implementation begins in CF1, the project owner must freeze:
1. Canonical vocabulary for `account_type` (`cash_drawer`, `gcash`, `maya`, `bank_transfer`, `card_terminal`).
2. Standard list of operational expense categories (`fuel`, `laundry`, `water`, `supplies`, `maintenance`, `meals`, `petty_cash`).
3. Business rules for customer advance allocation and cancellation retention.
4. Shift handover and blind close protocols.

---

## AE. DATABASE CHANGES
**NONE** (Stage CF0 is strictly read-only audit and architectural blueprint).

---

## AF. PRODUCTION OPERATIONS
**NONE** (No code or migrations deployed; no production bookings or payments created).

---

## AG. FINAL VERDICT

**PASS — FINANCIAL TRUTH AND BUILD BLUEPRINT ESTABLISHED**  
The operational financial truth of Cradle has been completely audited against the Master Sheet and repository code. A safe, phased build program is defined and ready for owner review prior to CF1.
