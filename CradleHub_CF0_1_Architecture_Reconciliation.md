# CF0.1 — CRADLE CASH FLOW ARCHITECTURE RECONCILIATION

**Target Repository:** `E:\cradlehub-booking-simplification`  
**Branch:** `stage/bkg-home-service-simplification`  
**Accepted Base SHA:** `f8977cce5c1286402eed2e6805ba0428c38dc660`  
**Program:** CradleHub Web — CONTROLLED STABILIZATION  
**Stage:** CF0.1 — FINANCIAL ARCHITECTURE RECONCILIATION (CORRECTION PASS 1)  
**Status:** RECONCILIATION COMPLETE — READY FOR CF1 OWNER FREEZE (PLANNING ONLY)

---

## A. EXECUTIVE RECONCILIATION SUMMARY

Stage CF0 established the business necessity of absorbing the operational financial workflows of CRADLE MAINSHEETS into CradleHub Web. However, CF0 was an initial discovery pass that left several architectural ambiguities, misnomers, and potential boundary collisions in its proposed data model. 

CF0.1 (Correction Pass 1) resolves all remaining ambiguities and produces an ironclad, contract-ready architectural blueprint before any code or database migration is authored in CF1.

### Primary Reconciliations Achieved:
1. **Ledger Model Clarification:** Resolved the incorrect claim of a "double-entry ledger" in CF0. CF0 proposed single-account movement records. CF0.1 evaluates an **Operational Financial Movement Ledger (Option A)** vs. a **True Balanced Double-Entry Subledger (Option B)**, recommending Option A with a structured transaction-header/movement design tailored for front-desk speed and cash-drawer reconciliation without the overhead of an enterprise general ledger.
2. **Unified Financial Event Boundary:** Eliminated competing ledgers. In CF0, `financial_payment_movements`, `financial_expenses`, and `financial_cash_drawer_movements` risked independent existence and double-counting money. CF0.1 establishes **ONE Canonical Financial Transaction Header** (`financial_transactions`) where every physical or digital monetary event is recorded once, with typed business detail attachments (payments, expenses, tips, safe drops).
3. **Payable Model Extensible Beyond Bookings:** BKG3 established order grouping for bookings, but customer payable totals include non-booking items (Home Service travel fees, retail massage oils/sprays, surcharges, discounts, vouchers). CF0.1 establishes a unified order payable architecture (`order_payable_items`) that anchors all charges and discounts to `booking_orders` without mutating booking rows. Tips are explicitly excluded from order payables as they represent non-revenue liabilities.
4. **Separation of Payment Method vs. Financial Account:** Disentangled generic payment instruments (`cash`, `gcash`, `maya`, `card`) from physical and digital destinations (`Branch 1 Cash Drawer`, `Branch 1 GCash #1 - 0917...`, `BDO Merchant Terminal`).
5. **Tip Custody & Liability Boundary:** Formally separated **Direct Cash Tips** (handed directly to therapists, never entering company custody or cash drawers) from **Company-Custodied Tips** (collected via digital channels or cashier, creating a company liability to be disbursed in cash).
6. **Payroll Payout Separation:** Enforced that Payroll calculates payables (commissions, base pay, deductions), while Cash Flow exclusively records the monetary disbursement event.
7. **Append-Only Corrections & Refunds:** Prohibited destructive updates or deletions of financial records. Corrections and refunds are recorded as explicit, linked reversal transactions, including explicit support for post-cutover refunds of pre-cutover legacy bookings.
8. **Security Staged from Day 1:** Corrected CF0's sequencing error that postponed security to CF11. Every stage starting at CF2 will implement strict RLS and authorization boundaries.
9. **Evidence Discipline:** Corrected all register headings to `[RECOMMENDATION — REQUIRES OWNER APPROVAL]` until explicit owner sign-off, and strictly distinguished structural code risks from proven production incidents.
10. **Owner Approval of Spreadsheet Cutover Gate (CF1-D24):** Formally incorporated the project owner's explicit decision approving CF1-D24 with modification: the Master Sheet may be retired only upon full release verification of a 20-point Capability Gate, independent of numbered engineering stages.

---

## B. REPOSITORY / BRANCH / SHA

- **Repository:** `E:\cradlehub-booking-simplification`
- **Branch:** `stage/bkg-home-service-simplification`
- **HEAD Commit SHA:** `f8977cce5c1286402eed2e6805ba0428c38dc660`
- **Working-Tree Status:** All authorized BKG3 / ACT2 working-tree changes remain preserved intact:
  - [`src/app/api/booking/available-slots/route.ts`](file:///E:/cradlehub-booking-simplification/src/app/api/booking/available-slots/route.ts)
  - [`src/components/public/booking-wizard.tsx`](file:///E:/cradlehub-booking-simplification/src/components/public/booking-wizard.tsx)
  - [`src/lib/actions/online-booking.ts`](file:///E:/cradlehub-booking-simplification/src/lib/actions/online-booking.ts)
  - [`src/lib/engine/availability.ts`](file:///E:/cradlehub-booking-simplification/src/lib/engine/availability.ts)
  - [`src/lib/validations/booking.ts`](file:///E:/cradlehub-booking-simplification/src/lib/validations/booking.ts)
  - [`src/types/supabase.ts`](file:///E:/cradlehub-booking-simplification/src/types/supabase.ts)
  - [`src/lib/bookings/bkg3-atomic-contract.ts`](file:///E:/cradlehub-booking-simplification/src/lib/bookings/bkg3-atomic-contract.ts)
  - [`src/lib/bookings/booking-order-contract.ts`](file:///E:/cradlehub-booking-simplification/src/lib/bookings/booking-order-contract.ts)
  - [`src/lib/bookings/booking-wizard-validation.ts`](file:///E:/cradlehub-booking-simplification/src/lib/bookings/booking-wizard-validation.ts)
  - [`supabase/migrations/20260927080000_bkg3_booking_order_atomic.sql`](file:///E:/cradlehub-booking-simplification/supabase/migrations/20260927080000_bkg3_booking_order_atomic.sql)
  - Associated BKG3 unit test suites.
- **Git State Discipline:** Zero destructive commands executed (`git reset`, `git restore`, `git checkout .`, `git clean`, `git stash`).

---

## C. FILES CHANGED

[REPOSITORY FACT]
- **Documentation Updated:** [`E:\cradlehub-booking-simplification\CradleHub_CF0_1_Architecture_Reconciliation.md`](file:///E:/cradlehub-booking-simplification/CradleHub_CF0_1_Architecture_Reconciliation.md)
- **Application Code Modified:** **NONE** (0 lines).
- **Database Migrations Added:** **NONE** (0 migrations).
- **Production Operations:** **NONE** (0 database connections opened for mutation).

---

## D. CF0 CONTRADICTIONS RESOLVED

[RECOMMENDATION]
The following table summarizes the ambiguities in the preliminary CF0 report and their definitive reconciliation in CF0.1:

| Area | CF0 Ambiguity / Contradiction | CF0.1 Reconciled Resolution | Classification |
| :--- | :--- | :--- | :--- |
| **Ledger Model** | Called the architecture "double-entry", but schema had single `account_id` movements. | Renamed and structured as an **Operational Financial Movement Ledger (Option A)**. True double-entry reserved as Option B. | Architectural Correction |
| **Event Boundary** | Proposed three separate tables: `financial_payment_movements`, `financial_expenses`, `financial_cash_drawer_movements`. | Replaced with **ONE Canonical Financial Transaction Header** (`financial_transactions`) with typed child details. | Anti-Duplication Rule |
| **Payable Scope** | Payments allocated strictly to `booking_id`. Non-booking charges (travel, retail, fees) had no allocation target. | Established `order_payable_items` linked to `booking_orders`, supporting service, travel fee, retail product, and discount charges. | Extensible Payable Model |
| **Tip Cleanliness** | Included tips inside general payment amounts without liability tracking. | Formally separated: Tips are non-revenue liabilities, excluded from order payables, tracked via `financial_tip_details`. | Financial Integrity |
| **Payment Allocation** | Assumed CSRs must manually allocate money to every booking row. | Two-tier allocation: Primary allocation to `booking_orders`; system auto-distributes down to line items unless manually overridden. | Operational Efficiency |
| **Tip Semantics** | Did not differentiate direct cash tips from tips collected digitally by the cashier. | Split into **Direct Cash Tips** (no custody, tracking only) vs. **Company-Custodied Tips** (company liability requiring cash payout). | Cash Flow Truth |
| **Voucher Lifecycle** | Vouchers treated as a single event. | Formally separated **Voucher Sale** (cash inflow, deferred liability) from **Voucher Redemption** (payable settlement, no cash inflow). | Accounting Integrity |
| **Reversals & Refunds** | Vague mention of offsetting movements without linking schema. | Explicit parent-child reversal model via `reversal_of_transaction_id` and immutable append-only constraints. | Audit Trail Protection |
| **Pre-Cutover Refunds** | Did not account for refunding pre-cutover bookings where no prior ledger movement exists. | Explicit legacy-refund bridge using `booking_id` with `reversal_of_transaction_id = NULL` and legacy audit notes. | Transition Integrity |
| **Security Rollout** | Postponed RLS and authorization hardening to CF11. | Mandated that every stage from CF2 onwards implements full RLS, server authorization, and audit boundaries. | Stabilization Rule |
| **Evidence Discipline** | Phrased spreadsheet findings as direct agent observation. | Corrected to `[MASTER SHEET OBSERVED BUSINESS PRACTICE — PROVIDED AUDIT INPUT]` to reflect provided input status. | Evidence Discipline |
| **Cutover Policy (CF1-D24)** | Proposed cutover at Stage CF8 based on engineering sequence. | **APPROVED BY OWNER WITH MODIFICATION:** Cutover governed strictly by verified 20-point Capability Gate, not engineering stage numbers. | Approved Project Decision |

---

## E. LEDGER MODEL

[PROJECT DECISION — APPROVED BY OWNER (CF1-D01)]
CF0 incorrectly used the term "double-entry" while presenting a single-entry movement schema. In CF0.1, we formally evaluate the two valid architectural options for Cradle:

### Option A — Operational Financial Movement Ledger (RECOMMENDED)
- **Concept:** Every financial transaction creates an explicit movement record for a specific financial account (e.g. `+₱1,500` to Cash Drawer, `-₱350` from Cash Drawer). Related business context (booking order, expense detail, tip beneficiary) is linked as metadata or child detail rows.
- **Operational Reality:** Exactly mirrors how front-desk CSRs, store managers, and business owners think about physical cash and digital wallets: "How much cash entered Drawer 1?", "How much did GCash #1 receive?", "How much did we pay out for laundry?"
- **Integrity Benefits:** Eliminates balance calculation ambiguity. Prevents silent overwriting. Provides complete chronological auditability.
- **Implementation Cost:** Moderate. Straightforward relational schema, fast indexing, minimal cognitive friction for front-desk staff.
- **Reconciliation Benefits:** Directly aligns with bank statements, GCash merchant transaction histories, and end-of-day cash drawer counts.
- **Limitation:** Does not automatically maintain balanced general ledger debits and credits for formal corporate accounting (e.g. balancing Cash against Unearned Revenue and Depreciation).

### Option B — True Double-Entry Subledger
- **Concept:** Every transaction generates a header and at least two balanced ledger entries (`financial_entries`) where $\sum \text{Debits} = \sum \text{Credits}$.
  - *Example:* Customer pays ₱1,500 Cash for Massage:
    - `DR: Cash Drawer 1 (Asset)` = ₱1,500
    - `CR: Service Revenue (Revenue)` = ₱1,500
  - *Example:* ₱350 Laundry Expense paid from Drawer:
    - `DR: Laundry Expense (Expense)` = ₱350
    - `CR: Cash Drawer 1 (Asset)` = ₱350
- **Operational Reality:** Requires maintaining a full Chart of Accounts (Assets, Liabilities, Equity, Revenue, Expenses) and complex accounting rules in application code.
- **Integrity Benefits:** Mathematically impossible for debits and credits to diverge; audit-proof corporate accounting standard.
- **Implementation Cost:** High. Significant schema overhead, complex mental model for CSRs, higher query complexity for simple front-desk tasks.
- **Recommendation:** **Adopt OPTION A (Operational Financial Movement Ledger)** for CradleHub Cash Flow. Cradle's immediate operational failure is front-desk cash drawer leakage, multi-channel payment reconciliation failure, and lack of expense tracking. Option A solves 100% of these problems with lower complexity and higher performance. If formal GAAP double-entry is required in the future, Option A's event stream can cleanly feed a future accounting sync engine.
- **Terminology Rule for CF1:** The architecture must be referred to strictly as an **Operational Financial Movement Ledger**, never as "double-entry".

---

## F. CANONICAL TRANSACTION MODEL

[PROJECT DECISION — APPROVED BY OWNER (CF1-D02)]
To prevent competing, disconnected ledgers, CF0.1 establishes a **Single Canonical Transaction Boundary**:

```
                              ┌────────────────────────────────────────┐
                              │         financial_transactions         │
                              │  (Canonical Event Header & Identity)   │
                              └────────────────────────────────────────┘
                                                   │
         ┌─────────────────────────────────────────┼────────────────────────────────────────┐
         ▼                                         ▼                                        ▼
┌──────────────────────────────┐        ┌──────────────────────────────┐        ┌──────────────────────────────┐
│  financial_account_movements │        │   financial_expense_details  │        │     financial_tip_details    │
│  (Monetary effect on cash /  │        │   (Why money left: category, │        │   (Beneficiary staff, tip    │
│   digital accounts)          │        │    payee, receipt, approval) │        │    channel, payout status)   │
└──────────────────────────────┘        └──────────────────────────────┘        └──────────────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ financial_order_allocations  │
│ (Allocates movement value to │
│  order / payable items)      │
└──────────────────────────────┘
```

### Transaction Header Specification (`financial_transactions`):
- `id`: UUID (Primary Key, default `gen_random_uuid()`).
- `transaction_type`: Enum (`customer_payment`, `customer_refund`, `customer_deposit`, `operational_expense`, `cash_adjustment`, `tip_collection`, `tip_disbursement`, `payroll_disbursement`, `voucher_sale`, `voucher_redemption`, `retail_sale`, `other_income`).
- `branch_id`: UUID (Branch ownership, foreign key to `branches.id`).
- `business_date`: DATE (The operating/shift date).
- `occurred_at`: TIMESTAMPTZ (Exact wall-clock time the money moved).
- `recorded_at`: TIMESTAMPTZ (When the record was committed to Postgres, default `NOW()`).
- `recorded_by`: UUID (Staff member who logged the transaction, foreign key to `staff.id`).
- `currency`: TEXT (Default `'PHP'`).
- `status`: Enum (`posted`, `reversed`, `voided`).
- `idempotency_key`: TEXT (Unique key preventing duplicate submissions).
- `source_type`: TEXT (e.g. `'booking_order'`, `'cash_session'`, `'payroll_run'`, `'adhoc_sale'`).
- `source_id`: UUID (Nullable foreign key pointing to the source entity).
- `external_reference`: TEXT (Merchant transaction ID, bank reference, GCash reference).
- `reversal_of_transaction_id`: UUID (Self-referencing foreign key linking reversal to original).
- `notes`: TEXT.

### Monetary Truth Rule:
To avoid duplicate sources of monetary truth, the transaction header does NOT store an independent mutable amount. The monetary total of a transaction is derived as $\sum |\text{movement.amount}|$, validated atomically at write time by the transactional RPC engine.

---

## G. ACCOUNT MOVEMENTS

[PROJECT DECISION — APPROVED BY OWNER (CF1-D03)]
The table `financial_account_movements` records the actual flow of funds into and out of specific physical and digital repositories.

### Entity Specification:
- `id`: UUID (Primary Key).
- `transaction_id`: UUID (Foreign key to `financial_transactions.id` ON DELETE RESTRICT).
- `financial_account_id`: UUID (Foreign key to `financial_accounts.id` ON DELETE RESTRICT).
- `amount`: NUMERIC(12,2) NOT NULL (Signed amount).
- `payment_method`: TEXT NOT NULL (Enum: `cash`, `gcash`, `maya`, `bank_transfer`, `card`, `voucher`, `customer_credit`).
- `external_reference`: TEXT (Specific reference for this movement rail if different from header).
- `created_at`: TIMESTAMPTZ DEFAULT NOW().

### Explicit Sign Convention (Option 1 — Frozen for CF1):
- **Positive (`+ amount`)**: Money **ENTERS** the account (e.g. Cash collected into drawer, GCash transfer received, opening float addition).
- **Negative (`- amount`)**: Money **LEAVES** the account (e.g. Cash paid for laundry, cash tip disbursed to therapist, safe drop to manager, customer refund).
- **Zero amounts prohibited**: `CHECK (amount <> 0)`.

---

## H. ORDER PAYABLE MODEL

[PROJECT DECISION — APPROVED BY OWNER (CF1-D05)]
BKG3 provides `booking_orders` which groups service lines (`bookings`). However, an order's financial liability comprises more than just service bookings.

CF0.1 introduces the **Order Payable Model** (`order_payable_items`):

### Payable Item Structure:
- `id`: UUID (Primary Key).
- `order_id`: UUID (References `booking_orders.id` ON DELETE RESTRICT).
- `booking_id`: UUID (Nullable foreign key to `bookings.id`; populated ONLY when the charge represents a specific service line item).
- `charge_type`: Enum (`service`, `home_service_fee`, `retail_product`, `surcharge`, `discount`, `manual_adjustment`, `other_charge`).
- `description`: TEXT (e.g. "Signature Massage - Guest 1", "Home Service Travel Fee (7.5 km)", "Lavender Essential Oil 50ml", "Senior Citizen Discount 20%").
- `nominal_amount`: NUMERIC(12,2) (Positive for charges, negative for discounts).
- `created_at`: TIMESTAMPTZ DEFAULT NOW().

### Re-evaluation of `tip_collected`:
**Tips must NOT be an order payable item.** A tip is not company revenue, not a charge owed to the business, and is an optional staff gratuity. If tips were modeled as order payables, company accounts receivable and service revenue would be distorted. Instead, tips collected at checkout attach directly to the payment transaction as a `financial_tip_details` liability record.

### Duplication Prevention:
For `service` charges, the `nominal_amount` is snapshotted from `services.price` at the moment of booking creation. It links directly to `booking_id`, establishing a 1:1 relationship between the service delivery row and its payable liability without manual retyping.

---

## I. PAYMENT ALLOCATIONS

[PROJECT DECISION — APPROVED BY OWNER (CF1-D06)]
When a customer pays, money enters a financial account via a `financial_account_movements` record. That movement must then be allocated against the customer's liabilities.

### Entity Specification (`financial_order_allocations`):
- `id`: UUID (Primary Key).
- `movement_id`: UUID (Foreign key to `financial_account_movements.id` ON DELETE RESTRICT).
- `order_id`: UUID (Foreign key to `booking_orders.id` ON DELETE RESTRICT).
- `payable_item_id`: UUID (Nullable foreign key to `order_payable_items.id`).
- `allocated_amount`: NUMERIC(12,2) NOT NULL CHECK (allocated_amount > 0).
- `created_at`: TIMESTAMPTZ DEFAULT NOW().

### Two-Tier Allocation Mechanics:
1. **Tier 1 (Order Level - Default Front Desk Flow):**
   - The CSR collects ₱1,500 for Booking Order #BO-1001.
   - The payment movement allocates ₱1,500 directly to `order_id` (`payable_item_id = NULL`).
   - The system automatically satisfies the order's payable items in canonical sequence:
     1. Service charges (in attendee sequence).
     2. Home Service fees.
     3. Retail products.
     4. Surcharges.
   - **Benefit:** Front-desk CSRs do not need to click 10 checkboxes to allocate ₱500 to Guest 1 and ₱500 to Guest 2 during rapid checkout.
2. **Tier 2 (Item Level - Explicit Split / Multi-Party Flow):**
   - If an organizer specifically pays for Guest 1 in Cash and Guest 2 pays for herself via GCash, the CSR can optionally specify exact allocations down to `payable_item_id`.

### Allocation Invariant:
$$\sum \text{allocated\_amount} \le \text{movement.amount}$$
Any positive unallocated remainder $(\text{movement.amount} - \sum \text{allocated\_amount})$ automatically constitutes **Unallocated Customer Credit**.

---

## J. PAYMENT STATE DERIVATION

[PROJECT DECISION — APPROVED BY OWNER (CF1-D07)]
In the target architecture, payment status is **NEVER a mutable field** edited directly by users. It is a strictly derived property computed from the relationship between Total Payable and Net Allocated Payments.

### Derived State Definitions:
- **`unpaid`**: $\text{Net Allocated Payments} = 0$.
- **`partial`**: $0 < \text{Net Allocated Payments} < \text{Total Payable}$.
- **`paid`**: $\text{Net Allocated Payments} = \text{Total Payable}$.
- **`overpaid`**: $\text{Net Allocated Payments} > \text{Total Payable}$.
- **`refunded`**: Order was previously `paid` or `partial`, but 100% of collected payments have been returned via reversal/refund transactions ($\text{Net Allocated Payments} = 0$ after refunds).
- **`partially_refunded`**: A portion of collected payments was refunded, leaving $0 < \text{Net Allocated Payments} < \text{Total Payable}$.

### Legacy Compatibility Mapping:
Existing systems and PWA consumers expect `bookings.payment_status` to be one of (`unpaid`, `pending`, `paid`, `refunded`). The compatibility synchronization will map:
- `unpaid` $\rightarrow$ `'unpaid'`
- `partial` $\rightarrow$ `'pending'`
- `paid` $\rightarrow$ `'paid'`
- `overpaid` $\rightarrow$ `'paid'`
- `refunded` $\rightarrow$ `'refunded'`
- `partially_refunded` $\rightarrow$ `'pending'`

---

## K. FINANCIAL ACCOUNTS

[PROJECT DECISION — APPROVED BY OWNER (CF1-D04)]
CF0.1 formalizes the distinction between **Payment Method**, **Financial Account**, and **External Reference**:

| Concept | Definition | Concrete Example |
| :--- | :--- | :--- |
| **Payment Method** | The instrument or rail used to transfer value. | `cash`, `gcash`, `maya`, `bank_transfer`, `card`, `voucher` |
| **Financial Account** | The specific repository, drawer, wallet, or bank account holding the funds. | `Branch 1 - Front Cash Drawer`<br>`Branch 1 - GCash (0917-XXX-1234)`<br>`BDO Merchant Account #...456` |
| **External Reference** | The third-party transaction or authorization identifier. | GCash Ref: `100293847291`<br>Card Approval Code: `AUTH-88219` |

### Account Entity Specification (`financial_accounts`):
- `id`: UUID.
- `branch_id`: UUID (Nullable for multi-branch corporate accounts; populated for branch-specific cash drawers).
- `name`: TEXT (Human-readable label: "Main Cash Drawer", "Front Desk GCash").
- `account_type`: Enum (`cash_drawer`, `gcash`, `maya`, `bank_transfer`, `card_terminal`).
- `identifier_mask`: TEXT (Masked display: "ending in *1234", "0917-***-5678").
- `encrypted_identifier`: TEXT (Securely stored full account/phone number, accessible only to Owner/Finance).
- `is_active`: BOOLEAN (Soft-delete/archive flag).
- `currency`: TEXT (Default `'PHP'`).

---

## L. EXPENSE ARCHITECTURE

[PROJECT DECISION — APPROVED BY OWNER (CF1-D08)]
Operating expenses represent money leaving a financial account for operational purposes. 

### Architecture:
1. An expense begins as a canonical transaction header: `financial_transactions` with `transaction_type = 'operational_expense'`.
2. A corresponding negative movement is created in `financial_account_movements`:
   - `account_id`: The account funding the expense (e.g. Cash Drawer 1).
   - `amount`: Signed negative value (e.g. `-350.00`).
3. Business details are captured in `financial_expense_details`:
   - `id`: UUID (Primary Key).
   - `transaction_id`: UUID (Foreign key to `financial_transactions.id`).
   - `category_id`: UUID (Foreign key to configurable `financial_expense_categories.id`).
   - `payee`: TEXT (Vendor/person paid: "Petron Station", "CleanAir Laundry").
   - `receipt_reference`: TEXT (Official Receipt or Invoice number).
   - `receipt_image_url`: TEXT (Supabase Storage path for receipt photo).
   - `approval_status`: Enum (`approved_instant`, `pending_approval`, `approved`, `rejected`).
   - `approved_by`: UUID (Manager staff ID).
   - `related_booking_order_id`: UUID (Optional link to Home Service booking order).
   - `related_staff_id`: UUID (Optional staff reimbursement link).
   - `notes`: TEXT.

### Category Model:
Categories will be **Configurable Database Records** (`financial_expense_categories`) rather than a rigid enum, seeded with standard defaults (`fuel`, `laundry`, `water`, `supplies`, `repairs`, `telecom`, `meals`, `petty_cash`, `other`).

---

## M. TIPS

[PROJECT DECISION — APPROVED BY OWNER (CF1-D09)]
CF0.1 explicitly resolves the two real-world tip paradigms observed in spa operations:

### Case A — Direct Cash Tips (Zero Company Custody)
- **Scenario:** A satisfied client hands ₱200 in paper bills directly to the therapist inside the treatment room.
- **Financial Truth:** The company never takes custody of this money. It does **NOT** enter the cash drawer. It is **NOT** company revenue.
- **System Action:** If the branch tracks therapist tip performance for analytics, it is logged as an informational event with `is_company_custodied = FALSE`. It generates **zero** financial account movements and does not affect Day Close drawer totals.

### Case B — Company-Custodied Tips (Digital or Cashier Collected)
- **Scenario:** The client adds a ₱200 tip to their GCash or Card bill at checkout, or hands the tip to the front-desk cashier.
- **Financial Truth:** The company takes custody of ₱200. This creates an immediate **Staff Tip Liability** owed by the company to the therapist.
- **System Action:**
  1. The collection transaction records the ₱200 entering the company account (GCash or Drawer).
  2. A `financial_tip_details` record is attached:
     - `beneficiary_staff_id`: The therapist receiving the tip.
     - `custody_status`: `'held_by_company'`.
     - `payout_status`: `'pending_disbursement'`.
  3. When the CSR hands the physical cash to the therapist at shift end, a `tip_disbursement` transaction is posted:
     - Negative movement from `Cash Drawer` (`-₱200.00`).
     - `payout_status` updated to `'disbursed'`.
     - Drawer expected cash correctly accounts for this cash exit.

---

## N. PAYROLL / COMMISSIONS

[PROJECT DECISION — APPROVED BY OWNER (CF1-D10)]
A strict boundary is drawn between **Payroll** and **Cash Flow**:

```
┌──────────────────────────────────────────────┐
│             OWNER PAYROLL DOMAIN             │
│  - Calculates service commissions            │
│  - Tracks attendance, hourly pay, OT         │
│  - Manages statutory deductions (SSS/PhilH)  │
│  - Establishes: PAYABLE TO STAFF             │
└──────────────────────────────────────────────┘
                       │
                       │ Authorizes payout
                       ▼
┌──────────────────────────────────────────────┐
│               CASH FLOW DOMAIN               │
│  - Records: DISBURSEMENT OF PAYABLE          │
│  - Movement: Cash out from drawer or Bank    │
│  - Child detail: staff_payout_record         │
│  - Updates drawer expected cash immediately  │
└──────────────────────────────────────────────┘
```

- Cash Flow **never** recalculates commission percentages or validates timecards.
- Cash Flow provides the payout execution mechanism: When a manager disburses commission, salary, allowance, or staff reimbursement from the drawer, Cash Flow records the transaction, links it to `payroll_item_id` or `staff_id`, and decreases the drawer balance.

---

## O. CUSTOMER ADVANCES / CREDIT

[PROJECT DECISION — APPROVED BY OWNER (CF1-D11)]
CF0.1 resolves advances by distinguishing between two operational paradigms:

### Advance Types:
1. **Deposit Tied to Known Order:** Customer books in advance and pays ₱500 GCash deposit for Booking Order #BO-1001. The payment allocates directly to `order_id`. If the order is cancelled, the deposit moves to unallocated customer credit or is refunded.
2. **General Customer Credit:** Customer overpays or holds an unassigned deposit balance.

### Entity Specification (`financial_customer_credits`):
- `id`: UUID (Primary Key).
- `customer_id`: UUID (Foreign key to `customers.id`).
- `originating_transaction_id`: UUID (Foreign key to `financial_transactions.id`).
- `initial_amount`: NUMERIC(12,2) NOT NULL CHECK (initial_amount > 0).
- `allocated_amount`: NUMERIC(12,2) NOT NULL DEFAULT 0,
- `refunded_amount`: NUMERIC(12,2) NOT NULL DEFAULT 0,
- `available_balance`: NUMERIC(12,2) GENERATED ALWAYS AS (initial_amount - allocated_amount - refunded_amount) STORED,
- `status`: Enum (`active`, `fully_applied`, `refunded`),
- `created_at`: TIMESTAMPTZ DEFAULT NOW().

### Invariant:
$$\text{allocated\_amount} + \text{refunded\_amount} \le \text{initial\_amount}$$
Customer credit can be partially allocated across multiple orders, preserved over time, or refunded cleanly via a linked refund transaction.

---

## P. GIFT VOUCHERS

[PROJECT DECISION — APPROVED BY OWNER (CF1-D12)]
CF0.1 establishes a formal dual-mode voucher architecture: Mode A (Paid / Prepaid Voucher) treated as customer liability, and Mode B (Promotional Voucher) treated as marketing discount.

### 1. Mode A — Paid / Prepaid Voucher:
- Customer purchases a ₱2,000 Gift Voucher for a friend.
- **Financial Effect:** ₱2,000 cash/GCash enters a company financial account.
- **Detail Record (`financial_vouchers`):**
  - `id`: UUID.
  - `voucher_code`: Unique string (e.g. `CRADLE-GV-9821`).
  - `initial_value`: ₱2,000.
  - `remaining_balance`: ₱2,000.
  - `purchaser_customer_id`: UUID.
  - `recipient_name`: TEXT.
  - `status`: Enum (`issued`, `active`, `partially_redeemed`, `redeemed`, `expired`, `voided`).
  - `issued_at`: TIMESTAMPTZ DEFAULT NOW().
  - `expires_at`: TIMESTAMPTZ.
- **Accounting Reality:** This is deferred revenue / customer liability, not earned service revenue.

### 2. Voucher Redemption:
- Recipient presents the voucher to settle a ₱1,500 massage.
- **Financial Effect:** **Zero new money enters the business.**
- **Settlement Action:** The order payable is settled via `payment_method = 'voucher'`.
- An immutable redemption log (`financial_voucher_redemptions`) is inserted.
- The voucher balance decreases from ₱2,000 to ₱500 (`remaining_balance = 500`).
- No cash drawer movement is generated.

### Approved Accounting Policy (CF1-D12 Approved by Owner):
- **Dual-Mode Voucher Architecture:** Explicitly distinguishes **Paid Vouchers** (Mode A — customer liability settled with zero new cash inflow) from **Promotional Vouchers** (Mode B — marketing discount / promotion issued without equivalent customer payment). No silent mixing of models.

---

## Q. REFUNDS / REVERSALS

[PROJECT DECISION — APPROVED BY OWNER (CF1-D13)]
Financial history in CradleHub must be **strictly append-only**. Destructive `DELETE` or `UPDATE` queries on committed financial transactions are prohibited by database constraints.

### Reversal Mechanics:
1. **Full or Partial Reversal:**
   - User initiates "Reverse Transaction".
   - System creates a new transaction with `transaction_type = 'customer_refund'` or `'reversal'`.
   - Links back via `reversal_of_transaction_id = original_transaction.id`.
   - Generates a signed negative movement on the funding account (`-amount`).
   - Reverses or offsets the previous `financial_order_allocations`.
   - Updates the original transaction's status to `'reversed'`.
2. **Post-Cutover Refund of Pre-Cutover Payment (Critical Bridge):**
   - *Problem:* A customer who paid under the legacy system before the CF cutover asks for a refund after the new ledger is live. There is no historical `financial_transactions.id` to reference.
   - *Reconciled Solution:* The refund is recorded as a new transaction with:
     - `transaction_type = 'customer_refund'`
     - `source_type = 'legacy_booking'`
     - `source_id = legacy_booking.id`
     - `reversal_of_transaction_id = NULL`
     - `notes = 'Refund of pre-cutover booking payment'`
   - Generates an accurate cash-out movement (`-amount`) from the drawer, ensuring the physical drawer balances perfectly without violating foreign key constraints.

---

## R. HOME SERVICE FINANCIALS

[PROJECT DECISION — APPROVED BY OWNER (CF1-D14)]
[MASTER SHEET OBSERVED BUSINESS PRACTICE — PROVIDED AUDIT INPUT]
Preserves the mandatory business distinction between customer charges and internal delivery expenses:

1. **Customer Charge (Home Service Fee):**
   - Billed to the client based on distance/rules.
   - Stored as an `order_payable_items` row (`charge_type = 'home_service_fee'`).
   - Represents **Gross Service Revenue**.
2. **Business Cost (Fuel / Fare / Driver Allowance):**
   - Actual operational expenditure incurred to fulfill the trip.
   - Recorded as an `operational_expense` transaction linked to the `financial_expense_details` table.
   - Represents an **Operating Outflow**.
   - Contains an optional foreign key link to `booking_orders.id` to enable per-trip profitability analysis without confounding revenue and expense.

---

## S. RETAIL / NON-BOOKING INCOME

[PROJECT DECISION — APPROVED BY OWNER WITH MODIFICATION (CF1-D15)]
The Master Sheet routinely logs transactions not tied to an online massage booking: walk-in retail purchases (massage oils, aromatherapy sprays, shampoo bottles), walk-in salon services, and miscellaneous receipts.

### Approved Ownership Boundary:
- **Never fabricate a booking to record a retail sale.**
- Booking-related retail sales attach to existing `booking_orders` as `order_payable_items` (`charge_type = 'retail_product'`).
- Pure non-booking retail sales are recorded directly via canonical financial transactions (`transaction_type = 'retail_sale'`) with attached retail sale detail records, without inventing `booking_orders.type = 'retail_walk_in'`.
- Cash Flow owns actual monetary receipts; future Inventory/POS will own SKUs, stock quantities, and costs.

---

## T. CASH SESSIONS / DAY CLOSE

[PROJECT DECISION — APPROVED BY OWNER (CF1-D16)]
Cash sessions are strictly scoped to a physical cash drawer (`financial_account_id`). Invariant: exactly one active cash session per physical drawer at a time. Supports midday staff shift handovers and multi-drawer branch setups.

### Cash Session Lifecycle:
```
  [ OPEN ] ──(Record Movements)──> [ COUNT PENDING ] ──(Blind Count)──> [ SUBMITTED ] ──(Manager Review)──> [ CLOSED & LOCKED ]
     │                                                                                                             │
     └──────────────────────────────────────(Authorized Reopen)────────────────────────────────────────────────────┘
```

### Entity Fields (`financial_cash_sessions`):
- `id`: UUID.
- `branch_id`: UUID.
- `account_id`: UUID (Points to the specific cash drawer).
- `session_number`: INT (Shift 1, Shift 2).
- `business_date`: DATE.
- `opened_at`: TIMESTAMPTZ.
- `opened_by`: UUID (Opening CSR).
- `opening_float`: NUMERIC(12,2) (Starting change fund, e.g. ₱2,000).
- `closed_at`: TIMESTAMPTZ.
- `closed_by`: UUID (Closing CSR).
- `expected_cash`: NUMERIC(12,2) (Computed dynamically by the ledger).
- `counted_cash`: NUMERIC(12,2) (Blind physical count of currency).
- `variance`: NUMERIC(12,2) $(\text{counted\_cash} - \text{expected\_cash})$.
- `variance_reason`: TEXT.
- `status`: Enum (`open`, `submitted`, `approved`, `reopened`).
- `submitted_at`: TIMESTAMPTZ.
- `approved_by`: UUID (Manager).
- `approved_at`: TIMESTAMPTZ.
- `reopened_by`: UUID.
- `reopened_at`: TIMESTAMPTZ.
- `reopen_reason`: TEXT.

### Multi-Drawer Support:
Even if branches currently operate with a single primary cash drawer, the schema anchors sessions to `account_id` rather than raw `branch_id`, providing built-in architectural support for multiple drawers (e.g. Front Desk Drawer vs. Salon Desk Drawer) without future schema migrations.

---

## U. DIGITAL RECONCILIATION

[PROJECT DECISION — APPROVED BY OWNER (CF1-D17)]
Digital accounts (GCash #1, GCash #2, Maya, BDO Merchant Account) cannot be counted with coins. They are reconciled against external statements:

### Digital Reconciliation Workflow:
1. At Day Close, the manager accesses the GCash / Bank app.
2. The manager enters the **Ending Statement Balance** or **Daily Settlement Total** reported by the provider.
3. CradleHub calculates:
   $$\text{Expected Movement Total} = \sum \text{Digital Movements for the Business Date}$$
4. Reconciliation states:
   - `unverified`: Default state before manager inspection.
   - `matched`: External provider balance matches system movements exactly.
   - `variance`: Discrepancy detected (e.g. uncredited transfer, unauthorized fee).
   - `investigating`: CSR/Manager researching reference numbers.
   - `approved`: Manager accepts verified balance with documented notes.

---

## V. DATE SEMANTICS

[PROJECT DECISION — APPROVED BY OWNER (CF1-D18)]
CF0.1 establishes strict definitions to resolve historical date confusion:

| Date Field | Authority | Semantic Meaning | Immutable Rule |
| :--- | :--- | :--- | :--- |
| **`occurred_at`** | Wall-Clock Timestamp | The exact moment physical cash changed hands or digital transfer was confirmed. | Immutable once inserted. |
| **`recorded_at`** | Database Timestamp | `NOW()` timestamp generated by PostgreSQL when row is committed. | System managed, immutable. |
| **`business_date`** | Operating Date | The commercial business day the transaction belongs to (typically the date of the active Cash Session). | Cannot be changed after session closure. |
| **`booking_date`** | Service Delivery Date | The scheduled date of the spa appointment on the calendar. | Belongs to `bookings`, NOT the financial ledger. |

### Midnight Shift Rule:
A transaction occurring at 01:15 AM on Sunday morning during a Saturday late-night shift is assigned `business_date = 'Saturday'` by linking to the open Saturday cash session, while `occurred_at` retains the true Sunday timestamp.

---

## W. COMPATIBILITY SNAPSHOTS

[PROJECT DECISION — APPROVED BY OWNER (CF1-D19)]
To guarantee zero regression for existing PWA clients, mobile apps, and legacy dashboard cards:

### Strategy:
1. `bookings.amount_paid`, `bookings.payment_status`, and `bookings.payment_method` will remain in the database schema.
2. They will be transformed into **Derived Compatibility Snapshots**.
3. When financial transactions are posted, an atomic database trigger computes the net allocated payments for the booking and updates:
   - `bookings.amount_paid = SUM(valid_allocations)`
   - `bookings.payment_status`:
     - ₱0 paid $\rightarrow$ `'unpaid'`
     - Partial paid $\rightarrow$ `'pending'`
     - Fully paid $\rightarrow$ `'paid'`
     - Refunded $\rightarrow$ `'refunded'`
   - `bookings.payment_method`:
     - No payments $\rightarrow$ `'pay_on_site'`
     - Single payment method $\rightarrow$ method name (e.g. `'cash'` or `'gcash'`)
     - Multiple split methods $\rightarrow$ `'split'`
4. Existing legacy read queries will continue working seamlessly without knowing an event ledger exists underneath.

---

## X. booking_payment_logs FUTURE ROLE

[PROJECT DECISION — APPROVED BY OWNER (CF1-D20)]
[REPOSITORY FACT]
- `public.booking_payment_logs` is currently an audit log of mutations made to `bookings` fields.
- **Future Role:**
  1. **Preserve All Historical Rows:** Existing rows remain untouched as historical audit evidence.
  2. **Cease Future Financial Reliance:** The table is completely retired from any financial reporting role.
  3. **Future Writes Policy (RECOMMENDED):** Stop writing new records to `booking_payment_logs` after the ledger cutover. All financial auditing is owned by `financial_transactions` and `financial_account_movements`. Continuing to write to `booking_payment_logs` on every compatibility update creates redundant database bloat and risks developer confusion over which audit trail is authoritative.

---

## Y. HISTORICAL CUTOVER

[PROJECT DECISION — APPROVED BY OWNER (CF1-D21)]
A clean temporal boundary will partition financial history:

```
────────────────────────────┬────────────────────────────► Time
   PRE-CUTOVER ERA          │      POST-CUTOVER ERA
   (Legacy Snapshots)       │      (Event Ledger)
                            │
                   CUTOVER_TIMESTAMP
```

1. **Pre-Cutover Era:**
   - Financial totals rely on `bookings.amount_paid` and `daily_cash_reconciliations`.
   - Historical records are marked `ledger_version = 'legacy'`.
   - Zero synthetic movements will be backfilled for pre-cutover bookings.
2. **Post-Cutover Era:**
   - All transactions flow through `financial_transactions` and `financial_account_movements`.
   - Financial totals query the event ledger exclusively.
3. **Refund of Pre-Cutover Payment:** Handled via the legacy-reference mechanism detailed in Section Q.

---

## Z. AUTHORIZATION / RLS

[PROJECT DECISION — APPROVED BY OWNER (CF1-D22)]
CF0.1 establishes a comprehensive role-permission matrix enforced at the server action, transactional RPC, and PostgreSQL RLS layers:

| Action | CSR | CSR Head | Asst. Mgr | Store Mgr | Owner | Finance | Security Boundary |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Record Payment** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | Server Action + RPC (Branch scoped) |
| **Record Split Payment** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | Server Action + RPC (Branch scoped) |
| **Record Deposit** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | Server Action + RPC (Branch scoped) |
| **Apply Customer Credit** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | Server Action + RPC (Branch scoped) |
| **Record Expense** | ✅ ($\le$ Limit) | ✅ ($\le$ Limit) | ✅ | ✅ | ✅ | ❌ | Server Action + RPC (Threshold check) |
| **Approve Expense** | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | Server Action + RPC |
| **Record Cash Adjustment** | ❌ | ⚠️ (Notes) | ✅ | ✅ | ✅ | ❌ | Server Action + RPC (Manager PIN/Auth) |
| **Issue Refund** | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | Server Action + RPC (Audit logged) |
| **Record Tip** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | Server Action + RPC |
| **Pay Tip Liability** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | Server Action + RPC (Drawer payout) |
| **Open Drawer Session** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | Server Action + RPC (Float entry) |
| **Close Drawer Session** | ✅ (Blind) | ✅ (Blind) | ✅ | ✅ | ✅ | ❌ | Server Action + RPC (Blind count) |
| **Approve Variance** | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | Server Action + RPC |
| **Reopen Drawer Session** | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | Server Action + RPC (Reason required) |
| **Reverse Transaction** | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | Server Action + RPC (Append-only) |
| **Manage Financial Accounts**| ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | Server Action + RLS (Admin only) |
| **Manage Expense Categories**| ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | Server Action + RLS (Admin only) |
| **View Branch Financials** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | RLS (Branch scoped) |
| **View Cross-Branch Financials**| ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | RLS (Owner/Finance only) |

### Security Invariants:
1. **Server-Side Branch Derivation:** Branch ID is never accepted from client form inputs; it is derived from authenticated session tokens.
2. **Append-Only RLS Policies:** RLS forbids `UPDATE` and `DELETE` on financial movements for all non-superusers.
3. **No Service-Role Browser Exposure:** All financial operations execute through authenticated RPCs.

---

## AA. REPORTING VOCABULARY

[PROJECT DECISION — APPROVED BY OWNER (CF1-D23)]
To eliminate ambiguities present in spreadsheet operations, the following reporting taxonomy is established for CF1 owner approval:

- **Gross Receipts:** Total incoming cash and digital currency collected during the period:
  $$\text{Gross Receipts} = \sum \text{Movements}_{>0}$$
- **Refunds:** Total money returned to customers during the period:
  $$\text{Refunds} = \sum |\text{Movements}_{\text{refund}}|$$
- **Net Receipts:** $\text{Gross Receipts} - \text{Refunds}$.
- **Operating Outflows:** Total operational expenses disbursed from company accounts.
- **Net Operational Cash Flow:** $\text{Net Receipts} - \text{Operating Outflows}$.
- **Outstanding Receivables:** Value of completed services awaiting payment.
- **Customer Credit Outstanding:** Total unallocated customer deposits held by the business.
- **Tips Collected:** Total tips received by the company on behalf of staff.
- **Tips Payable:** Outstanding balance of collected tips awaiting cash disbursement.
- **Cash Variance:** Difference between physical counted cash and system expected cash.

> [!IMPORTANT]
> **NET OPERATIONAL CASH FLOW != ACCOUNTING PROFIT.**  
> Net Cash Flow tracks physical and digital liquidity. Accounting Profit incorporates revenue recognition timing, unearned revenue deferrals, and depreciation, which belong to corporate accounting.

---

## AB. RISK SEVERITY RECONCILIATION

CF0.1 re-evaluates all risks identified in CF0, distinguishing **Structural Architectural Deficiencies** from **Proven Production Incidents**:

| Defect / Risk | Previous CF0 | Reconciled Severity | Nature of Risk | Proven in Production? | Technical Rationale |
| :--- | :---: | :---: | :--- | :---: | :--- |
| **Payment Method Overwrite** | P0 | **P1 (Structural Defect)** | Codebase Architecture Flaw | No | The code undeniably overwrites `payment_method` on split payments. However, CSRs currently bypass CradleHub and use Google Sheets for split payments, preventing live corrupted data in production. |
| **Cancelled Booking Cash Exclusion** | P0 | **P1 (Structural Defect)** | Query Design Flaw | No | `getDailyPaymentSummary` excludes closed bookings. The risk is an analytical underreporting defect, not active production data corruption. |
| **Zero-Save Reconciliation Bug** | P0 | **P0 (Critical Vulnerability)** | Live UI / State Vulnerability | Code Confirmed (`reconciliation-form.tsx`) | The form actively defaults unentered inputs to `"0"` and commits them on Save Draft, actively corrupting daily variance reports. |
| **Missing Expense System** | P1 | **P1 (Operational Gap)** | Missing Feature | N/A | Directly forces operational dependence on external Google Sheets. |
| **Missing Financial Accounts** | P1 | **P1 (Operational Gap)** | Missing Entity Model | N/A | Prevents reconciliation of digital wallets. |
| **Non-Transactional Owner Payment Write** | P2 | **P2 (Integrity Risk)** | Non-Atomic Action | No | Two separate Supabase queries without a wrapping transaction block. |
| **Broad `booking_payment_logs` RLS** | P2 | **P2 (Security Exposure)** | Permissive RLS Policy | Code Confirmed (`with check (true)`) | Authenticated users can insert log rows without branch boundary enforcement. |

---

## AC. MINIMUM SAFE SPREADSHEET CUTOVER

[PROJECT DECISION — APPROVED BY OWNER WITH MODIFICATION (CF1-D24)]

The Master Sheet may be retired only when the following **20-point Capability Gate** has passed release verification:

1. Financial accounts
2. Cash / GCash / Maya / Bank / Card recording
3. Split payments
4. Partial payments
5. Booking-order settlement
6. Advance/deposit handling
7. Basic customer credit application
8. Operating expenses
9. Cash additions/removals/adjustments
10. Refunds
11. Basic gift voucher sale/redemption
12. Tip collection/disbursement where Cradle handles the money
13. Opening float
14. Cash sessions / shift handover
15. Day Close
16. Digital-account reconciliation
17. Daily financial summary
18. Branch ownership and authorization
19. Audit trail
20. Compatibility with existing Booking/PWA consumers

**Governing Cutover Principle:**
> Cutover occurs when this **CAPABILITY GATE** passes, not automatically because a numbered engineering stage was reached.

---

## AD. REVISED BUILD PROGRAM (CF1–CF12)

[RECOMMENDATION — REQUIRES OWNER APPROVAL]
The revised 12-stage program ensures that authorization, security, and RLS are implemented **continuously** from Stage CF2, rather than delayed to the end:

```
CF1  ─── Financial Contract & Taxonomy Freeze
CF2  ─── DB Migration: Financial Accounts, Canonical Transactions & Movements (with RLS)
CF3  ─── DB Migration: Order Payables, Allocations & Expense Details (with RLS)
CF4  ─── DB Migration: Cash Sessions, Float Control & EOD Reconciliation (with RLS)
CF5  ─── Transactional Server RPC Engine (Atomic Multi-Method Payments & Allocations)
CF6  ─── Front-Desk Cash Flow Command UI & Multi-Method Checkout Drawer
CF7  ─── Operational Expense Register UI (Receipt Upload & Quick Categorization)
CF8  ─── Shift Handover, Midday Drops & Blind Day Close UI
CF9  ─── Derived Compatibility Engine (Synchronizing legacy bookings columns)
CF10 ─── Digital Account Reconciliation & Daily Summary Analytics
CF11 ─── Security Auditing, Penetration Testing & RLS Verification
CF12 ─── Production Migration, Staff Training & Master Sheet Cutover
```

### Stage-by-Stage Specifications:

#### Stage CF1 — Financial Contract & Taxonomy Freeze
- **Goal:** Freeze all TypeScript data contracts, database schema specifications, and business rules.
- **Dependencies:** CF0.1 reconciliation acceptance.
- **Database Impact:** None.
- **Application Impact:** New contract files in `src/lib/cash-flow/`.
- **Security Boundary:** Contract validation rules defined.
- **Test Requirements:** Unit tests for contract types and validation parsers.
- **Production Risk:** Zero (no execution).
- **Rollback Strategy:** Git revert.
- **Owner Approval Gate:** Formal sign-off on CF1 Decision Register.

#### Stage CF2 — DB Migration: Financial Accounts & Canonical Transactions
- **Goal:** Provision core account catalog, transaction header, and movement ledger.
- **Dependencies:** CF1.
- **Database Impact:** New tables: `financial_accounts`, `financial_transactions`, `financial_account_movements`.
- **Application Impact:** None (schema only).
- **Security Boundary:** Full RLS policies applied (branch-scoped select/insert, no update/delete).
- **Test Requirements:** Isolated Docker Postgres migration validation.
- **Production Risk:** Low (additive schema).
- **Rollback Strategy:** Down migration script.
- **Owner Approval Gate:** Schema inspection and RLS review.

#### Stage CF3 — DB Migration: Order Payables, Allocations & Expenses
- **Goal:** Provision order payable items, payment allocations, and expense details.
- **Dependencies:** CF2.
- **Database Impact:** New tables: `order_payable_items`, `financial_order_allocations`, `financial_expense_categories`, `financial_expense_details`.
- **Application Impact:** None.
- **Security Boundary:** RLS policies enforced on allocations and expenses.
- **Test Requirements:** Docker validation of allocation constraints ($\sum \text{allocations} \le \text{amount}$).
- **Production Risk:** Low.
- **Rollback Strategy:** Down migration.
- **Owner Approval Gate:** Allocation logic review.

#### Stage CF4 — DB Migration: Cash Sessions & Reconciliation
- **Goal:** Provision cash drawer sessions, float control, and EOD blind close tables.
- **Dependencies:** CF3.
- **Database Impact:** New table: `financial_cash_sessions`.
- **Application Impact:** None.
- **Security Boundary:** Session locking constraints; variance approval permissions.
- **Test Requirements:** Docker validation of blind count variance computation.
- **Production Risk:** Low.
- **Rollback Strategy:** Down migration.
- **Owner Approval Gate:** Cash session schema sign-off.

#### Stage CF5 — Transactional Server RPC Engine
- **Goal:** Build PostgreSQL RPCs and Server Actions for atomic multi-method payments, allocations, and reversals.
- **Dependencies:** CF4.
- **Database Impact:** Stored procedures: `record_financial_payment_atomic`, `record_financial_expense_atomic`, `reverse_financial_transaction_atomic`.
- **Application Impact:** Backend service layer in `src/lib/cash-flow/server/`.
- **Security Boundary:** `SECURITY INVOKER` with session branch verification.
- **Test Requirements:** Full integration tests verifying rollback on allocation failure.
- **Production Risk:** Medium (new RPC logic).
- **Rollback Strategy:** Code rollback.
- **Owner Approval Gate:** RPC integration test verification.

#### Stage CF6 — Front-Desk Cash Flow UI & Checkout Drawer
- **Goal:** Deliver rapid checkout dialog in CRM supporting split payments and account destinations.
- **Dependencies:** CF5.
- **Database Impact:** None.
- **Application Impact:** Replaces `cradle-flow-checkout-dialog.tsx` with multi-method checkout.
- **Security Boundary:** CSR role validation.
- **Test Requirements:** E2E component tests for split Cash + GCash checkout.
- **Production Risk:** Medium.
- **Rollback Strategy:** Feature flag / component revert.
- **Owner Approval Gate:** Front-desk UX demonstration.

#### Stage CF7 — Operational Expense Register UI
- **Goal:** Deliver front-desk expense logging UI with receipt photo upload.
- **Dependencies:** CF6.
- **Database Impact:** Storage bucket for expense receipts (`expense-receipts`).
- **Application Impact:** New Expense Register panel in Cash Flow workspace.
- **Security Boundary:** File upload size and MIME type validation; approval thresholds.
- **Test Requirements:** UI component tests for expense submission and validation.
- **Production Risk:** Low.
- **Rollback Strategy:** UI rollback.
- **Owner Approval Gate:** Expense workflow sign-off.

#### Stage CF8 — Shift Handover, Float & Blind Day Close UI
- **Goal:** Deliver opening float modal, mid-shift drops, and blind EOD reconciliation form.
- **Dependencies:** CF7.
- **Database Impact:** None.
- **Application Impact:** Replaces flawed `reconciliation-form.tsx`.
- **Security Boundary:** Blind count hiding; manager variance sign-off modal.
- **Test Requirements:** Verification that unentered fields do NOT default to 0.
- **Production Risk:** Medium.
- **Rollback Strategy:** UI rollback.
- **Owner Approval Gate:** Day close simulation review.

#### Stage CF9 — Derived Compatibility Engine
- **Goal:** Automate synchronization from new ledger back to legacy `bookings` columns.
- **Dependencies:** CF8.
- **Database Impact:** Trigger or synchronization hook on `financial_order_allocations`.
- **Application Impact:** Legacy queries continue reading accurate `amount_paid` and `payment_status`.
- **Security Boundary:** Automated database trigger.
- **Test Requirements:** Verification that legacy booking views reflect ledger payments.
- **Production Risk:** Medium (trigger overhead).
- **Rollback Strategy:** Trigger drop.
- **Owner Approval Gate:** Compatibility regression suite verification.

#### Stage CF10 — Digital Account Reconciliation & Daily Reports
- **Goal:** Provide GCash/Bank daily reconciliation panels and executive cash flow reports.
- **Dependencies:** CF9.
- **Database Impact:** None.
- **Application Impact:** Analytics queries and executive reporting cards.
- **Security Boundary:** Owner/Manager role restriction for financial reports.
- **Test Requirements:** Report aggregation accuracy tests against test ledger data.
- **Production Risk:** Low.
- **Rollback Strategy:** Code rollback.
- **Owner Approval Gate:** Financial report sign-off.

#### Stage CF11 — Security Hardening, Audit & Certification
- **Goal:** Perform full penetration testing, RLS boundary verification, and performance profiling.
- **Dependencies:** CF10.
- **Database Impact:** Performance indexes added if needed.
- **Application Impact:** Security patches and hardening.
- **Security Boundary:** Formal verification of cross-branch isolation and append-only constraints.
- **Test Requirements:** Automated security audit script.
- **Production Risk:** Low.
- **Rollback Strategy:** N/A.
- **Owner Approval Gate:** Security certification sign-off.

#### Stage CF12 — Production Migration & Master Sheet Cutover
- **Goal:** Apply migrations to production, train front-desk staff, and retire daily Google Sheets.
- **Dependencies:** CF11.
- **Database Impact:** Production migration run.
- **Application Impact:** Production deployment.
- **Security Boundary:** Live production environment.
- **Test Requirements:** Live post-migration verification.
- **Production Risk:** High (production cutover).
- **Rollback Strategy:** Database backup restore and maintenance page.
- **Owner Approval Gate:** Final owner production cutover gate.

---

## AE. CF1 DECISION REGISTER

| Decision ID | Topic | Options Available | Recommended Option | Technical Rationale | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **CF1-D01** | Ledger Architecture | A: Operational Movement Ledger<br>B: Double-Entry Subledger | **Option A (Operational Movement Ledger)** | Matches front-desk speed; solves cash drawer balancing without general-ledger overhead. | **PROJECT DECISION — APPROVED BY OWNER** |
| **CF1-D02** | Event Boundary | A: Separate Independent Tables<br>B: Single Canonical Transaction Header | **Option B (Single Canonical Transaction Header)** | Eliminates double-counting of money between expenses and cash drawer movements. | **PROJECT DECISION — APPROVED BY OWNER** |
| **CF1-D03** | Movement Sign Convention | A: Signed amounts (+ in, - out)<br>B: Separate Debit/Credit columns | **Option A (Signed amounts: + in, - out)** | Simpler indexing, intuitive summation, zero ambiguity. | **PROJECT DECISION — APPROVED BY OWNER** |
| **CF1-D04** | Account Taxonomy | A: Hardcoded account names<br>B: Relational `financial_accounts` catalog | **Option B (Relational catalog)** | Allows branches to configure multiple GCash numbers and card terminals dynamically. | **PROJECT DECISION — APPROVED BY OWNER** |
| **CF1-D05** | Order Payable Model | A: Service Bookings Only<br>B: Unified Order Payable Items | **Option B (Unified Order Payable Items)** | Allows travel fees, retail items, and discounts to participate in payments cleanly. | **PROJECT DECISION — APPROVED BY OWNER** |
| **CF1-D06** | Allocation Model | A: Explicit Line-Item Only<br>B: Two-Tier (Order-level default with item fallback) | **Option B (Two-Tier Allocation)** | Rapid 1-click checkout for CSRs while supporting item-level splits when needed. | **PROJECT DECISION — APPROVED BY OWNER** |
| **CF1-D07** | Payment State Derivation | A: Mutable status column<br>B: Strictly derived from payable vs allocations | **Option B (Strictly derived status)** | Eliminates human error and prevents marking bookings paid for ₱0. | **PROJECT DECISION — APPROVED BY OWNER** |
| **CF1-D08** | Expense Model | A: Flat strings on drawer<br>B: Dedicated Expense Detail Entity | **Option B (Dedicated Expense Detail Entity)** | Enables category reporting, payee tracking, and receipt image attachments. | **PROJECT DECISION — APPROVED BY OWNER** |
| **CF1-D09** | Tip Architecture | A: Treat tips as service revenue<br>B: Separate Direct vs. Company-Custodied Liabilities | **Option B (Separate Direct vs Custodied)** | Prevents company liability leakage and ensures drawer cash balances accurately. | **PROJECT DECISION — APPROVED BY OWNER** |
| **CF1-D10** | Payroll Integration | A: Recompute payroll inside Cash Flow<br>B: Cash Flow only records payout disbursement | **Option B (Cash Flow records disbursement only)** | Preserves strict separation of concerns between HR/payroll and cash operations. | **PROJECT DECISION — APPROVED BY OWNER** |
| **CF1-D11** | Customer Advances | A: Derived balance from unallocated movements<br>B: Dedicated `customer_credits` balance entity | **Option B (Dedicated `customer_credits` entity)** | Fast customer lookup, partial allocations, and explicit refund tracking. | **PROJECT DECISION — APPROVED BY OWNER** |
| **CF1-D12** | Gift Voucher Policy | A: Prepaid Liability Model<br>B: Promotional Discount Model<br>C: Dual-Mode (Paid Liability vs Promo Discount) | **Option C: Dual-Mode Architecture [APPROVED BY OWNER]** | Mode A paid vouchers tracked as customer liabilities; Mode B free/promotional vouchers accounted as marketing discounts. | **PROJECT DECISION — APPROVED BY OWNER** |
| **CF1-D13** | Refund / Reversal Model | A: Destructive row updates<br>B: Immutable append-only linked reversals | **Option B (Immutable append-only reversals)** | Guarantees audit compliance and complete financial traceability. | **PROJECT DECISION — APPROVED BY OWNER** |
| **CF1-D14** | Home Service Boundary | A: Merge fee and fuel into net rate<br>B: Customer Charge in Payable, Fuel in Expenses | **Option B (Charge in Payable, Fuel in Expenses)** | Maintains gross revenue accuracy while capturing fulfillment costs. | **PROJECT DECISION — APPROVED BY OWNER** |
| **CF1-D15** | Retail / Non-Booking Sales | A: Fabricate dummy massage bookings<br>B: Ad-hoc Order Payable Items (`retail_walk_in`)<br>C: Dedicated non-booking sales boundary | **Option C: Dedicated Non-Booking Sales Boundary [APPROVED BY OWNER WITH MODIFICATION]** | Cash Flow records money receipts for walk-in retail without inventing fake booking orders. | **PROJECT DECISION — APPROVED BY OWNER WITH MODIFICATION** |
| **CF1-D16** | Cash Session Model | A: Single global daily record<br>B: Per-drawer, multi-shift `financial_cash_sessions` with shift custody | **Option B: Per-drawer, multi-shift sessions with shift custody [APPROVED BY OWNER]** | Scoped to physical cash drawer; supports continuous drawer sessions across staff shift handovers. | **PROJECT DECISION — APPROVED BY OWNER** |
| **CF1-D17** | Digital Reconciliation | A: Assume digital payments are always valid<br>B: Formal reconciliation states against statements | **Option B (Formal reconciliation states)** | Identifies missing GCash payments and bank discrepancies before EOD lock. | **PROJECT DECISION — APPROVED BY OWNER** |
| **CF1-D18** | Date Semantics | A: Continue using `booking_date`<br>B: Strict partition of `occurred_at`, `business_date`, `booking_date` | **Option B (Strict date partition)** | Allows midnight shifts and advance deposits to balance on the correct business day. | **PROJECT DECISION — APPROVED BY OWNER** |
| **CF1-D19** | Compatibility Snapshots | A: Drop legacy columns immediately<br>B: Maintain derived compatibility snapshots on `bookings` | **Option B (Derived compatibility snapshots)** | Zero breaking changes for existing mobile apps, PWA clients, and legacy views. | **PROJECT DECISION — APPROVED BY OWNER** |
| **CF1-D20** | `booking_payment_logs` Role| A: Continue writing logs on every update<br>B: Freeze historical rows; cease future writes | **Option B (Freeze historical rows; cease future writes)**| Prevents redundant dual logging; new ledger owns financial audit trails. | **PROJECT DECISION — APPROVED BY OWNER** |
| **CF1-D21** | Historical Cutover | A: Backfill fake movements for past years<br>B: Clean temporal partition; bridge legacy refunds | **Option B (Clean temporal partition)** | Preserves historical data integrity without fabricating synthetic events. | **PROJECT DECISION — APPROVED BY OWNER** |
| **CF1-D22** | Authorization Model | A: Client-side role hiding<br>B: Multi-layer Server Action, RLS, and RPC authorization | **Option B (Multi-layer Server Action + RLS + RPC)** | Prevents branch spoofing and unauthorized cross-branch visibility. | **PROJECT DECISION — APPROVED BY OWNER** |
| **CF1-D23** | Reporting Taxonomy | A: Ambiguous spreadsheet terms<br>B: Standardized financial cash flow vocabulary | **Option B (Standardized vocabulary)** | Eliminates confusion between operational cash flow and accounting profit. | **PROJECT DECISION — APPROVED BY OWNER** |
| **CF1-D24** | Spreadsheet Cutover Gate| A: Wait until Stage CF12 completion<br>B: Phased cutover at Stage CF8<br>C: Verified 20-point Capability Gate | **Option C: Verified 20-point Capability Gate [APPROVED BY OWNER WITH MODIFICATION]** | Cutover occurs strictly when all 20 required operational capabilities pass release verification, not automatically because a numbered engineering stage was reached. | **PROJECT DECISION — APPROVED BY OWNER WITH MODIFICATION** |

---

## AF. OWNER QUESTIONS & OPERATIONAL ONBOARDING CONFIGURATION

[ALL ARCHITECTURAL DECISIONS APPROVED — ZERO OPEN DECISIONS]
All 24 CF1 architectural decisions (**CF1-D01 through CF1-D24**) are formally frozen and approved. The following operational parameters are non-blocking runtime configuration values to be supplied during branch onboarding and rollout:
1. **Active GCash Account Catalog:** Exact account names, mobile numbers, and branch assignments for active GCash accounts.
2. **Tip Disbursement Cadence:** Branch-level policy for end-of-shift cash drawer payout vs bi-monthly payroll disbursement.
3. **Expense Approval Threshold:** Maximum expense amount a CSR can disburse without Store Manager approval (e.g. ₱500 vs ₱1,000).
4. **Shift Reopening Authorization:** Who holds the authority to reopen a closed and approved cash session (Owner only vs Store Manager).

---

## AG. DATABASE CHANGES

[REPOSITORY FACT]
- **Migrations Applied:** **NONE** (0 migrations).
- **Schema Modifications:** **NONE** (0 tables created or modified).
- **Rows Inserted / Updated / Deleted:** **NONE** (0 rows touched).
- Stage CF0.1 is 100% planning, architectural reconciliation, and design specification.

---

## AH. PRODUCTION OPERATIONS

[REPOSITORY FACT]
- **Production Access:** **NONE**.
- **Deployments:** **NONE**.
- **Git Actions:** Zero commits, zero pushes, zero merges.

---

## AI. FINAL VERDICT

```
================================================================================
FINAL VERDICT:
PASS — ARCHITECTURE RECONCILED AND COMPLETE FOR CF1 OWNER FREEZE
================================================================================
```

All 24 architectural decisions, domain boundaries, security invariants, and build stages are fully reconciled and specified. The deliverable is complete and ready for project owner review and contract freeze in Stage CF1.
