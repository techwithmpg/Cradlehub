# CF1 — FINANCIAL CONTRACT & TAXONOMY FREEZE

**Target Repository:** `E:\cradlehub-booking-simplification`  
**Current Branch:** `stage/bkg-home-service-simplification`  
**Accepted Base SHA:** `f8977cce5c1286402eed2e6805ba0428c38dc660`  
**Program:** CradleHub Web — CONTROLLED STABILIZATION  
**Stage:** CF1 — FINANCIAL CONTRACT & TAXONOMY FREEZE  
**Status:** **FROZEN & AUTHORIZED BY PROJECT OWNER (PLANNING & CONTRACT SPECIFICATION ONLY)**

---

## A. PROGRAM / TARGET / SCOPE

1. **Program:** CradleHub Web — Controlled Stabilization & Operational Modernization.
2. **Target System:** Operational Cash Flow & Multi-Channel Financial Engine.
3. **Core Mission:** Absorb all operational financial management currently performed in **CRADLE MAINSHEETS** (Google Sheets) into CradleHub Web as an audit-proof, immutable system of record, without sacrificing front-desk transaction speed.
4. **Scope of Stage CF1:** Formal freeze of data contracts, domain boundaries, schema specifications, authorization models, reporting taxonomy, and cutover criteria. **No application code, database migrations, or production operations are authorized in this stage.**

---

## B. REPOSITORY

`E:\cradlehub-booking-simplification`

---

## C. BRANCH

`stage/bkg-home-service-simplification`

---

## D. BASE / HEAD SHA

- **Accepted Baseline SHA:** `f8977cce5c1286402eed2e6805ba0428c38dc660`
- **Working-Tree Status:** All authorized BKG3 online booking wizard, validation, and contract changes are preserved intact.

---

## E. OWNER AUTHORIZATION

The project owner has explicitly reviewed and formally approved all 24 CF1 architectural decisions (**CF1-D01 through CF1-D24**):
- **Core Architecture Decisions Approved:** `CF1-D01` through `CF1-D11`, `CF1-D13`, `CF1-D14`, `CF1-D17` through `CF1-D23`.
- **Dual-Mode Voucher Architecture Approved:** `CF1-D12` (Paid liabilities vs. Promotional discounts).
- **Dedicated Non-Booking Sales Boundary Approved with Modification:** `CF1-D15` (Direct retail sales recorded without fabricating fake bookings).
- **Physical Drawer Cash Session Architecture Approved:** `CF1-D16` (Per-drawer sessions with shift handover custody).
- **20-Point Capability Gate Approved with Modification:** `CF1-D24` (Spreadsheet cutover governed strictly by capability verification, independent of engineering stage numbering).

**Zero architectural decisions remain open.**

---

## F. GOVERNING FINANCIAL PRINCIPLES

1. **Single Source of Monetary Truth:** Money moves exactly once per financial transaction. Competing ledgers are strictly prohibited.
2. **Operational Financial Movement Ledger:** The architecture is an Operational Financial Movement Ledger tracking signed movements against real physical and digital repositories, not a general-ledger double-entry engine.
3. **Append-Only Immutability:** Committed financial transactions and account movements can never be updated or deleted. Corrections and refunds are issued as linked reversal transactions.
4. **Strict Temporal Partitioning:** `occurred_at` (wall-clock event time), `recorded_at` (database commit time), and `business_date` (operating shift day) are strictly separate concepts.
5. **No Synthetic Backfilling:** Historical pre-cutover data remains snapshot evidence. Past transactions are never fabricated.
6. **Continuous Security:** Every implementation stage implements its own Server Action, RLS, and RPC security boundaries from the day it is created.

---

## G. CANONICAL FINANCIAL TRANSACTION CONTRACT

All financial events originate from a single canonical header table: `public.financial_transactions`.

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

### TypeScript Data Contract:
```typescript
export type FinancialTransactionType =
  | 'customer_payment'
  | 'customer_refund'
  | 'customer_deposit'
  | 'operational_expense'
  | 'cash_adjustment'
  | 'tip_collection'
  | 'tip_disbursement'
  | 'payroll_disbursement'
  | 'voucher_sale'
  | 'voucher_redemption'
  | 'retail_sale'
  | 'other_income';

export type FinancialTransactionStatus = 'posted' | 'reversed' | 'voided';

export interface FinancialTransaction {
  id: string; // UUID primary key
  branchId: string; // UUID references branches(id)
  transactionType: FinancialTransactionType;
  businessDate: string; // YYYY-MM-DD operating date
  occurredAt: string; // ISO 8601 wall-clock timestamp
  recordedAt: string; // ISO 8601 database commit timestamp
  recordedBy: string; // UUID references staff(id)
  currency: 'PHP';
  status: FinancialTransactionStatus;
  idempotencyKey: string; // Unique idempotency token
  sourceType?: 'booking_order' | 'cash_session' | 'payroll_run' | 'retail_sale' | 'legacy_booking';
  sourceId?: string; // Foreign key to source entity
  externalReference?: string; // GCash ref, Card Auth, Bank Ref
  reversalOfTransactionId?: string; // Self-referencing UUID for linked reversals
  notes?: string;
}
```

### Monetary Invariant:
The transaction header does **NOT** store an independent mutable amount. Total transaction value is derived as $\sum |\text{movement.amount}|$, validated atomically at write time.

---

## H. ACCOUNT MOVEMENT CONTRACT

The table `public.financial_account_movements` records the physical or electronic transfer of funds.

### TypeScript Data Contract:
```typescript
export type FinancialPaymentRail =
  | 'cash'
  | 'gcash'
  | 'maya'
  | 'bank_transfer'
  | 'card'
  | 'voucher'
  | 'customer_credit';

export interface FinancialAccountMovement {
  id: string; // UUID primary key
  transactionId: string; // UUID references financial_transactions(id)
  financialAccountId: string; // UUID references financial_accounts(id)
  amount: number; // Signed NUMERIC(12,2)
  paymentMethod: FinancialPaymentRail;
  externalReference?: string; // Movement-specific reference if applicable
  createdAt: string;
}
```

### Sign Convention (FROZEN):
- **Positive (`+ amount`)**: Money **ENTERS** the account (inflows, customer payments, cash float additions).
- **Negative (`- amount`)**: Money **LEAVES** the account (outflows, operational expenses, refunds, safe drops, tip payouts).
- **Non-Zero Rule**: `CHECK (amount <> 0)`.

---

## I. FINANCIAL ACCOUNT CONTRACT

The table `public.financial_accounts` represents actual physical drawers, bank accounts, digital wallets, and card terminals.

### TypeScript Data Contract:
```typescript
export type FinancialAccountType =
  | 'cash_drawer'
  | 'gcash'
  | 'maya'
  | 'bank_transfer'
  | 'card_terminal';

export interface FinancialAccount {
  id: string; // UUID primary key
  branchId?: string | null; // Nullable for corporate-level accounts
  name: string; // e.g. "Main Cash Drawer", "Front Desk GCash #1"
  accountType: FinancialAccountType;
  identifierMask: string; // e.g. "ending in *1234", "0917-***-5678"
  encryptedIdentifier?: string; // Full number encrypted (Owner/Finance access only)
  currency: 'PHP';
  isActive: boolean;
  createdAt: string;
}
```

---

## J. BOOKING ORDER PAYABLE CONTRACT

The table `public.order_payable_items` records all individual charges and discounts associated with a customer order.

### TypeScript Data Contract:
```typescript
export type OrderPayableChargeType =
  | 'service'
  | 'home_service_fee'
  | 'retail_product'
  | 'surcharge'
  | 'discount'
  | 'manual_adjustment'
  | 'other_charge';

export interface OrderPayableItem {
  id: string; // UUID primary key
  orderId: string; // UUID references booking_orders(id)
  bookingId?: string | null; // UUID references bookings(id) for service lines
  chargeType: OrderPayableChargeType;
  description: string;
  nominalAmount: number; // Positive for charges, negative for discounts
  createdAt: string;
}
```

### Rules & Invariants:
1. **Tips are EXCLUDED from Order Payables:** Tips are non-revenue liabilities, not charges owed to the business. They attach directly to payment transactions via `financial_tip_details`.
2. **Service Line 1:1 Link:** `service` charges snapshot `services.price` at booking creation and reference `bookingId`.
3. **Payable Calculation:**
   $$\text{Total Payable} = \sum_{\text{charges}} \text{nominalAmount} - \sum_{\text{discounts}} |\text{nominalAmount}|$$

---

## K. PAYMENT ALLOCATION CONTRACT

The table `public.financial_order_allocations` links payment movement value to specific orders and payable items.

### TypeScript Data Contract:
```typescript
export interface FinancialOrderAllocation {
  id: string; // UUID primary key
  movementId: string; // UUID references financial_account_movements(id)
  orderId: string; // UUID references booking_orders(id)
  payableItemId?: string | null; // Nullable; null = order-level default allocation
  allocatedAmount: number; // NUMERIC(12,2) CHECK (allocatedAmount > 0)
  createdAt: string;
}
```

### Two-Tier Allocation Mechanics:
1. **Tier 1 (Order Level - Default Front Desk Flow):** CSR settles an order; system auto-allocates to `orderId` and satisfies payable items in canonical sequence (Services $\rightarrow$ Home Service Fees $\rightarrow$ Retail $\rightarrow$ Surcharges).
2. **Tier 2 (Item Level - Explicit Split Flow):** CSR explicitly allocates a specific movement to a specific attendee's service charge (`payableItemId`).
3. **Allocation Limit Invariant:**
   $$\sum \text{allocatedAmount} \le \text{movement.amount}$$
   Any unallocated positive remainder constitutes unapplied customer credit.

---

## L. DERIVED PAYMENT STATE CONTRACT

Payment status is strictly computed and cannot be directly updated via SQL or UI mutations.

### Derived State Definitions:
- **`unpaid`**: $\text{Net Allocated Payments} = 0$.
- **`partial`**: $0 < \text{Net Allocated Payments} < \text{Total Payable}$.
- **`paid`**: $\text{Net Allocated Payments} = \text{Total Payable}$.
- **`overpaid`**: $\text{Net Allocated Payments} > \text{Total Payable}$.
- **`refunded`**: $100\%$ of collected payments have been returned via reversals/refunds ($\text{Net Allocated Payments} = 0$ after refunds).
- **`partially_refunded`**: A portion of collected payments was refunded ($0 < \text{Net Allocated Payments} < \text{Total Payable}$).

---

## M. EXPENSE CONTRACT

Operating expenses represent money leaving a financial account for operational purposes.

### TypeScript Data Contract:
```typescript
export interface FinancialExpenseDetail {
  id: string; // UUID primary key
  transactionId: string; // UUID references financial_transactions(id)
  categoryId: string; // UUID references financial_expense_categories(id)
  payee: string; // e.g. "Petron Gas Station", "CleanAir Laundry"
  receiptReference?: string; // Official receipt or invoice number
  receiptImageUrl?: string; // Storage path for receipt photo
  approvalStatus: 'approved_instant' | 'pending_approval' | 'approved' | 'rejected';
  approvedBy?: string; // UUID references staff(id)
  relatedBookingOrderId?: string; // Optional Home Service trip link
  relatedStaffId?: string; // Optional staff reimbursement link
  notes?: string;
}
```

### Categories:
Stored in configurable table `public.financial_expense_categories`, seeded with standard defaults: `fuel`, `laundry`, `water`, `supplies`, `repairs`, `telecom`, `meals`, `petty_cash`, `other`.

---

## N. TIP CONTRACT

CF1 formally codifies the boundary between Direct Cash Tips and Company-Custodied Tips:

### Case A — Direct Cash Tips (Zero Company Custody):
- Handed directly by client to therapist in cash.
- **Zero company custody; zero cash drawer movement; zero impact on Day Close.**
- Recorded optionally for staff reporting as an informational record (`isCompanyCustodied = false`).

### Case B — Company-Custodied Tips (Digital or Cashier Collected):
- Customer pays tip via GCash, Card, or hands cash to cashier at checkout.
- Money enters company account; creates a **Staff Tip Liability**.
- Disbursed from Cash Drawer via an explicit `tip_disbursement` transaction (`-amount`).
- **Tips are NEVER counted as company service revenue.**

### TypeScript Data Contract:
```typescript
export interface FinancialTipDetail {
  id: string; // UUID primary key
  transactionId: string; // UUID references financial_transactions(id)
  beneficiaryStaffId: string; // UUID references staff(id)
  relatedBookingOrderId?: string;
  relatedBookingId?: string;
  tipAmount: number;
  custodyType: 'direct_cash' | 'company_custodied';
  payoutStatus: 'not_applicable' | 'pending_disbursement' | 'disbursed';
  payoutTransactionId?: string; // Links to tip_disbursement transaction
  createdAt: string;
}
```

---

## O. PAYROLL / COMMISSION BOUNDARY

1. **Owner Payroll Domain:** Computes commissions, hourly wages, overtime, and statutory deductions; establishes **Payable to Staff**.
2. **Cash Flow Domain:** Records the **Disbursement of Payable** from physical or digital accounts. Cash Flow never recalculates payroll logic.

---

## P. CUSTOMER CREDIT / ADVANCE CONTRACT

Tracks advance deposits and unallocated balances:

### TypeScript Data Contract:
```typescript
export interface FinancialCustomerCredit {
  id: string; // UUID primary key
  customerId: string; // UUID references customers(id)
  originatingTransactionId: string; // UUID references financial_transactions(id)
  initialAmount: number;
  allocatedAmount: number;
  refundedAmount: number;
  availableBalance: number; // Generated as (initialAmount - allocatedAmount - refundedAmount)
  status: 'active' | 'fully_applied' | 'refunded';
  createdAt: string;
}
```

---

## Q. GIFT VOUCHER CONTRACT (DUAL-MODE)

[PROJECT DECISION — APPROVED BY OWNER (CF1-D12)]

CF1 establishes a formal **Dual-Mode Voucher Architecture**:

```
                                  ┌───────────────────────────┐
                                  │   GIFT VOUCHER ISSUANCE   │
                                  └───────────────────────────┘
                                                │
                     ┌──────────────────────────┴──────────────────────────┐
                     ▼                                                     ▼
      ┌─────────────────────────────┐                       ┌─────────────────────────────┐
      │   MODE A: PAID / PREPAID    │                       │  MODE B: PROMOTIONAL / FREE │
      ├─────────────────────────────┤                       ├─────────────────────────────┤
      │ - Customer pays currency    │                       │ - Issued with ₱0 payment    │
      │ - Cash inflow recorded      │                       │ - Zero cash inflow          │
      │ - Becomes Customer Liability│                       │ - Becomes Marketing Discount│
      │ - Redemption settles payable│                       │ - Redemption discounts bill │
      │   with ZERO new cash inflow │                       │ - No liability recorded     │
      └─────────────────────────────┘                       └─────────────────────────────┘
```

### TypeScript Data Contract:
```typescript
export type VoucherMode = 'paid' | 'promotional';
export type VoucherStatus = 'issued' | 'active' | 'partially_redeemed' | 'redeemed' | 'expired' | 'voided';

export interface FinancialVoucher {
  id: string; // UUID primary key
  voucherCode: string; // Unique alphanumeric code
  voucherMode: VoucherMode;
  initialValue: number;
  remainingBalance: number;
  purchaserCustomerId?: string;
  recipientName?: string;
  saleTransactionId?: string; // Populated ONLY for Mode A (paid vouchers)
  status: VoucherStatus;
  issuedAt: string;
  expiresAt?: string;
}

export interface FinancialVoucherRedemption {
  id: string;
  voucherId: string;
  transactionId: string;
  orderId: string;
  redeemedAmount: number;
  redeemedAt: string;
}
```

---

## R. REFUND / REVERSAL CONTRACT

[PROJECT DECISION — APPROVED BY OWNER (CF1-D13)]

1. **Append-Only Reversals:** Reversals create linked child transactions referencing `reversalOfTransactionId` with signed negative account movements.
2. **Post-Cutover Refund of Pre-Cutover Legacy Booking:**
   - Handled via a new refund transaction with `sourceType = 'legacy_booking'`, `sourceId = legacyBookingId`, `reversalOfTransactionId = NULL`, and explicit audit notes.
   - Generates an accurate cash-out movement (`-amount`) from the drawer, balancing physical cash without violating foreign keys.

---

## S. HOME SERVICE FINANCIAL BOUNDARY

[PROJECT DECISION — APPROVED BY OWNER (CF1-D14)]

- **Customer Charge (Home Service Fee):** Billed to client; recorded as an `order_payable_items` row (`chargeType = 'home_service_fee'`); represents **Gross Revenue**.
- **Business Cost (Fuel / Fare / Driver Allowance):** Incurred by company; recorded as an `operational_expense` transaction (`category = 'fuel'`); represents **Operating Outflow**.
- Both reference `booking_orders.id`, but are **NEVER** merged or offset.

---

## T. RETAIL / NON-BOOKING SALE CONTRACT

[PROJECT DECISION — APPROVED BY OWNER WITH MODIFICATION (CF1-D15)]

**Never fabricate a booking to record a retail sale.**

1. **Booking-Related Sale:** Retail item added to an existing spa booking is attached to the existing `booking_orders` as an `order_payable_items` row (`chargeType = 'retail_product'`).
2. **Pure Non-Booking Sale (Walk-In Merchandise):**
   - Customer walks in to buy massage oil, shampoo, or aromatherapy spray.
   - Recorded as a canonical financial transaction with `transactionType = 'retail_sale'` and `sourceType = 'retail_sale'`.
   - A dedicated `financial_retail_sale_details` child record stores item description, quantity, and unit price.
   - Cash Flow owns the monetary receipt; future Inventory/POS will own SKUs and stock.
   - **`booking_orders.type = 'retail_walk_in'` is NOT created.**

---

## U. CASH SESSION CONTRACT

[PROJECT DECISION — APPROVED BY OWNER (CF1-D16)]

Cash sessions are strictly scoped to a **Physical Cash Drawer** (`account_id`).

### Invariant:
**Exactly ONE active cash session per physical cash drawer at a time.**

### TypeScript Data Contract:
```typescript
export interface FinancialCashSession {
  id: string; // UUID primary key
  branchId: string; // References branches(id)
  accountId: string; // References financial_accounts(id) for the cash drawer
  sessionNumber: number; // Sequential shift number for the day
  businessDate: string; // Operating date (YYYY-MM-DD)
  openedAt: string;
  openedBy: string; // UUID references staff(id)
  openingFloat: number; // Starting change fund (e.g. ₱2,000)
  closedAt?: string;
  closedBy?: string;
  systemExpectedCash?: number;
  blindCountedCash?: number;
  variance?: number; // blindCountedCash - systemExpectedCash
  varianceExplanation?: string;
  status: 'open' | 'submitted' | 'approved' | 'reopened';
  submittedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  reopenedBy?: string;
  reopenedAt?: string;
  reopenReason?: string;
}
```

---

## V. SHIFT HANDOVER CONTRACT

[PROJECT DECISION — APPROVED BY OWNER]

A physical cash drawer may remain continuously open across staff shift changes without requiring a full Day Close.

### Handover Mechanics:
1. Midday shift change occurs between Outgoing CSR and Incoming CSR.
2. System records an immutable handover custody log:
   ```typescript
   export interface FinancialShiftHandover {
     id: string;
     sessionId: string;
     outgoingStaffId: string;
     incomingStaffId: string;
     handoverAt: string;
     systemExpectedCash: number;
     handoverCountedCash?: number;
     variance?: number;
     notes?: string;
   }
   ```
3. Preserves custody accountability without disrupting front-desk operations.

---

## W. DAY CLOSE CONTRACT

[PROJECT DECISION — APPROVED BY OWNER]

1. Closing CSR performs a **Blind Physical Cash Count** (bills and coins counted without seeing system totals).
2. **Canonical Expected Cash Formula:**
   $$\text{Expected Cash} = \text{Opening Float} + \text{Cash Receipts} + \text{Cash Additions} - \text{Cash Refunds} - \text{Cash Expenses} - \text{Safe Drops} - \text{Custodied Tip Payouts} \pm \text{Adjustments}$$
3. **Direct therapist cash tips have ZERO drawer impact.**
4. Session locking is immutable once approved. Reopening requires manager credentials, documented reason, and audit logging.

---

## X. DIGITAL RECONCILIATION CONTRACT

[PROJECT DECISION — APPROVED BY OWNER (CF1-D17)]

Digital accounts (GCash, Maya, Bank Transfers, Card Terminals) are reconciled against provider statements using formal states:
- `unverified`: Initial state prior to verification.
- `matched`: Provider ending balance matches net system movements.
- `variance`: Discrepancy detected between provider and system.
- `investigating`: CSR researching specific reference numbers.
- `approved`: Manager accepts verified balance with documented notes.

---

## Y. DATE / BUSINESS-DATE CONTRACT

[PROJECT DECISION — APPROVED BY OWNER (CF1-D18)]

1. `occurred_at`: Wall-clock ISO timestamp of when money moved.
2. `recorded_at`: PostgreSQL commit timestamp (`NOW()`).
3. `business_date`: Commercial operating date of the open shift session.
4. `booking_date`: Service appointment delivery date (belongs to `bookings`).
5. **Midnight Rule:** Transactions occurring past midnight on a shift spanning late night are assigned the `business_date` of the active shift session.

---

## Z. LEGACY COMPATIBILITY CONTRACT

[PROJECT DECISION — APPROVED BY OWNER (CF1-D19)]

1. `bookings.amount_paid`, `bookings.payment_status`, and `bookings.payment_method` remain in PostgreSQL schema.
2. They are transformed into **Derived Compatibility Snapshots** maintained via database triggers or transactional RPC hooks.
3. Mapping:
   - ₱0 paid $\rightarrow$ `'unpaid'`
   - Partial $\rightarrow$ `'pending'`
   - Full paid $\rightarrow$ `'paid'`
   - Refunded $\rightarrow$ `'refunded'`
   - Single method $\rightarrow$ method name; Multiple methods $\rightarrow$ `'split'`.

---

## AA. booking_payment_logs CONTRACT

[PROJECT DECISION — APPROVED BY OWNER (CF1-D20)]

1. All historical rows in `public.booking_payment_logs` are preserved as immutable audit evidence.
2. The table is completely retired from financial reporting authority.
3. Future automated compatibility updates will cease writing to `booking_payment_logs`; all financial auditing is owned by `financial_transactions`.

---

## AB. HISTORICAL CUTOVER CONTRACT

[PROJECT DECISION — APPROVED BY OWNER (CF1-D21)]

1. A clean temporal boundary partitions financial history.
2. Pre-cutover queries read legacy snapshot tables; post-cutover queries read the canonical event ledger.
3. Zero synthetic movements will be backfilled for pre-cutover data.

---

## AC. AUTHORIZATION / RLS CONTRACT

[PROJECT DECISION — APPROVED BY OWNER (CF1-D22)]

1. **No Client-Side Trust:** `branch_id` is derived from verified server session tokens.
2. **Append-Only Policies:** `INSERT` and `SELECT` are permitted for authorized roles; `UPDATE` and `DELETE` on financial movements are strictly blocked by PostgreSQL RLS.
3. **Masked Identifiers:** Ordinary staff read masked account numbers (`*1234`); full details restricted to Owner/Finance.
4. **Security Staged from Day 1:** Every implementation stage implements its own RLS and server authorization.

---

## AD. REPORTING TAXONOMY

[PROJECT DECISION — APPROVED BY OWNER (CF1-D23)]

Standardized cash flow reporting vocabulary:
- **Gross Receipts:** Total incoming cash and digital currency collected during the period.
- **Refunds:** Total money returned to customers during the period.
- **Net Receipts:** $\text{Gross Receipts} - \text{Refunds}$.
- **Operating Outflows:** Total operational expenses disbursed from company accounts.
- **Net Operational Cash Flow:** $\text{Net Receipts} - \text{Operating Outflows}$.
- **Outstanding Receivables:** Value of completed services awaiting payment settlement.
- **Customer Credit Outstanding:** Total unallocated customer deposits held by the business.
- **Tips Collected:** Total tips received by company on behalf of staff.
- **Tips Payable:** Outstanding balance of collected tips awaiting cash disbursement.
- **Cash Variance:** $\text{Blind Counted Cash} - \text{System Expected Cash}$.

> [!IMPORTANT]
> **NET OPERATIONAL CASH FLOW != ACCOUNTING PROFIT.**  
> Cash flow tracks physical and digital liquidity movements. Accounting Profit incorporates revenue recognition timing, unearned revenue deferrals, and depreciation.

---

## AE. 20-POINT MASTER SHEET RETIREMENT GATE

[PROJECT DECISION — APPROVED BY OWNER WITH MODIFICATION (CF1-D24)]

The Master Sheet (`CRADLE MAINSHEETS`) may be retired **only** when all 20 of the following capabilities have passed formal release verification:

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

## AF. CF1-D01–D24 FINAL DECISION REGISTER

| Decision ID | Topic | Approved Technical Decision | Status |
| :--- | :--- | :--- | :---: |
| **CF1-D01** | Ledger Architecture | Operational Financial Movement Ledger (Option A). Signed account movements; no general-ledger overhead. | **PROJECT DECISION — APPROVED BY OWNER** |
| **CF1-D02** | Event Boundary | Single Canonical Transaction Header (`financial_transactions`) with typed child detail records. | **PROJECT DECISION — APPROVED BY OWNER** |
| **CF1-D03** | Movement Sign Convention | Signed numeric amounts: `+` for inflows (entering account), `-` for outflows (leaving account). | **PROJECT DECISION — APPROVED BY OWNER** |
| **CF1-D04** | Account Taxonomy | Relational `financial_accounts` catalog with masked identifiers and branch scoping. | **PROJECT DECISION — APPROVED BY OWNER** |
| **CF1-D05** | Order Payable Model | Unified `order_payable_items` linked to `booking_orders`. Tips explicitly excluded from payables. | **PROJECT DECISION — APPROVED BY OWNER** |
| **CF1-D06** | Allocation Model | Two-tier allocation: Order-level default with automatic service fulfillment; item-level split support. | **PROJECT DECISION — APPROVED BY OWNER** |
| **CF1-D07** | Payment State Derivation | Strictly derived payment states (`unpaid`, `partial`, `paid`, `overpaid`, `partially_refunded`, `refunded`). | **PROJECT DECISION — APPROVED BY OWNER** |
| **CF1-D08** | Expense Model | Dedicated `financial_expense_details` child entity linked to configurable expense categories. | **PROJECT DECISION — APPROVED BY OWNER** |
| **CF1-D09** | Tip Architecture | Strict separation: Direct Cash Tips (no custody) vs. Company-Custodied Tips (staff liability). | **PROJECT DECISION — APPROVED BY OWNER** |
| **CF1-D10** | Payroll Integration | Strict boundary: Payroll calculates earnings/commissions; Cash Flow exclusively executes disbursements. | **PROJECT DECISION — APPROVED BY OWNER** |
| **CF1-D11** | Customer Advances | Dedicated `financial_customer_credits` balance entity for pre-payments and deposits. | **PROJECT DECISION — APPROVED BY OWNER** |
| **CF1-D12** | Gift Voucher Policy | Dual-mode voucher model: Mode A (Paid Liability) vs. Mode B (Promotional Discount). | **PROJECT DECISION — APPROVED BY OWNER** |
| **CF1-D13** | Refund / Reversal Model | Append-only linked reversals (`reversal_of_transaction_id`) with legacy bridge for pre-cutover refunds. | **PROJECT DECISION — APPROVED BY OWNER** |
| **CF1-D14** | Home Service Boundary | Customer travel fee in order payables (revenue); fulfillment fuel/fare in expenses (outflows). | **PROJECT DECISION — APPROVED BY OWNER** |
| **CF1-D15** | Retail / Non-Booking Sales | Dedicated non-booking sales boundary (`retail_sale`). Never fabricate a booking for pure retail. | **PROJECT DECISION — APPROVED BY OWNER WITH MODIFICATION** |
| **CF1-D16** | Cash Session Model | Scoped to Physical Cash Drawer (`account_id`). Invariant: One active session per drawer. | **PROJECT DECISION — APPROVED BY OWNER** |
| **CF1-D17** | Digital Reconciliation | Formal reconciliation states (`unverified`, `matched`, `variance`, `investigating`, `approved`). | **PROJECT DECISION — APPROVED BY OWNER** |
| **CF1-D18** | Date Semantics | Strict partition between `occurred_at`, `recorded_at`, `business_date`, and `booking_date`. | **PROJECT DECISION — APPROVED BY OWNER** |
| **CF1-D19** | Compatibility Snapshots | Derived synchronization from ledger to legacy `bookings` columns (`amount_paid`, `payment_status`, etc.). | **PROJECT DECISION — APPROVED BY OWNER** |
| **CF1-D20** | `booking_payment_logs` Role| Historical rows frozen for audit; future automated writes cease upon new ledger cutover. | **PROJECT DECISION — APPROVED BY OWNER** |
| **CF1-D21** | Historical Cutover | Clean temporal partition without synthetic backfilling. | **PROJECT DECISION — APPROVED BY OWNER** |
| **CF1-D22** | Authorization Model | Multi-layer Server Action, RLS, and RPC security boundary enforced from Stage CF2 onwards. | **PROJECT DECISION — APPROVED BY OWNER** |
| **CF1-D23** | Reporting Taxonomy | Standardized cash flow vocabulary; explicit separation of Net Operational Cash Flow from Profit. | **PROJECT DECISION — APPROVED BY OWNER** |
| **CF1-D24** | Spreadsheet Cutover Gate| Master Sheet retired strictly upon passing verified 20-point Capability Gate, independent of stage numbers. | **PROJECT DECISION — APPROVED BY OWNER WITH MODIFICATION** |

---

## AG. IMPLEMENTATION DEPENDENCY ORDER (CF2–CF12)

The recommended implementation sequence for future owner authorization:

1. **CF2 — Financial Accounts & Canonical Transaction Foundation:** DDL/RLS for `financial_accounts`, `financial_transactions`, `financial_account_movements`.
2. **CF3 — Order Payables, Allocations & Expense Details:** DDL/RLS for `order_payable_items`, `financial_order_allocations`, `financial_expense_categories`, `financial_expense_details`.
3. **CF4 — Cash Sessions, Handover & EOD Reconciliation:** DDL/RLS for `financial_cash_sessions`, `financial_shift_handovers`.
4. **CF5 — Transactional Server RPC Engine:** Stored procedures for atomic multi-method payments, allocations, expenses, and reversals.
5. **CF6 — Front-Desk Cash Flow UI & Checkout Drawer:** CRM checkout interface supporting split payments and account destinations.
6. **CF7 — Operational Expense Register UI:** Front-desk expense logging with receipt photo upload.
7. **CF8 — Shift Handover, Float & Blind Day Close UI:** Drawer management, float modal, and blind EOD reconciliation form.
8. **CF9 — Derived Compatibility Engine:** Automated database triggers synchronizing legacy `bookings` columns.
9. **CF10 — Digital Account Reconciliation & Daily Summary Analytics:** Daily GCash/Bank matching and executive reporting cards.
10. **CF11 — Security Hardening, Audit & Release Verification:** Verification of the 20-point capability gate against Docker and staging environments.
11. **CF12 — Production Migration & Master Sheet Cutover:** Production migration application, staff training, and retirement of Google Sheets.

---

## AH. OUT-OF-SCOPE / LATER INTEGRATIONS

The following items are deferred to future programs and are explicitly out of scope for CF2–CF12:
- Direct Automated Open-Banking / GCash API Feeds (reconciliation in V1 uses statement entry).
- Full Warehouse Inventory Management / Barcode Scanning (V1 uses ad-hoc retail payable items).
- GAAP Corporate General Ledger Accounting & Tax Depreciation Engine.

---

## AI. DATABASE CHANGES

[REPOSITORY FACT]
- **Migrations Authored or Applied:** **NONE** (0 migrations).
- **Schema Modifications:** **NONE** (0 tables created, altered, or dropped).
- **Database Records Mutated:** **NONE** (0 rows touched).
- Stage CF1 is 100% planning, contract freeze, and governance documentation.

---

## AJ. PRODUCTION OPERATIONS

[REPOSITORY FACT]
- **Production Database Connections:** **NONE**.
- **Deployments:** **NONE**.
- **Git Actions:** Zero commits, zero pushes, zero merges.
- All authorized BKG3 / ACT2 working tree changes remain preserved intact.

---

## AK. CF1 FINAL VERDICT

```
================================================================================
FINAL VERDICT:
PASS — CF1 FINANCIAL CONTRACT & TAXONOMY FROZEN
================================================================================
```

All 24 architectural decisions (**CF1-D01 through CF1-D24**) are formally frozen and authorized by the project owner. The 20-point Capability Gate is established as the sole criterion for retiring CRADLE MAINSHEETS. 

**Stage CF1 is complete.**

**STOP CONDITION ENFORCED:** Execution halted. Awaiting explicit owner authorization before initiating Stage CF2.
