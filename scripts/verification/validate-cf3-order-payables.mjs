#!/usr/bin/env node
/**
 * CF3: Order Payables + Financial Allocation Foundation
 * Reproducible Disposable Database Verification Harness
 *
 * Program: CradleHub Web — CONTROLLED STABILIZATION
 * Stage: CF3 — ORDER PAYABLES + FINANCIAL ALLOCATION FOUNDATION
 * Authority: CradleHub_CF1_Financial_Contract_Freeze.md
 *
 * Verifies:
 * - Clean application of CF2 foundation + CF3 migration
 * - Order payable item taxonomy (service, home_service_fee, retail_product, surcharge, discount, manual_adjustment, other_charge)
 * - Strict exclusion of non-payable types (tip, voucher, customer_credit)
 * - Amount sign semantics (charges > 0, discount < 0, adjustment != 0, zero strictly rejected)
 * - Booking relationship & cross-order invariant (booking_id must match order_id)
 * - Two-tier financial order allocation (order-level default vs item-level split)
 * - Allocation invariant (cannot exceed source movement amount)
 * - Double-counting prevention & split-payment attribution
 * - RLS branch read isolation for operational staff (Staff A vs Staff B)
 * - Cross-branch read access for Owner
 * - Denial of direct authenticated writes (INSERT/UPDATE/DELETE)
 * - Derived order payment state (unpaid, partial, paid, overpaid, zero-payable promotional, invalid negative)
 * - Security-invoker view public.v_booking_order_financial_summaries
 * - Foreign key constraints, cascade protection, and atomic transaction rollback
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..', '..');

// ─── Machine Assertion Helpers ────────────────────────────────────────────────

let passedCount = 0;

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      `ASSERTION_FAILED: ${message}\n  Expected: ${JSON.stringify(expected)}\n  Actual:   ${JSON.stringify(actual)}`
    );
  }
}

function assertSuccess(result, message) {
  if (!result.ok) {
    throw new Error(`ASSERTION_FAILED: Expected success for "${message}", but got error:\n${result.error}`);
  }
  passedCount++;
  console.log(`  ✓ ${message}`);
}

function assertFailure(result, expectedPattern, message) {
  if (result.ok) {
    throw new Error(
      `ASSERTION_FAILED: Expected failure for "${message}", but operation succeeded.\nOutput:\n${result.output}`
    );
  }
  if (expectedPattern && !new RegExp(expectedPattern).test(result.error)) {
    throw new Error(
      `ASSERTION_FAILED: Expected error matching "${expectedPattern}" for "${message}", but got:\n${result.error}`
    );
  }
  passedCount++;
  console.log(`  ✓ ${message}`);
}

// ─── Disposable Database Lifecycle ───────────────────────────────────────────

const containerName = process.env.CF3_TEST_CONTAINER || `cf3-test-db-${Date.now()}`;
let spawnedContainer = false;

function runPsql(sql, extraFlags = []) {
  try {
    const flagsStr = extraFlags.length > 0 ? ` ${extraFlags.join(' ')}` : '';
    const res = execSync(
      `docker exec -i ${containerName} psql -v ON_ERROR_STOP=1 -U supabase_admin -d postgres${flagsStr}`,
      {
        input: sql,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 30000,
      }
    );
    return { ok: true, output: res };
  } catch (err) {
    const errText = (err.stderr || '') + '\n' + (err.stdout || '') + '\n' + (err.message || '');
    return { ok: false, error: errText, output: err.stdout };
  }
}

function queryJson(sql, authContext) {
  let authSetup = '';
  if (authContext) {
    authSetup = `
      SET LOCAL ROLE ${authContext.role || 'authenticated'};
      SET LOCAL "request.jwt.claim.sub" = '${authContext.sub}';
      SET LOCAL "request.jwt.claims" = '{"sub": "${authContext.sub}", "role": "${authContext.role || 'authenticated'}"}';
    `;
  }
  const wrappedSql = `
    BEGIN;
    ${authSetup}
    SELECT COALESCE(json_agg(t), '[]'::json) FROM (${sql}) t;
    ROLLBACK;
  `;
  const res = runPsql(wrappedSql, ['-t', '-A', '-q']);
  if (!res.ok) {
    throw new Error(`queryJson failed:\n${res.error}\nSQL:\n${sql}`);
  }
  const output = res.output;
  const startArr = output.indexOf('[');
  const endArr = output.lastIndexOf(']');
  if (startArr !== -1 && endArr !== -1 && endArr >= startArr) {
    return JSON.parse(output.substring(startArr, endArr + 1));
  }
  return JSON.parse(output.trim() || '[]');
}

async function main() {
  console.log('======================================================================');
  console.log('CF3: Order Payables + Financial Allocations — Disposable DB Verifier');
  console.log('Mode: DISPOSABLE MODELED PRE-CF3 SCHEMA VALIDATION');
  console.log('======================================================================\n');
  console.log(`Repository root: ${repoRoot}`);

  const cf2MigrationPath = join(repoRoot, 'supabase', 'migrations', '20260927120000_cf2_financial_foundation.sql');
  const cf3MigrationPath = join(repoRoot, 'supabase', 'migrations', '20260927130000_cf3_order_payables_allocations.sql');

  if (!existsSync(cf2MigrationPath)) {
    throw new Error(`CF2 migration file not found: ${cf2MigrationPath}`);
  }
  if (!existsSync(cf3MigrationPath)) {
    throw new Error(`CF3 migration file not found: ${cf3MigrationPath}`);
  }

  // 1. Ensure Docker container is running
  const checkDocker = runPsql('SELECT 1;');
  if (!checkDocker.ok) {
    console.log(`[1/6] Launching disposable container: ${containerName}...`);
    execSync(
      `docker run -d --name ${containerName} -e POSTGRES_PASSWORD=postgres public.ecr.aws/supabase/postgres:17.6.1.167`,
      { stdio: 'inherit' }
    );
    spawnedContainer = true;

    // Poll until ready and stably past initial entrypoint migration restart
    let consecutiveSuccesses = 0;
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const isRunning = execSync(`docker inspect -f "{{.State.Running}}" ${containerName}`, { encoding: 'utf-8' }).trim();
        if (isRunning !== 'true') continue;
        execSync(`docker exec ${containerName} psql -U supabase_admin -d postgres -c "SELECT 1;"`, { stdio: 'ignore' });
        consecutiveSuccesses++;
        if (consecutiveSuccesses >= 3) break;
      } catch {
        consecutiveSuccesses = 0;
      }
    }
    if (consecutiveSuccesses < 3) {
      throw new Error('Disposable postgres container failed to become stably ready within 40 seconds.');
    }
    console.log('  ✓ Disposable container is ready and stable.');
  } else {
    console.log(`[1/6] Connected to existing disposable container: ${containerName}`);
  }

  // 2. Set up modeled pre-CF3 schema (branches, staff, auth helpers, booking_orders, bookings)
  console.log('\n[2/6] Modeling prerequisite schema (branches, staff, auth helpers, BKG3 booking_orders)...');
  const modeledPrereqSql = `
    DROP SCHEMA IF EXISTS public CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO postgres;
    GRANT ALL ON SCHEMA public TO supabase_admin;
    GRANT ALL ON SCHEMA public TO public;

    CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

    -- Supabase Auth mock
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
      LANGUAGE sql STABLE AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;
    CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
      LANGUAGE sql STABLE AS $$
        SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
      $$;

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN NOINHERIT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN NOINHERIT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN NOINHERIT;
      END IF;
    END $$;

    GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;
    GRANT USAGE ON SCHEMA auth TO authenticated, anon, service_role;

    -- Minimal branches table
    CREATE TABLE IF NOT EXISTS public.branches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Minimal staff table
    CREATE TABLE IF NOT EXISTS public.staff (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      auth_user_id UUID UNIQUE,
      branch_id UUID REFERENCES public.branches(id),
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      role TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Minimal customers table
    CREATE TABLE IF NOT EXISTS public.customers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      full_name TEXT NOT NULL,
      phone TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Minimal services table
    CREATE TABLE IF NOT EXISTS public.services (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      price NUMERIC(12,2) NOT NULL,
      duration_minutes INT NOT NULL DEFAULT 60,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- BKG3 booking_orders table
    CREATE TABLE IF NOT EXISTS public.booking_orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_number TEXT NOT NULL UNIQUE,
      branch_id UUID NOT NULL REFERENCES public.branches(id),
      organizer_customer_id UUID NOT NULL REFERENCES public.customers(id),
      delivery_type TEXT NOT NULL DEFAULT 'in_spa',
      booking_date DATE NOT NULL,
      currency TEXT NOT NULL DEFAULT 'PHP',
      payment_preference TEXT NOT NULL DEFAULT 'pay_at_spa',
      idempotency_key TEXT NOT NULL UNIQUE,
      payload_hash TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- BKG3 bookings table
    CREATE TABLE IF NOT EXISTS public.bookings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      branch_id UUID NOT NULL REFERENCES public.branches(id),
      service_id UUID REFERENCES public.services(id),
      staff_id UUID REFERENCES public.staff(id),
      customer_id UUID REFERENCES public.customers(id),
      order_id UUID REFERENCES public.booking_orders(id),
      attendee_id UUID,
      booking_date DATE NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      status TEXT NOT NULL DEFAULT 'confirmed',
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    GRANT SELECT ON public.branches, public.staff, public.customers, public.services, public.booking_orders, public.bookings TO authenticated, anon, service_role;

    -- Role and Branch Resolution Helpers
    CREATE OR REPLACE FUNCTION public.get_auth_role()
    RETURNS TEXT
    LANGUAGE plpgsql
    STABLE
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
    DECLARE
      v_role TEXT;
    BEGIN
      SELECT s.role INTO v_role
      FROM public.staff s
      WHERE s.auth_user_id = auth.uid()
        AND s.is_active = true
      LIMIT 1;
      RETURN coalesce(v_role, 'anon');
    END;
    $$;

    CREATE OR REPLACE FUNCTION public.get_auth_branch_id()
    RETURNS UUID
    LANGUAGE plpgsql
    STABLE
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
    DECLARE
      v_branch_id UUID;
    BEGIN
      SELECT s.branch_id INTO v_branch_id
      FROM public.staff s
      WHERE s.auth_user_id = auth.uid()
        AND s.is_active = true
      LIMIT 1;
      RETURN v_branch_id;
    END;
    $$;

    GRANT EXECUTE ON FUNCTION public.get_auth_role() TO authenticated, anon, service_role;
    GRANT EXECUTE ON FUNCTION public.get_auth_branch_id() TO authenticated, anon, service_role;
  `;

  const prereqRes = runPsql(modeledPrereqSql);
  if (!prereqRes.ok) {
    throw new Error(`Failed to apply modeled prerequisite schema:\n${prereqRes.error}`);
  }
  console.log('  ✓ Prerequisite schema applied cleanly');

  // 3. Apply CF2 Migration
  console.log('\n[3/6] Applying CF2 migration...');
  const cf2Sql = readFileSync(cf2MigrationPath, 'utf-8');
  const cf2Res = runPsql(cf2Sql);
  if (!cf2Res.ok) {
    throw new Error(`Failed to apply CF2 migration:\n${cf2Res.error}`);
  }
  console.log('  ✓ CF2 migration applied cleanly');

  // 4. Apply CF3 Migration
  console.log('\n[4/6] Applying CF3 migration...');
  const cf3Sql = readFileSync(cf3MigrationPath, 'utf-8');
  const cf3Res = runPsql(cf3Sql);
  if (!cf3Res.ok) {
    throw new Error(`Failed to apply CF3 migration:\n${cf3Res.error}`);
  }
  console.log('  ✓ CF3 migration applied cleanly');

  // 5. Seed Synthetic Fixtures
  console.log('\n[5/6] Seeding deterministic synthetic test fixtures...');
  const seedSql = `
    -- Branches
    INSERT INTO public.branches (id, name, slug) VALUES
      ('11111111-1111-1111-1111-111111111111', 'Branch A', 'branch-a'),
      ('22222222-2222-2222-2222-222222222222', 'Branch B', 'branch-b');

    -- Staff
    INSERT INTO public.staff (id, auth_user_id, branch_id, first_name, last_name, role) VALUES
      ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '10000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Staff', 'A', 'csr'),
      ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '20000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Staff', 'B', 'csr'),
      ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', NULL, 'Owner', 'User', 'owner');

    -- Customers
    INSERT INTO public.customers (id, full_name, phone) VALUES
      ('c1111111-1111-1111-1111-111111111111', 'Customer One', '09170000001'),
      ('c2222222-2222-2222-2222-222222222222', 'Customer Two', '09170000002');

    -- Services
    INSERT INTO public.services (id, name, price, duration_minutes) VALUES
      ('05111111-1111-1111-1111-111111111111', 'Signature Massage', 1200.00, 90),
      ('05222222-2222-2222-2222-222222222222', 'Foot Reflexology', 600.00, 60);

    -- Booking Orders
    INSERT INTO public.booking_orders (id, order_number, branch_id, organizer_customer_id, delivery_type, booking_date, idempotency_key, payload_hash) VALUES
      ('d1111111-1111-1111-1111-111111111111', 'CRD-2609-A111', '11111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'in_spa', '2026-09-27', 'key-a1', 'hash-a1'),
      ('d2222222-1111-1111-1111-111111111111', 'CRD-2609-A222', '11111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'home_service', '2026-09-27', 'key-a2', 'hash-a2'),
      ('dbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'CRD-2609-B111', '22222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222222', 'in_spa', '2026-09-27', 'key-b1', 'hash-b1');

    -- Bookings (service lines)
    INSERT INTO public.bookings (id, branch_id, service_id, staff_id, customer_id, order_id, booking_date, start_time, end_time, status) VALUES
      ('ba111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '05111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', '2026-09-27', '10:00', '11:30', 'confirmed'),
      ('ba122222-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '05222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', '2026-09-27', '11:30', '12:30', 'confirmed'),
      ('bb111111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', '05111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'c2222222-2222-2222-2222-222222222222', 'dbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2026-09-27', '14:00', '15:30', 'confirmed'),
      ('b0111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '05111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', NULL, '2026-04-01', '09:00', '10:30', 'completed');

    -- Financial Accounts
    INSERT INTO public.financial_accounts (id, branch_id, name, account_type, identifier_mask) VALUES
      ('fa111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Branch A Drawer', 'cash_drawer', 'A-Drawer'),
      ('fa122222-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Branch A GCash', 'gcash', '0917-***-1111'),
      ('fb111111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'Branch B Drawer', 'cash_drawer', 'B-Drawer');

    -- Financial Transactions
    INSERT INTO public.financial_transactions (id, branch_id, transaction_type, business_date, occurred_at, recorded_by, idempotency_key) VALUES
      ('0a111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'customer_payment', '2026-09-27', now(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'tx-a1'),
      ('0a222222-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'customer_payment', '2026-09-27', now(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'tx-a2'),
      ('0b111111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'customer_payment', '2026-09-27', now(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'tx-b1');

    -- Financial Movements
    INSERT INTO public.financial_account_movements (id, transaction_id, financial_account_id, amount, payment_method) VALUES
      ('0d111111-1111-1111-1111-111111111111', '0a111111-1111-1111-1111-111111111111', 'fa111111-1111-1111-1111-111111111111', 1200.00, 'cash'),
      ('0d122222-1111-1111-1111-111111111111', '0a222222-1111-1111-1111-111111111111', 'fa122222-1111-1111-1111-111111111111', 500.00, 'gcash'),
      ('0db11111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '0b111111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'fb111111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 800.00, 'cash');
  `;

  const seedRes = runPsql(seedSql);
  if (!seedRes.ok) {
    throw new Error(`Failed to seed synthetic fixtures:\n${seedRes.error}`);
  }
  console.log('  ✓ Synthetic test fixtures seeded successfully');

  // 6. Execute Programmatic Assertions A through AH
  console.log('\n[6/6] Executing programmatic assertions A through AH...');

  const authStaffA = { sub: '10000000-0000-0000-0000-000000000001', role: 'authenticated' };
  const authStaffB = { sub: '20000000-0000-0000-0000-000000000002', role: 'authenticated' };
  const authOwner = { sub: '00000000-0000-0000-0000-000000000001', role: 'authenticated' };

  // [A] CF2 + CF3 migrations applied cleanly
  assertSuccess({ ok: true }, '[A] CF2 foundation + CF3 migration apply cleanly');

  // [B] Expected CF3 tables/views exist
  const tablesCheck = queryJson(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('order_payable_items', 'financial_order_allocations', 'v_booking_order_financial_summaries')
  `);
  assertEqual(tablesCheck.length, 3, '[B] expected CF3 tables/views exist (order_payable_items, financial_order_allocations, v_booking_order_financial_summaries)');
  passedCount++;
  console.log('  ✓ [B] expected CF3 tables and views exist in schema');

  // [C] Normal positive service payable accepted
  const insertServiceRes = runPsql(`
    INSERT INTO public.order_payable_items (
      id, order_id, booking_id, charge_type, description, amount
    ) VALUES (
      '0e111111-1111-1111-1111-111111111111',
      'd1111111-1111-1111-1111-111111111111',
      'ba111111-1111-1111-1111-111111111111',
      'service',
      'Signature Massage',
      1200.00
    );
  `);
  assertSuccess(insertServiceRes, '[C] normal positive service payable accepted');

  // [D] Discount negative amount accepted
  const insertDiscountRes = runPsql(`
    INSERT INTO public.order_payable_items (
      id, order_id, charge_type, description, amount
    ) VALUES (
      '0e122222-1111-1111-1111-111111111111',
      'd1111111-1111-1111-1111-111111111111',
      'discount',
      'Loyalty Discount',
      -200.00
    );
  `);
  assertSuccess(insertDiscountRes, '[D] discount negative amount accepted');

  // [E] Invalid sign/type combinations rejected
  const negativeServiceRes = runPsql(`
    INSERT INTO public.order_payable_items (
      order_id, booking_id, charge_type, description, amount
    ) VALUES (
      'd1111111-1111-1111-1111-111111111111',
      'ba111111-1111-1111-1111-111111111111',
      'service',
      'Invalid Negative Service',
      -500.00
    );
  `);
  assertFailure(negativeServiceRes, 'check', '[E.1] negative service amount rejected');

  const zeroServiceRes = runPsql(`
    INSERT INTO public.order_payable_items (
      order_id, booking_id, charge_type, description, amount
    ) VALUES (
      'd1111111-1111-1111-1111-111111111111',
      'ba111111-1111-1111-1111-111111111111',
      'service',
      'Zero Service',
      0.00
    );
  `);
  assertFailure(zeroServiceRes, 'check', '[E.2] zero service amount rejected');

  const positiveDiscountRes = runPsql(`
    INSERT INTO public.order_payable_items (
      order_id, charge_type, description, amount
    ) VALUES (
      'd1111111-1111-1111-1111-111111111111',
      'discount',
      'Invalid Positive Discount',
      200.00
    );
  `);
  assertFailure(positiveDiscountRes, 'check', '[E.3] positive discount amount rejected');

  // [F] Service payable references valid booking/order
  const serviceWithoutBookingRes = runPsql(`
    INSERT INTO public.order_payable_items (
      order_id, charge_type, description, amount
    ) VALUES (
      'd1111111-1111-1111-1111-111111111111',
      'service',
      'Service Missing Booking',
      500.00
    );
  `);
  assertFailure(serviceWithoutBookingRes, 'SERVICE_PAYABLE_REQUIRES_BOOKING', '[F] service payable requires valid booking_id');

  // [G] Cross-order booking/payable mismatch rejected
  const crossOrderBookingRes = runPsql(`
    INSERT INTO public.order_payable_items (
      order_id, booking_id, charge_type, description, amount
    ) VALUES (
      'dbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', -- Order B1
      'ba111111-1111-1111-1111-111111111111', -- Booking A1 (belongs to Order A1!)
      'service',
      'Cross Order Booking',
      500.00
    );
  `);
  assertFailure(crossOrderBookingRes, 'CROSS_ORDER_BOOKING_MISMATCH', '[G] cross-order booking/payable mismatch rejected');

  // [H] Home Service fee accepted as payable
  const insertHsFeeRes = runPsql(`
    INSERT INTO public.order_payable_items (
      id, order_id, charge_type, description, amount
    ) VALUES (
      '0e211111-1111-1111-1111-111111111111',
      'd2222222-1111-1111-1111-111111111111',
      'home_service_fee',
      'Home Service Travel Charge',
      300.00
    );
  `);
  assertSuccess(insertHsFeeRes, '[H] Home Service fee accepted as payable');

  // [I] Tip payable type rejected
  const insertTipRes = runPsql(`
    INSERT INTO public.order_payable_items (
      order_id, charge_type, description, amount
    ) VALUES (
      'd1111111-1111-1111-1111-111111111111',
      'tip',
      'Therapist Tip',
      100.00
    );
  `);
  assertFailure(insertTipRes, 'check', '[I] tip payable type rejected');

  // [J] Voucher payable type rejected
  const insertVoucherRes = runPsql(`
    INSERT INTO public.order_payable_items (
      order_id, charge_type, description, amount
    ) VALUES (
      'd1111111-1111-1111-1111-111111111111',
      'voucher',
      'Gift Voucher',
      500.00
    );
  `);
  assertFailure(insertVoucherRes, 'check', '[J] voucher payable type rejected');

  // [K] Customer credit payable type rejected
  const insertCreditRes = runPsql(`
    INSERT INTO public.order_payable_items (
      order_id, charge_type, description, amount
    ) VALUES (
      'd1111111-1111-1111-1111-111111111111',
      'customer_credit',
      'Credit Application',
      300.00
    );
  `);
  assertFailure(insertCreditRes, 'check', '[K] customer_credit payable type rejected');

  // [L] Historical booking without order is not automatically backfilled
  const historicalPayableCheck = queryJson(`
    SELECT count(*) as count FROM public.order_payable_items
    WHERE booking_id = 'b0111111-1111-1111-1111-111111111111'
  `);
  assertEqual(Number(historicalPayableCheck[0].count), 0, '[L] historical booking without order is not automatically backfilled');
  passedCount++;
  console.log('  ✓ [L] historical bookings without order_id have zero backfilled payable items');

  // [M] Valid order-level allocation accepted under privileged test context
  const orderAllocRes = runPsql(`
    INSERT INTO public.financial_order_allocations (
      id, financial_account_movement_id, order_id, payable_item_id, amount
    ) VALUES (
      '0f111111-1111-1111-1111-111111111111',
      '0d111111-1111-1111-1111-111111111111',
      'd1111111-1111-1111-1111-111111111111',
      NULL,
      600.00
    );
  `);
  assertSuccess(orderAllocRes, '[M] valid order-level allocation accepted under privileged test context');

  // [N] Valid item-level allocation accepted
  const itemAllocRes = runPsql(`
    INSERT INTO public.financial_order_allocations (
      id, financial_account_movement_id, order_id, payable_item_id, amount
    ) VALUES (
      '0f122222-1111-1111-1111-111111111111',
      '0d111111-1111-1111-1111-111111111111',
      'd1111111-1111-1111-1111-111111111111',
      '0e111111-1111-1111-1111-111111111111',
      400.00
    );
  `);
  assertSuccess(itemAllocRes, '[N] valid item-level allocation accepted');

  // [O] Item belongs to same order invariant
  const crossOrderItemAllocRes = runPsql(`
    INSERT INTO public.financial_order_allocations (
      financial_account_movement_id, order_id, payable_item_id, amount
    ) VALUES (
      '0db11111-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      'dbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', -- Order B1
      '0e111111-1111-1111-1111-111111111111', -- Payable Item A1!
      300.00
    );
  `);
  assertFailure(crossOrderItemAllocRes, 'CROSS_ORDER_ITEM_MISMATCH', '[O] item belongs to same order invariant enforced');

  // [P] Invalid movement FK rejected
  const invalidMovementAllocRes = runPsql(`
    INSERT INTO public.financial_order_allocations (
      financial_account_movement_id, order_id, amount
    ) VALUES (
      'ffffffff-ffff-ffff-ffff-ffffffffffff',
      'd1111111-1111-1111-1111-111111111111',
      100.00
    );
  `);
  assertFailure(invalidMovementAllocRes, 'ALLOCATION_INVALID_MOVEMENT|23503|foreign key', '[P] invalid movement FK rejected');

  // [Q] Invalid payable FK rejected
  const invalidPayableAllocRes = runPsql(`
    INSERT INTO public.financial_order_allocations (
      financial_account_movement_id, order_id, payable_item_id, amount
    ) VALUES (
      '0d111111-1111-1111-1111-111111111111',
      'd1111111-1111-1111-1111-111111111111',
      'ffffffff-ffff-ffff-ffff-ffffffffffff',
      100.00
    );
  `);
  assertFailure(invalidPayableAllocRes, 'ALLOCATION_INVALID_PAYABLE|23503|foreign key', '[Q] invalid payable FK rejected');

  // [R] Allocation amount zero rejected
  const zeroAllocRes = runPsql(`
    INSERT INTO public.financial_order_allocations (
      financial_account_movement_id, order_id, amount
    ) VALUES (
      '0d111111-1111-1111-1111-111111111111',
      'd1111111-1111-1111-1111-111111111111',
      0.00
    );
  `);
  assertFailure(zeroAllocRes, 'check', '[R] allocation amount zero rejected');

  // [S] Allocation exceeding source movement rejected
  // mov A1 has 1200 total; already allocated 600 + 400 = 1000. Adding 300 exceeds 1200!
  const exceedMovementAllocRes = runPsql(`
    INSERT INTO public.financial_order_allocations (
      financial_account_movement_id, order_id, amount
    ) VALUES (
      '0d111111-1111-1111-1111-111111111111',
      'd1111111-1111-1111-1111-111111111111',
      300.00
    );
  `);
  assertFailure(exceedMovementAllocRes, 'ALLOCATION_EXCEEDS_MOVEMENT', '[S] allocation exceeding source movement rejected by trigger');

  // Seed a Branch B payable item and allocation for RLS isolation tests
  runPsql(`
    INSERT INTO public.order_payable_items (
      id, order_id, booking_id, charge_type, description, amount
    ) VALUES (
      '0eb11111-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      'dbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      'bb111111-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      'service',
      'Branch B Service',
      800.00
    );
    INSERT INTO public.financial_order_allocations (
      id, financial_account_movement_id, order_id, amount
    ) VALUES (
      '0fb11111-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      '0db11111-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      'dbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      800.00
    );
  `);

  // [T] Branch read isolation (Staff A vs Staff B)
  const staffAPayables = queryJson(`SELECT * FROM public.order_payable_items`, authStaffA);
  const staffBPayables = queryJson(`SELECT * FROM public.order_payable_items`, authStaffB);
  assertEqual(staffAPayables.length, 3, '[T.1] Staff A sees only Branch A payables (3 items: 2 in Order A1, 1 in Order A2)');
  assertEqual(staffBPayables.length, 1, '[T.2] Staff B sees only Branch B payables (1 item in Order B1)');

  const staffAAllocations = queryJson(`SELECT * FROM public.financial_order_allocations`, authStaffA);
  const staffBAllocations = queryJson(`SELECT * FROM public.financial_order_allocations`, authStaffB);
  assertEqual(staffAAllocations.length, 2, '[T.3] Staff A sees only Branch A allocations');
  assertEqual(staffBAllocations.length, 1, '[T.4] Staff B sees only Branch B allocations');
  passedCount++;
  console.log('  ✓ [T] branch read isolation verified for payables and allocations');

  // [U] Owner cross-branch authorized read
  const ownerPayables = queryJson(`SELECT * FROM public.order_payable_items`, authOwner);
  const ownerAllocations = queryJson(`SELECT * FROM public.financial_order_allocations`, authOwner);
  assertEqual(ownerPayables.length, 4, '[U.1] Owner sees payables across all branches (4 items total)');
  assertEqual(ownerAllocations.length, 3, '[U.2] Owner sees allocations across all branches (3 items total)');
  passedCount++;
  console.log('  ✓ [U] owner cross-branch authorized read verified');

  // [V] Direct authenticated payable INSERT rejected
  const staffDirectPayableInsert = runPsql(`
    BEGIN;
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" = '${authStaffA.sub}';
    INSERT INTO public.order_payable_items (
      order_id, charge_type, description, amount
    ) VALUES (
      'd1111111-1111-1111-1111-111111111111',
      'other_charge',
      'Direct Auth Payable',
      150.00
    );
    COMMIT;
  `);
  assertFailure(staffDirectPayableInsert, 'permission denied', '[V] direct authenticated payable INSERT rejected');

  // [W] Direct authenticated allocation INSERT rejected
  const staffDirectAllocInsert = runPsql(`
    BEGIN;
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" = '${authStaffA.sub}';
    INSERT INTO public.financial_order_allocations (
      financial_account_movement_id, order_id, amount
    ) VALUES (
      '0d111111-1111-1111-1111-111111111111',
      'd1111111-1111-1111-1111-111111111111',
      100.00
    );
    COMMIT;
  `);
  assertFailure(staffDirectAllocInsert, 'permission denied', '[W] direct authenticated allocation INSERT rejected');

  // [X] Allocation UPDATE rejected
  const allocUpdateRes = runPsql(`
    UPDATE public.financial_order_allocations
    SET amount = 999.00
    WHERE id = '0f111111-1111-1111-1111-111111111111';
  `);
  assertFailure(allocUpdateRes, 'FINANCIAL_ALLOCATION_IMMUTABILITY_VIOLATION', '[X] allocation UPDATE rejected by immutability trigger');

  // [Y] Allocation DELETE rejected
  const allocDeleteRes = runPsql(`
    DELETE FROM public.financial_order_allocations
    WHERE id = '0f111111-1111-1111-1111-111111111111';
  `);
  assertFailure(allocDeleteRes, 'FINANCIAL_ALLOCATION_IMMUTABILITY_VIOLATION', '[Y] allocation DELETE rejected by immutability trigger');

  // [Z] Referenced payable destructive delete rejected
  const payableDeleteRes = runPsql(`
    DELETE FROM public.order_payable_items
    WHERE id = '0e111111-1111-1111-1111-111111111111';
  `);
  assertFailure(payableDeleteRes, 'foreign key|23503', '[Z] referenced payable destructive delete rejected by foreign key constraint');

  // [AA] Split-payment attribution preserved across two movements
  const splitMovAllocRes = runPsql(`
    INSERT INTO public.financial_order_allocations (
      id, financial_account_movement_id, order_id, amount
    ) VALUES (
      '0f133333-1111-1111-1111-111111111111',
      '0d122222-1111-1111-1111-111111111111', -- GCash movement
      'd1111111-1111-1111-1111-111111111111',
      200.00
    );
  `);
  assertSuccess(splitMovAllocRes, '[AA.1] second movement (GCash) allocated to Order A1');

  const orderA1Allocations = queryJson(`
    SELECT fam.payment_method, foa.amount
    FROM public.financial_order_allocations foa
    JOIN public.financial_account_movements fam ON fam.id = foa.financial_account_movement_id
    WHERE foa.order_id = 'd1111111-1111-1111-1111-111111111111'
    ORDER BY foa.created_at
  `);
  assertEqual(orderA1Allocations.length, 3, '[AA.2] Order A1 has 3 distinct allocations');
  const cashTotal = orderA1Allocations.filter(a => a.payment_method === 'cash').reduce((sum, a) => sum + Number(a.amount), 0);
  const gcashTotal = orderA1Allocations.filter(a => a.payment_method === 'gcash').reduce((sum, a) => sum + Number(a.amount), 0);
  assertEqual(cashTotal, 1000, '[AA.3] Cash payment attribution preserved');
  assertEqual(gcashTotal, 200, '[AA.4] GCash payment attribution preserved');
  passedCount++;
  console.log('  ✓ [AA] split-payment attribution preserved across two movements');

  // [AB] Order-level allocation cannot double-count with item allocation
  const summaryA1 = queryJson(`
    SELECT * FROM public.v_booking_order_financial_summaries
    WHERE order_id = 'd1111111-1111-1111-1111-111111111111'
  `)[0];
  assertEqual(Number(summaryA1.total_payable), 1000, '[AB.1] Order A1 total payable is 1000');
  assertEqual(Number(summaryA1.net_allocated), 1200, '[AB.2] Order A1 net allocated is exactly 1200');
  assertEqual(summaryA1.payment_state, 'overpaid', '[AB.3] Derived payment state is overpaid');
  passedCount++;
  console.log('  ✓ [AB] order-level allocation cannot double-count with item allocation');

  // [AC] Derived unpaid
  const summaryA2 = queryJson(`
    SELECT * FROM public.v_booking_order_financial_summaries
    WHERE order_id = 'd2222222-1111-1111-1111-111111111111'
  `)[0];
  assertEqual(Number(summaryA2.total_payable), 300, '[AC.1] Order A2 total payable is 300');
  assertEqual(Number(summaryA2.net_allocated), 0, '[AC.2] Order A2 net allocated is 0');
  assertEqual(summaryA2.payment_state, 'unpaid', '[AC.3] Order A2 payment state is unpaid');
  passedCount++;
  console.log('  ✓ [AC] derived payment state unpaid verified');

  // [AD] Derived partial
  runPsql(`
    INSERT INTO public.financial_order_allocations (
      id, financial_account_movement_id, order_id, amount
    ) VALUES (
      '0f211111-1111-1111-1111-111111111111',
      '0d122222-1111-1111-1111-111111111111', -- remaining 300 in GCash movement
      'd2222222-1111-1111-1111-111111111111',
      150.00
    );
  `);
  const summaryA2Partial = queryJson(`
    SELECT * FROM public.v_booking_order_financial_summaries
    WHERE order_id = 'd2222222-1111-1111-1111-111111111111'
  `)[0];
  assertEqual(summaryA2Partial.payment_state, 'partial', '[AD] derived payment state partial verified');
  passedCount++;
  console.log('  ✓ [AD] derived payment state partial verified');

  // [AE] Derived paid
  const summaryB1 = queryJson(`
    SELECT * FROM public.v_booking_order_financial_summaries
    WHERE order_id = 'dbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  `)[0];
  assertEqual(Number(summaryB1.total_payable), 800, '[AE.1] Order B1 total payable is 800');
  assertEqual(Number(summaryB1.net_allocated), 800, '[AE.2] Order B1 net allocated is 800');
  assertEqual(summaryB1.payment_state, 'paid', '[AE.3] Order B1 payment state is paid');
  passedCount++;
  console.log('  ✓ [AE] derived payment state paid verified');

  // [AF] Derived overpaid
  assertEqual(summaryA1.payment_state, 'overpaid', '[AF] derived payment state overpaid verified');
  passedCount++;
  console.log('  ✓ [AF] derived payment state overpaid verified');

  // [AG] Zero-payable promotional order & invalid net-negative behavior
  const pureDerivedChecks = queryJson(`
    SELECT
      public.derive_order_payment_state(0.00, 0.00) AS zero_paid,
      public.derive_order_payment_state(0.00, 100.00) AS zero_overpaid,
      public.derive_order_payment_state(-50.00, 0.00) AS invalid_negative,
      public.derive_order_payment_state(1000.00, 0.00) AS regular_unpaid,
      public.derive_order_payment_state(1000.00, 500.00) AS regular_partial,
      public.derive_order_payment_state(1000.00, 1000.00) AS regular_paid,
      public.derive_order_payment_state(1000.00, 1200.00) AS regular_overpaid
  `)[0];
  assertEqual(pureDerivedChecks.zero_paid, 'paid', '[AG.1] promotional zero-payable with 0 allocated derives paid');
  assertEqual(pureDerivedChecks.zero_overpaid, 'overpaid', '[AG.2] promotional zero-payable with >0 allocated derives overpaid');
  assertEqual(pureDerivedChecks.invalid_negative, 'invalid_negative_payable', '[AG.3] net-negative payable derives invalid_negative_payable');
  passedCount++;
  console.log('  ✓ [AG] zero-payable and net-negative edge case behaviors verified');

  // [AH] Transaction rollback leaves no partial CF3 records
  runPsql(`
    BEGIN;
    INSERT INTO public.order_payable_items (
      order_id, charge_type, description, amount
    ) VALUES (
      'd1111111-1111-1111-1111-111111111111',
      'other_charge',
      'Rollback Test Item',
      999.00
    );
    INSERT INTO public.financial_order_allocations (
      financial_account_movement_id, order_id, amount
    ) VALUES (
      '0d122222-1111-1111-1111-111111111111',
      'd1111111-1111-1111-1111-111111111111',
      50.00
    );
    ROLLBACK;
  `);
  const rollbackPayableCheck = queryJson(`
    SELECT count(*) as count FROM public.order_payable_items WHERE description = 'Rollback Test Item'
  `);
  assertEqual(Number(rollbackPayableCheck[0].count), 0, '[AH.1] rollback leaves no partial order_payable_items');

  const rollbackAllocCheck = queryJson(`
    SELECT count(*) as count FROM public.financial_order_allocations WHERE amount = 50.00
  `);
  assertEqual(Number(rollbackAllocCheck[0].count), 0, '[AH.2] rollback leaves no partial financial_order_allocations');
  passedCount++;
  console.log('  ✓ [AH] transaction rollback leaves no partial CF3 records');

  console.log('\n======================================================================');
  console.log(`ALL CF3 DATABASE ASSERTIONS PASSED (${passedCount} checks passed)`);
  console.log('======================================================================\n');
}

try {
  await main();
} catch (err) {
  console.error('\n❌ VERIFICATION HARNESS ERROR:');
  console.error(err.message || err);
  process.exit(1);
} finally {
  if (spawnedContainer) {
    try {
      execSync(`docker stop ${containerName}`, { stdio: 'pipe' });
      execSync(`docker rm ${containerName}`, { stdio: 'pipe' });
      console.log(`Disposable container ${containerName} stopped and removed.`);
    } catch {
      // Ignore cleanup error
    }
  }
}
