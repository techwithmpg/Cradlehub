# CF5.1 — Record Financial Entry Modal Redesign Report
**CradleHub Web — Controlled Stabilization Program**

---

## 1. Executive Summary

| Attribute | Specification |
|---|---|
| **Target Repository** | `E:\cradlehub-booking-simplification` |
| **Branch** | `stage/cf-financial-foundation` |
| **Base Commit SHA** | `78ac8cb90423f9bb4c4efbbd91249de4bf86e904` |
| **Implementation Commit SHA** | `6e802ebd7232fa282a084857ab7b8179894be0c9` |
| **Layout Correction Commit SHA** | `d7f5ee681ae89a05f14eec35d470d04961cefd58` |
| **Visual Authority** | Approved PNG (`Record Financial Entry` centered desktop modal UI) |
| **Scope Status** | Strict UI structure, presentation, layout dimensions, and safe existing CF4 payment preservation |
| **Visual Review Status** | **OWNER VISUAL REVIEW REQUIRED** |

---

## 2. Visual Reference Reproduction & Architecture

### A. Centered Modal Architecture vs. Old Side Drawer
- **Old Drawer Ownership:** The legacy `RecordPaymentSheet` was implemented as a right-hand sliding sheet (`Sheet`, `SheetContent side="right"`).
- **New Modal Ownership:** Completely replaced by `RecordFinancialEntryModal` (`src/components/features/cash-flow/record-financial-entry-modal.tsx`).
  - Centered in the viewport using Base UI Dialog primitives with dark/soft overlay (`bg-black/10 backdrop-blur-xs`).
  - **Desktop Width:** `w-[96vw] md:w-[min(94vw,1000px)] max-w-none sm:max-w-none` overriding default `sm:max-w-sm` to provide a full ~1000px desktop operations workspace.
  - **Desktop Height & Scroll Architecture:** `max-h-[90vh]` with fixed header (`shrink-0`), scrollable content body (`flex-1 min-h-0 overflow-y-auto`), and stable footer (`shrink-0`).
  - **Two-Column Grid Ratio:** `grid-cols-1 lg:grid-cols-[minmax(0,2.2fr)_minmax(270px,0.9fr)] gap-6` allocating ~71% to main form and ~29% (min 270px) to summary cards.
  - **Mode Cards:** `grid-cols-2 sm:grid-cols-4 gap-3` with unwrapped titles (`whitespace-nowrap`) and clean helper copy.
  - Warm cream/off-white surface (`bg-[#FAF8F5]`), rounded corners (`rounded-2xl`), subtle border (`border-[#EAE4DC]`), and soft drop shadow (`shadow-2xl`).
  - Accessible top-right `X` close button and `Escape` key trap.
  - Backwards-compatibility preserved: `src/components/features/cash-flow/record-payment-sheet.tsx` re-exports `RecordFinancialEntryModal` as `RecordPaymentSheet`.

### B. Header & 4-Mode Selector
- **Header:**
  - Title: **Record Financial Entry**
  - Subtitle: *Record customer payments, expenses, tips, and other cash-flow entries.*
- **Mode Switcher (4 Cards):**
  1. **Customer Payment:** Active by default. Forest green border (`border-2 border-[#1B4D3E]`), light green background (`bg-[#EEF7F2]`), dark green accent text, Banknote icon. Record payment for a booking.
  2. **Expense:** Orange accent icon. *Record business expenses.* Controlled informational placeholder: *"Expense recording will be enabled in a later Cash Flow stage."*
  3. **Tip:** Red accent icon. *Record staff or house tips.* Controlled informational placeholder: *"Tip recording will be enabled in a later Cash Flow stage."*
  4. **Other Entry:** Dark neutral icon. *Adjustments, misc income, etc.* Controlled informational placeholder: *"Other financial entries will be enabled in a later Cash Flow stage."*
- **Safety Guarantee:** Clicking inactive modes does not fabricate transactions or write ledger rows.

---

## 3. Customer Payment Mode Implementation

### 1. Select Booking / Order
- Large searchable selector with auto-filtered order dropdown.
- Search matches booking/order reference (e.g. `BK-20260928-002`), customer name, or phone number.
- Helper text: *"Search by booking reference, customer name, or phone number. Shows unpaid or partially paid bookings only."*
- Contextual order prefill supported via `initialOrderId` prop.

### 2. Smart Booking Summary Card
Displays canonical booking metadata:
- **Customer Name & Phone:** (e.g., `Maria Santos`, `0918 987 6543`)
- **Booking Reference:** (e.g., `BK-20260928-003`)
- **Payment Status Badge:** `Unpaid`, `Partially Paid`, or `Paid`
- **Branch:** Branch name badge with map pin icon
- **Visit Type:** In-Spa or Home Service badge
- **Service Date & Time:** Formatted date and time range
- **Booking Status Badge:** `Confirmed`, `In Progress`, or `Completed`

### 3. Booking Charges & Home Service Separation
- Itemized canonical payable items rendered in table format (`DESCRIPTION`, `AMOUNT (₱)`).
- **Home Service Charge Separation:** Visually separates service line (e.g., *Signature Home Service Massage — ₱3,500.00*) from *Home Service Gas Fee / Travel Fee (₱300.00)*.
- Total Booking Amount displayed.
- Less: Previous Payments displayed with details (date and method) in muted red.
- Outstanding Balance displayed in highlighted green box (`bg-[#EEF7F2] border-[#C8E6D9] text-[#1B4D3E]`).

### 4. Payment Summary Side Card & About Card
- **Payment Summary Card (Desktop right column):**
  - Total Booking Amount, Previous Payments, and Outstanding Balance.
  - Action button: `+ Pay full balance (₱X)` automatically populates Tender #1 with the exact remaining balance.
- **About Customer Payments Card:**
  - Light green informational card matching the design specification: *"Record full, partial, or split-tender payments for existing bookings. The booking details and payable items are automatically populated to ensure accurate recording."*

### 5. Payment Method(s) & Deposit Account Compatibility
- Tender cards with border and soft background:
  - **Payment Method:** Changeable between CF4 rails (`Cash`, `GCash`, `Maya`, `Bank Transfer`, `Card`).
  - Excluded from account-moving rails: Voucher, Customer Credit, Pay on Site.
  - **Deposit Account:** Dynamically filtered to accounts compatible with the selected method:
    - Cash → Cash Drawer
    - GCash → GCash
    - Maya → Maya
    - Bank Transfer → Bank
    - Card → Card Terminal
  - **Amount (₱):** Numeric input defaulting to the remaining balance.
- **Split Payment:**
  - `+ Add Another Payment Method` dashed card allows multiple tenders.
  - Delete trash icon per tender card (disabled when only 1 tender remains).

### 6. Payment Notes & Footer
- **Payment Notes (Optional):** Input field with placeholder: `e.g. Customer paid remaining balance in cash.`
- **Bottom Footer Summary:**
  - Left: `Payment Total: ₱X` and `Remaining After Payment: ₱X` (green when zero, muted/orange when balance remains, red if invalid).
  - Right: `Cancel` and `Record Entry` buttons.
- **Double Payment & Fully-Paid Protection:**
  - If a fully-paid booking is selected, displays: *"This booking is already fully paid. No further payment required."* and disables the Record Entry submission button.
  - Double-submit prevention via submitting state and disabled triggers.

### 7. CF4 Atomic Writer Preservation
- Submitting payments directly invokes `recordOrderPaymentAction(payload)`.
- Calls server-side `recordOrderPayment(...)` which delegates atomically to `post_order_payment_atomic`.
- Zero direct browser writes to `financial_transactions`, `financial_account_movements`, or `financial_order_allocations`.
- Zero fake runtime data (no hardcoded values; real canonical data or truthful empty state).

---

## 4. Verification and Quality Gates

### A. Vitest Cash Flow Test Suite
Command: `pnpm vitest run tests/lib/cash-flow/`
Result: **86 passed across 4 test files** (0 failed).
```
✓ tests/lib/cash-flow/order-payable-contract.test.ts (23 tests)
✓ tests/lib/cash-flow/financial-foundation-contract.test.ts (22 tests)
✓ tests/lib/cash-flow/payment-writer-contract.test.ts (26 tests)
✓ tests/lib/cash-flow/cash-flow-ui.test.tsx (15 tests)
```

### B. TypeScript Typecheck
Command: `pnpm type-check` (`tsc --noEmit`)
Result: **0 errors, exit code 0**.

### C. Targeted ESLint
Command: `pnpm eslint <touched_files>`
Targeted files:
- `src/lib/cash-flow/cash-flow-types.ts`
- `src/lib/cash-flow/cash-flow-queries.ts`
- `src/components/features/cash-flow/record-financial-entry-modal.tsx`
- `src/components/features/cash-flow/record-payment-sheet.tsx`
- `src/components/features/cash-flow/cash-flow-workspace.tsx`
- `tests/lib/cash-flow/cash-flow-ui.test.tsx`
Result: **0 errors, 0 warnings, exit code 0**.

### D. Full Repository ESLint
Command: `pnpm lint`
Result:
- **CF5.1 files introduced 0 new errors and 0 new warnings.**
- Known inherited PWA baseline reported truthfully: 114 problems (88 errors, 26 warnings) in `tests/lib/pwa/*`.

### E. Next.js Production Build
Command: `pnpm build`
Result: **Compiled successfully in 53s**, 149/149 static and dynamic routes generated without error.

### F. Git Diff Check
Command: `git diff --check`
Result: **Clean, exit code 0**.

### G. Live Dev Server Verification
- **Local URL:** `http://localhost:3000/crm/cash-flow` → **HTTP 200 OK**
- **LAN URL:** `http://192.168.137.7:3000/crm/cash-flow` → **HTTP 200 OK**

---

## 5. Scope & Safety Audit

- **Production Database Mutations:** None.
- **Migrations Applied:** None.
- **Backend Schema Changes:** None.
- **Unrelated Booking Tests:** Untouched.
- **Deployment / Push / Merge:** None.

---

## 6. Rollback Plan

If rollback is needed:
```bash
git revert 6e802ebd7232fa282a084857ab7b8179894be0c9
```
This restores the prior sheet implementation cleanly without affecting database state or previous commits.
