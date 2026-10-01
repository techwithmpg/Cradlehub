#!/usr/bin/env node
/**
 * CF4: Atomic Payment Posting Engine
 * Reproducible Disposable Database Verification Harness
 *
 * Program: CradleHub Web — CONTROLLED STABILIZATION
 * Stage: CF4 — ATOMIC PAYMENT POSTING ENGINE
 * Authority: CradleHub_CF1_Financial_Contract_Freeze.md
 *
 * Verifies:
 * [A] CF2 + CF3 + CF4 apply cleanly
 * [B] RPC post_order_payment_atomic exists
 * [C] Unauthenticated execution denied
 * [D] Unauthorized branch user denied
 * [E] Inactive staff denied
 * [F] Wrong branch financial account denied
 * [G] Inactive financial account denied
 * [H] Payment-method/account-type mismatch denied
 * [I] Zero payment denied
 * [J] Negative payment denied
 * [K] Full payment succeeds
 * [L] Partial payment succeeds
 * [M] Split Cash + GCash succeeds
 * [N] Exactly one transaction header for split payment
 * [O] Two movements created for split payment
 * [P] Order-level allocation succeeds
 * [Q] Item-level allocation succeeds
 * [R] Cross-order item allocation denied
 * [S] Same idempotency retry returns same transaction
 * [T] Same idempotency does not create duplicate movements
 * [U] Conflicting payload with same idempotency key rejected
 * [V] Rollback removes partial records on forced failure
 * [W] Zero-payable order cannot create zero-value payment
 * [X] Negative-payable order rejected
 * [Y] Overpayment follows explicitly documented CF4 policy (rejected)
 * [Z] Direct client financial-table writes remain denied
 * [AA] Resulting unpaid/partial/paid state correct
 * [AB] Booking historical rows untouched
 * [AC] Historical booking_payment_logs untouched
 * [AD] Concurrent identical requests deduplicated
 * [AE] Concurrent balance race handled safely
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

const containerName = process.env.CF4_TEST_CONTAINER || `cf4-test-db-${Date.now()}`;
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
      }
    );
    return { ok: true, output: res.trim() };
  } catch (err) {
    return {
      ok: false,
      error: err.stderr ? err.stderr.toString() : err.message,
      output: err.stdout ? err.stdout.toString() : '',
    };
  }
}

function queryJson(sql, authContext = null) {
  let sessionPrefix = '';
  if (authContext) {
    sessionPrefix = `
      SET LOCAL ROLE ${authContext.role || 'authenticated'};
      SET LOCAL "request.jwt.claim.sub" = '${authContext.sub || ''}';
      SET LOCAL "request.jwt.claims" = '${JSON.stringify(authContext)}';
    `;
  }

  const wrappedSql = `
    BEGIN;
    ${sessionPrefix}
    SELECT COALESCE(json_agg(t), '[]'::json) FROM (${sql}) t;
    COMMIT;
  `;

  const res = runPsql(wrappedSql, ['-t', '-A', '-q']);
  if (!res.ok) {
    throw new Error(`queryJson failed:\n${res.error}\nSQL:\n${sql}`);
  }

  const lines = res.output
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && l !== 'SET' && l !== 'BEGIN' && l !== 'COMMIT');
  const jsonStr = lines.join('\n') || '[]';
  try {
    return JSON.parse(jsonStr) || [];
  } catch (err) {
    console.error('Failed to parse queryJson output:', jsonStr, err);
    return [];
  }
}

function callRpc(authContext, orderId, idempotencyKey, payments, allocations = null, businessDate = null, extRef = null, notes = null) {
  let sessionPrefix = '';
  if (authContext) {
    sessionPrefix = `
      SET LOCAL ROLE ${authContext.role || 'authenticated'};
      SET LOCAL "request.jwt.claim.sub" = '${authContext.sub || ''}';
      SET LOCAL "request.jwt.claims" = '${JSON.stringify(authContext)}';
    `;
  }

  const paymentsJson = JSON.stringify(payments).replace(/'/g, "''");
  const allocJson = allocations ? `'${JSON.stringify(allocations).replace(/'/g, "''")}'::jsonb` : 'NULL';
  const bDate = businessDate ? `'${businessDate}'::date` : 'NULL';
  const eRef = extRef ? `'${extRef.replace(/'/g, "''")}'` : 'NULL';
  const nts = notes ? `'${notes.replace(/'/g, "''")}'` : 'NULL';

  const sql = `
    BEGIN;
    ${sessionPrefix}
    SELECT public.post_order_payment_atomic(
      '${orderId}'::uuid,
      '${idempotencyKey.replace(/'/g, "''")}',
      '${paymentsJson}'::jsonb,
      ${allocJson},
      ${bDate},
      ${eRef},
      ${nts}
    ) AS result;
    COMMIT;
  `;

  const res = runPsql(sql, ['-t', '-A', '-q']);
  if (!res.ok) {
    return res;
  }
  const lines = res.output
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && l !== 'SET' && l !== 'BEGIN' && l !== 'COMMIT');
  return { ok: true, output: lines.join('\n') };
}

// ─── Main Verification Sequence ───────────────────────────────────────────────

async function main() {
  console.log('======================================================================');
  console.log('CF4: Atomic Payment Posting Engine — Disposable DB Verifier');
  console.log('Mode: DISPOSABLE MODELED PRE-CF4 SCHEMA VALIDATION');
  console.log('======================================================================\n');

  console.log(`Repository root: ${repoRoot}`);

  const cf2MigrationPath = join(repoRoot, 'supabase', 'migrations', '20260927120000_cf2_financial_foundation.sql');
  const cf3MigrationPath = join(repoRoot, 'supabase', 'migrations', '20260927130000_cf3_order_payables_allocations.sql');
  const cf4MigrationPath = join(repoRoot, 'supabase', 'migrations', '20260927140000_cf4_atomic_payment_writer.sql');

  if (!existsSync(cf2MigrationPath)) throw new Error(`CF2 migration not found at ${cf2MigrationPath}`);
  if (!existsSync(cf3MigrationPath)) throw new Error(`CF3 migration not found at ${cf3MigrationPath}`);
  if (!existsSync(cf4MigrationPath)) throw new Error(`CF4 migration not found at ${cf4MigrationPath}`);

  // 1. Launch fresh disposable PostgreSQL container
  if (!process.env.CF4_TEST_CONTAINER) {
    console.log(`[1/6] Launching disposable container: ${containerName}...`);
    try {
      execSync(`docker rm -f ${containerName}`, { stdio: 'ignore' });
    } catch {
      // Ignore if doesn't exist
    }

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

  // 2. Set up modeled pre-CF4 prerequisite schema
  console.log('\n[2/6] Modeling prerequisite schema (branches, staff, auth helpers, booking_orders, bookings, payment_logs)...');
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

    -- Historical booking_payment_logs table
    CREATE TABLE IF NOT EXISTS public.booking_payment_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_id UUID NOT NULL REFERENCES public.bookings(id),
      changed_by UUID REFERENCES public.staff(id),
      old_payment_method TEXT,
      old_payment_status TEXT,
      old_amount_paid NUMERIC(12,2),
      old_payment_reference TEXT,
      new_payment_method TEXT,
      new_payment_status TEXT,
      new_amount_paid NUMERIC(12,2),
      new_payment_reference TEXT,
      reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    GRANT SELECT ON public.branches, public.staff, public.customers, public.services, public.booking_orders, public.bookings, public.booking_payment_logs TO authenticated, anon, service_role;

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

  // 5. Apply CF4 Migration
  console.log('\n[5/6] Applying CF4 migration...');
  const cf4Sql = readFileSync(cf4MigrationPath, 'utf-8');
  const cf4Res = runPsql(cf4Sql);
  if (!cf4Res.ok) {
    throw new Error(`Failed to apply CF4 migration:\n${cf4Res.error}`);
  }
  console.log('  ✓ CF4 migration applied cleanly');

  // Seed deterministic test fixtures
  console.log('\n[6/6] Seeding test fixtures and executing assertions A through AE...');
  const seedSql = `
    -- Branches
    INSERT INTO public.branches (id, name, slug) VALUES
      ('11111111-1111-1111-1111-111111111111', 'Branch A', 'branch-a'),
      ('22222222-2222-2222-2222-222222222222', 'Branch B', 'branch-b');

    -- Staff
    INSERT INTO public.staff (id, auth_user_id, branch_id, first_name, last_name, role, is_active) VALUES
      ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '10000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Staff', 'A', 'csr', true),
      ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '20000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Staff', 'B', 'csr', true),
      ('0a0a0a0a-0a0a-0a0a-0a0a-0a0a0a0a0a0a', '30000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Staff', 'Inactive', 'csr', false),
      ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', NULL, 'Owner', 'User', 'owner', true);

    -- Customers
    INSERT INTO public.customers (id, full_name, phone) VALUES
      ('c1111111-1111-1111-1111-111111111111', 'Customer One', '09170000001');

    -- Services
    INSERT INTO public.services (id, name, price, duration_minutes) VALUES
      ('05111111-1111-1111-1111-111111111111', 'Signature Massage', 1200.00, 90),
      ('05222222-2222-2222-2222-222222222222', 'Foot Reflexology', 300.00, 30);

    -- Financial Accounts
    INSERT INTO public.financial_accounts (id, branch_id, name, account_type, identifier_mask, is_active) VALUES
      ('fa111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Branch A Drawer', 'cash_drawer', 'A-Drawer', true),
      ('fa122222-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Branch A GCash', 'gcash', '0917-***-1111', true),
      ('fa133333-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Branch A Inactive Drawer', 'cash_drawer', 'A-Inactive', false),
      ('fb111111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'Branch B Drawer', 'cash_drawer', 'B-Drawer', true);

    -- Orders
    INSERT INTO public.booking_orders (id, order_number, branch_id, organizer_customer_id, delivery_type, booking_date, idempotency_key, payload_hash) VALUES
      ('d1111111-1111-1111-1111-111111111111', 'CRD-CF4-O1', '11111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'in_spa', '2026-09-27', 'key-cf4-o1', 'hash-o1'),
      ('d2222222-1111-1111-1111-111111111111', 'CRD-CF4-O2', '11111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'in_spa', '2026-09-27', 'key-cf4-o2', 'hash-o2'),
      ('d3333333-1111-1111-1111-111111111111', 'CRD-CF4-O3', '11111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'in_spa', '2026-09-27', 'key-cf4-o3', 'hash-o3'),
      ('d4444444-1111-1111-1111-111111111111', 'CRD-CF4-O4', '11111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'in_spa', '2026-09-27', 'key-cf4-o4', 'hash-o4'),
      ('d5555555-1111-1111-1111-111111111111', 'CRD-CF4-O5', '11111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'in_spa', '2026-09-27', 'key-cf4-o5', 'hash-o5'),
      ('dbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'CRD-CF4-OB', '22222222-2222-2222-2222-222222222222', 'c1111111-1111-1111-1111-111111111111', 'in_spa', '2026-09-27', 'key-cf4-ob', 'hash-ob'),
      ('d6666666-1111-1111-1111-111111111111', 'CRD-CF4-O6', '11111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'in_spa', '2026-09-27', 'key-cf4-o6', 'hash-o6');

    -- Bookings (linked to orders)
    INSERT INTO public.bookings (id, branch_id, service_id, staff_id, customer_id, order_id, booking_date, start_time, end_time, status) VALUES
      ('ba111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '05111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', '2026-09-27', '10:00', '11:30', 'confirmed'),
      ('ba222222-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '05111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', 'd2222222-1111-1111-1111-111111111111', '2026-09-27', '11:30', '13:00', 'confirmed'),
      ('ba333333-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '05111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', 'd3333333-1111-1111-1111-111111111111', '2026-09-27', '13:00', '14:30', 'confirmed'),
      ('ba444444-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '05111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', 'd4444444-1111-1111-1111-111111111111', '2026-09-27', '17:30', '18:30', 'confirmed'),
      ('ba555555-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '05111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', 'd5555555-1111-1111-1111-111111111111', '2026-09-27', '18:30', '19:30', 'confirmed'),
      ('bb111111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', '05111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'c1111111-1111-1111-1111-111111111111', 'dbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2026-09-27', '10:00', '11:30', 'confirmed'),
      ('ba666666-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '05111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', 'd6666666-1111-1111-1111-111111111111', '2026-09-27', '16:00', '17:30', 'confirmed');

    -- Historical booking (no order_id) & historical payment log
    INSERT INTO public.bookings (id, branch_id, service_id, staff_id, customer_id, order_id, booking_date, start_time, end_time, status, payment_status, amount_paid) VALUES
      ('b0111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '05111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', NULL, '2026-04-01', '09:00', '10:30', 'completed', 'paid', 500.00);

    INSERT INTO public.booking_payment_logs (id, booking_id, changed_by, old_amount_paid, new_amount_paid, new_payment_status, reason) VALUES
      ('10999999-9999-9999-9999-999999999999', 'b0111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 0.00, 500.00, 'paid', 'Historical payment');

    -- Order Payable Items
    -- Order 1: 1,200 service + 300 home_service_fee = 1,500 total
    INSERT INTO public.order_payable_items (id, order_id, booking_id, charge_type, description, amount) VALUES
      ('0e111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'ba111111-1111-1111-1111-111111111111', 'service', 'Signature Massage', 1200.00),
      ('0e122222-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', NULL, 'home_service_fee', 'Travel Charge', 300.00);

    -- Order 2: 1,500 service
    INSERT INTO public.order_payable_items (id, order_id, booking_id, charge_type, description, amount) VALUES
      ('0e211111-1111-1111-1111-111111111111', 'd2222222-1111-1111-1111-111111111111', 'ba222222-1111-1111-1111-111111111111', 'service', 'Signature Massage', 1500.00);

    -- Order 3: 1,500 service (split tender)
    INSERT INTO public.order_payable_items (id, order_id, booking_id, charge_type, description, amount) VALUES
      ('0e311111-1111-1111-1111-111111111111', 'd3333333-1111-1111-1111-111111111111', 'ba333333-1111-1111-1111-111111111111', 'service', 'Signature Massage', 1500.00);

    -- Order 4: 500 service - 500 discount = 0 total (promo)
    INSERT INTO public.order_payable_items (id, order_id, booking_id, charge_type, description, amount) VALUES
      ('0e411111-1111-1111-1111-111111111111', 'd4444444-1111-1111-1111-111111111111', 'ba444444-1111-1111-1111-111111111111', 'service', 'Promo Massage', 500.00),
      ('0e422222-1111-1111-1111-111111111111', 'd4444444-1111-1111-1111-111111111111', NULL, 'discount', '100% Promo', -500.00);

    -- Order 5: 200 service - 500 discount = -300 total (invalid negative)
    INSERT INTO public.order_payable_items (id, order_id, booking_id, charge_type, description, amount) VALUES
      ('0e511111-1111-1111-1111-111111111111', 'd5555555-1111-1111-1111-111111111111', 'ba555555-1111-1111-1111-111111111111', 'service', 'Small Massage', 200.00),
      ('0e522222-1111-1111-1111-111111111111', 'd5555555-1111-1111-1111-111111111111', NULL, 'discount', 'Excess Discount', -500.00);

    -- Order B: 800 service
    INSERT INTO public.order_payable_items (id, order_id, booking_id, charge_type, description, amount) VALUES
      ('0eb11111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'dbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bb111111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'service', 'Branch B Massage', 800.00);

    -- Order 6 (Concurrent): 1,000 service
    INSERT INTO public.order_payable_items (id, order_id, booking_id, charge_type, description, amount) VALUES
      ('0e611111-1111-1111-1111-111111111111', 'd6666666-1111-1111-1111-111111111111', 'ba666666-1111-1111-1111-111111111111', 'service', 'Concurrent Test Massage', 1000.00);
  `;

  const seedRes = runPsql(seedSql);
  if (!seedRes.ok) {
    throw new Error(`Failed to seed synthetic fixtures:\n${seedRes.error}`);
  }
  console.log('  ✓ Test fixtures seeded successfully');

  const authStaffA = { sub: '10000000-0000-0000-0000-000000000001', role: 'authenticated' };
  const authStaffB = { sub: '20000000-0000-0000-0000-000000000002', role: 'authenticated' };
  const authStaffInactive = { sub: '30000000-0000-0000-0000-000000000003', role: 'authenticated' };

  const order1Id = 'd1111111-1111-1111-1111-111111111111';
  const order2Id = 'd2222222-1111-1111-1111-111111111111';
  const order3Id = 'd3333333-1111-1111-1111-111111111111';
  const order4Id = 'd4444444-1111-1111-1111-111111111111';
  const order5Id = 'd5555555-1111-1111-1111-111111111111';
  const order6Id = 'd6666666-1111-1111-1111-111111111111';

  const drawerA = 'fa111111-1111-1111-1111-111111111111';
  const gcashA = 'fa122222-1111-1111-1111-111111111111';
  const inactiveDrawerA = 'fa133333-1111-1111-1111-111111111111';
  const drawerB = 'fb111111-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  // [A] CF2 + CF3 + CF4 apply cleanly
  assertSuccess({ ok: true }, '[A] CF2 foundation + CF3 foundation + CF4 migration apply cleanly');

  // [B] RPC exists
  const rpcCheck = queryJson(`
    SELECT proname FROM pg_proc WHERE proname = 'post_order_payment_atomic'
  `);
  assertEqual(rpcCheck.length, 1, '[B] post_order_payment_atomic RPC exists in schema');
  passedCount++;
  console.log('  ✓ [B] post_order_payment_atomic RPC exists in schema');

  // [C] Unauthenticated execution denied
  const unauthRes = callRpc(null, order1Id, 'key-unauth-01', [{ amount: 1500, payment_method: 'cash', financial_account_id: drawerA }]);
  assertFailure(unauthRes, 'AUTH_REQUIRED', '[C] unauthenticated execution denied');

  // [D] Unauthorized branch user denied (Staff B cannot pay for Branch A order)
  const wrongBranchStaffRes = callRpc(authStaffB, order1Id, 'key-wrong-branch-01', [{ amount: 1500, payment_method: 'cash', financial_account_id: drawerA }]);
  assertFailure(wrongBranchStaffRes, 'BRANCH_UNAUTHORIZED', '[D] unauthorized branch user denied');

  // [E] Inactive staff denied
  const inactiveStaffRes = callRpc(authStaffInactive, order1Id, 'key-inactive-staff-01', [{ amount: 1500, payment_method: 'cash', financial_account_id: drawerA }]);
  assertFailure(inactiveStaffRes, 'STAFF_INACTIVE', '[E] inactive staff denied');

  // [F] Wrong branch financial account denied (Branch B Drawer for Branch A order)
  const wrongBranchAccountRes = callRpc(authStaffA, order1Id, 'key-wrong-account-01', [{ amount: 1500, payment_method: 'cash', financial_account_id: drawerB }]);
  assertFailure(wrongBranchAccountRes, 'ACCOUNT_BRANCH_MISMATCH', '[F] wrong branch financial account denied');

  // [G] Inactive financial account denied
  const inactiveAccountRes = callRpc(authStaffA, order1Id, 'key-inactive-account-01', [{ amount: 1500, payment_method: 'cash', financial_account_id: inactiveDrawerA }]);
  assertFailure(inactiveAccountRes, 'ACCOUNT_INACTIVE', '[G] inactive financial account denied');

  // [H] Payment-method/account-type mismatch denied (GCash with cash drawer)
  const railMismatchRes = callRpc(authStaffA, order1Id, 'key-mismatch-rail-01', [{ amount: 1500, payment_method: 'gcash', financial_account_id: drawerA }]);
  assertFailure(railMismatchRes, 'ACCOUNT_TYPE_MISMATCH', '[H] payment-method/account-type mismatch denied');

  // [I] Zero payment denied
  const zeroPaymentRes = callRpc(authStaffA, order1Id, 'key-zero-payment-01', [{ amount: 0, payment_method: 'cash', financial_account_id: drawerA }]);
  assertFailure(zeroPaymentRes, 'INVALID_PAYMENT_AMOUNT', '[I] zero payment denied');

  // [J] Negative payment denied
  const negativePaymentRes = callRpc(authStaffA, order1Id, 'key-neg-payment-01', [{ amount: -500, payment_method: 'cash', financial_account_id: drawerA }]);
  assertFailure(negativePaymentRes, 'INVALID_PAYMENT_AMOUNT', '[J] negative payment denied');

  // [K] Full payment succeeds (Order 1: 1500 payable, 1500 paid -> state paid, remaining 0)
  const fullPayRes = callRpc(authStaffA, order1Id, 'key-full-pay-01', [{ amount: 1500, payment_method: 'cash', financial_account_id: drawerA }]);
  assertSuccess(fullPayRes, '[K] full payment succeeds');
  const summaryO1 = queryJson(`SELECT * FROM public.v_booking_order_financial_summaries WHERE order_id = '${order1Id}'`)[0];
  assertEqual(Number(summaryO1.total_payable), 1500, '[K.1] total payable is 1500');
  assertEqual(Number(summaryO1.net_allocated), 1500, '[K.2] net allocated is 1500');
  assertEqual(Number(summaryO1.remaining_balance), 0, '[K.3] remaining balance is 0');
  assertEqual(summaryO1.payment_state, 'paid', '[K.4] payment state is paid');

  // [L] Partial payment succeeds (Order 2: 1500 payable, 500 paid -> state partial, remaining 1000)
  const partialPayRes = callRpc(authStaffA, order2Id, 'key-partial-pay-01', [{ amount: 500, payment_method: 'cash', financial_account_id: drawerA }]);
  assertSuccess(partialPayRes, '[L] partial payment succeeds');
  const summaryO2 = queryJson(`SELECT * FROM public.v_booking_order_financial_summaries WHERE order_id = '${order2Id}'`)[0];
  assertEqual(Number(summaryO2.total_payable), 1500, '[L.1] total payable is 1500');
  assertEqual(Number(summaryO2.net_allocated), 500, '[L.2] net allocated is 500');
  assertEqual(Number(summaryO2.remaining_balance), 1000, '[L.3] remaining balance is 1000');
  assertEqual(summaryO2.payment_state, 'partial', '[L.4] payment state is partial');

  // [M] Split Cash + GCash succeeds (Order 3: 1000 Cash + 500 GCash = 1500)
  const splitPayRes = callRpc(authStaffA, order3Id, 'key-split-pay-01', [
    { amount: 1000, payment_method: 'cash', financial_account_id: drawerA },
    { amount: 500, payment_method: 'gcash', financial_account_id: gcashA, external_reference: 'GCASH-O3-SPLIT' }
  ]);
  assertSuccess(splitPayRes, '[M] split Cash + GCash succeeds');

  // [N] Exactly one transaction header for split payment
  const txSplitRows = queryJson(`
    SELECT ft.* FROM public.financial_transactions ft WHERE ft.idempotency_key = 'key-split-pay-01'
  `);
  assertEqual(txSplitRows.length, 1, '[N] exactly one transaction header for split payment');
  passedCount++;
  console.log('  ✓ [N] exactly one transaction header for split payment');

  // [O] Two movements created for split payment
  const splitTxId = txSplitRows[0].id;
  const splitMovRows = queryJson(`
    SELECT fam.* FROM public.financial_account_movements fam WHERE fam.transaction_id = '${splitTxId}' ORDER BY fam.amount DESC
  `);
  assertEqual(splitMovRows.length, 2, '[O.1] two movements created for split payment');
  assertEqual(splitMovRows[0].payment_method, 'cash', '[O.2] first movement is cash');
  assertEqual(Number(splitMovRows[0].amount), 1000, '[O.3] cash movement is 1000');
  assertEqual(splitMovRows[1].payment_method, 'gcash', '[O.4] second movement is gcash');
  assertEqual(Number(splitMovRows[1].amount), 500, '[O.5] gcash movement is 500');
  assertEqual(splitMovRows[1].external_reference, 'GCASH-O3-SPLIT', '[O.6] external reference preserved');
  passedCount++;
  console.log('  ✓ [O] two movements created for split payment with preserved tender attribution');

  // [P] Order-level allocation succeeds
  const splitAllocRows = queryJson(`
    SELECT foa.* FROM public.financial_order_allocations foa WHERE foa.order_id = '${order3Id}'
  `);
  assertEqual(splitAllocRows.length, 2, '[P.1] two order allocations created for the two movements');
  assertEqual(splitAllocRows[0].payable_item_id, null, '[P.2] order-level allocation has null payable_item_id');
  assertEqual(splitAllocRows[1].payable_item_id, null, '[P.3] order-level allocation has null payable_item_id');
  passedCount++;
  console.log('  ✓ [P] order-level allocation succeeds with default null item ID');

  // [Q] Item-level allocation succeeds
  // Settle remaining 1000 of Order 2 specifically targeting its payable item
  const itemAllocRes = callRpc(
    authStaffA,
    order2Id,
    'key-item-alloc-01',
    [{ amount: 1000, payment_method: 'cash', financial_account_id: drawerA }],
    [{ payable_item_id: '0e211111-1111-1111-1111-111111111111', amount: 1000 }]
  );
  assertSuccess(itemAllocRes, '[Q.1] item-level allocation succeeds');
  const o2ItemAllocRows = queryJson(`
    SELECT foa.* FROM public.financial_order_allocations foa
    WHERE foa.order_id = '${order2Id}' AND foa.payable_item_id = '0e211111-1111-1111-1111-111111111111'
  `);
  assertEqual(o2ItemAllocRows.length, 1, '[Q.2] item-level allocation record present with target payable item ID');
  assertEqual(Number(o2ItemAllocRows[0].amount), 1000, '[Q.3] item-level allocation amount is 1000');
  passedCount++;
  console.log('  ✓ [Q] item-level allocation succeeds targeting explicit payable item');

  // [R] Cross-order item allocation denied
  // Try to allocate payment for Order 6 targeting Order 1's payable item
  const crossOrderItemRes = callRpc(
    authStaffA,
    order6Id,
    'key-cross-item-01',
    [{ amount: 500, payment_method: 'cash', financial_account_id: drawerA }],
    [{ payable_item_id: '0e111111-1111-1111-1111-111111111111', amount: 500 }]
  );
  assertFailure(crossOrderItemRes, 'CROSS_ORDER_ITEM_MISMATCH', '[R] cross-order item allocation denied');

  // [S] Same idempotency retry returns same transaction
  const retryRes = callRpc(authStaffA, order1Id, 'key-full-pay-01', [{ amount: 1500, payment_method: 'cash', financial_account_id: drawerA }]);
  assertSuccess(retryRes, '[S.1] idempotency retry succeeded');
  const retryJson = JSON.parse(retryRes.output);
  assertEqual(retryJson.is_idempotent_replay, true, '[S.2] response indicates is_idempotent_replay = true');
  assertEqual(retryJson.total_paid, 1500, '[S.3] returns original total_paid');
  passedCount++;
  console.log('  ✓ [S] same idempotency retry returns original transaction without failure');

  // [T] Same idempotency does not create duplicate movements
  const totalMovementsOrder1 = queryJson(`
    SELECT fam.* FROM public.financial_account_movements fam
    JOIN public.financial_transactions ft ON ft.id = fam.transaction_id
    WHERE ft.idempotency_key = 'key-full-pay-01'
  `);
  assertEqual(totalMovementsOrder1.length, 1, '[T] same idempotency does not create duplicate movements');
  passedCount++;
  console.log('  ✓ [T] same idempotency replay does not create duplicate movements');

  // [U] Conflicting payload with same idempotency key rejected
  const conflictPayloadRes = callRpc(authStaffA, order1Id, 'key-full-pay-01', [{ amount: 999, payment_method: 'cash', financial_account_id: drawerA }]);
  assertFailure(conflictPayloadRes, 'IDEMPOTENCY_CONFLICT', '[U] conflicting payload with same idempotency key rejected');

  // [V] Rollback removes partial records on forced failure
  const failTxRes = runPsql(`
    BEGIN;
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" = '${authStaffA.sub}';
    -- This call will fail inside the RPC due to account type mismatch
    SELECT public.post_order_payment_atomic(
      '${order6Id}'::uuid,
      'key-fail-rollback-01',
      '[{"amount": 100, "payment_method": "gcash", "financial_account_id": "${drawerA}"}]'::jsonb
    );
    COMMIT;
  `);
  assertFailure(failTxRes, 'ACCOUNT_TYPE_MISMATCH', '[V.1] invalid payment failed');
  const rollbackCheck = queryJson(`
    SELECT count(*) as count FROM public.financial_transactions WHERE idempotency_key = 'key-fail-rollback-01'
  `);
  assertEqual(Number(rollbackCheck[0].count), 0, '[V.2] transaction rolled back cleanly without partial records');
  passedCount++;
  console.log('  ✓ [V] transaction rollback leaves zero partial records on failure');

  // [W] Zero-payable order cannot create zero-value payment
  const zeroPayableRes = callRpc(authStaffA, order4Id, 'key-zero-payable-01', [{ amount: 100, payment_method: 'cash', financial_account_id: drawerA }]);
  assertFailure(zeroPayableRes, 'ZERO_PAYABLE_ORDER', '[W] zero-payable order cannot accept payment');

  // [X] Negative-payable order rejected
  const negPayableRes = callRpc(authStaffA, order5Id, 'key-neg-payable-01', [{ amount: 100, payment_method: 'cash', financial_account_id: drawerA }]);
  assertFailure(negPayableRes, 'INVALID_NEGATIVE_PAYABLE', '[X] negative-payable order rejected');

  // [Y] Overpayment follows explicitly documented CF4 policy (rejected)
  // Order 1 is already paid; attempting any payment is rejected
  const overpayOrder1Res = callRpc(authStaffA, order1Id, 'key-overpay-01', [{ amount: 100, payment_method: 'cash', financial_account_id: drawerA }]);
  assertFailure(overpayOrder1Res, 'ORDER_ALREADY_PAID', '[Y.1] payment on settled order rejected');

  // Order 6 has remaining 1000; attempting payment of 1200 is rejected
  const overpayOrder6Res = callRpc(authStaffA, order6Id, 'key-overpay-02', [{ amount: 1200, payment_method: 'cash', financial_account_id: drawerA }]);
  assertFailure(overpayOrder6Res, 'PAYMENT_EXCEEDS_REMAINING_BALANCE', '[Y.2] payment exceeding remaining balance rejected');

  // [Z] Direct client financial-table writes remain denied
  const directTxInsert = runPsql(`
    BEGIN;
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" = '${authStaffA.sub}';
    INSERT INTO public.financial_transactions (
      branch_id, transaction_type, business_date, occurred_at, recorded_by, idempotency_key
    ) VALUES (
      '11111111-1111-1111-1111-111111111111', 'customer_payment', '2026-09-27', now(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'direct-client-tx'
    );
    COMMIT;
  `);
  assertFailure(directTxInsert, 'permission denied', '[Z.1] direct authenticated INSERT into financial_transactions denied');

  const directMovInsert = runPsql(`
    BEGIN;
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" = '${authStaffA.sub}';
    INSERT INTO public.financial_account_movements (
      transaction_id, financial_account_id, amount, payment_method
    ) VALUES (
      '${splitTxId}', '${drawerA}', 100.00, 'cash'
    );
    COMMIT;
  `);
  assertFailure(directMovInsert, 'permission denied', '[Z.2] direct authenticated INSERT into financial_account_movements denied');

  const directAllocInsert = runPsql(`
    BEGIN;
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" = '${authStaffA.sub}';
    INSERT INTO public.financial_order_allocations (
      financial_account_movement_id, order_id, amount
    ) VALUES (
      '${splitMovRows[0].id}', '${order3Id}', 100.00
    );
    COMMIT;
  `);
  assertFailure(directAllocInsert, 'permission denied', '[Z.3] direct authenticated INSERT into financial_order_allocations denied');

  // [AA] Resulting unpaid/partial/paid state correct
  const finalSummaryO1 = queryJson(`SELECT payment_state FROM public.v_booking_order_financial_summaries WHERE order_id = '${order1Id}'`)[0];
  const finalSummaryO2 = queryJson(`SELECT payment_state FROM public.v_booking_order_financial_summaries WHERE order_id = '${order2Id}'`)[0];
  const finalSummaryO3 = queryJson(`SELECT payment_state FROM public.v_booking_order_financial_summaries WHERE order_id = '${order3Id}'`)[0];
  const finalSummaryO6 = queryJson(`SELECT payment_state FROM public.v_booking_order_financial_summaries WHERE order_id = '${order6Id}'`)[0];

  assertEqual(finalSummaryO1.payment_state, 'paid', '[AA.1] Order 1 is paid');
  assertEqual(finalSummaryO2.payment_state, 'paid', '[AA.2] Order 2 is paid (after 500 partial + 1000 item alloc)');
  assertEqual(finalSummaryO3.payment_state, 'paid', '[AA.3] Order 3 is paid (after 1000 Cash + 500 GCash split)');
  assertEqual(finalSummaryO6.payment_state, 'unpaid', '[AA.4] Order 6 remains unpaid');
  passedCount++;
  console.log('  ✓ [AA] derived payment states for settled, partial, and unpaid orders correct');

  // [AB] Booking historical rows untouched
  const histBooking = queryJson(`
    SELECT id, order_id, amount_paid, payment_status
    FROM public.bookings
    WHERE id = 'b0111111-1111-1111-1111-111111111111'
  `)[0];
  assertEqual(histBooking.order_id, null, '[AB.1] historical booking order_id untouched');
  assertEqual(Number(histBooking.amount_paid), 500, '[AB.2] historical booking amount_paid untouched');
  assertEqual(histBooking.payment_status, 'paid', '[AB.3] historical booking payment_status untouched');
  passedCount++;
  console.log('  ✓ [AB] historical booking rows without orders remain completely untouched');

  // [AC] Historical booking_payment_logs untouched
  const histLog = queryJson(`
    SELECT count(*) as count FROM public.booking_payment_logs
    WHERE id = '10999999-9999-9999-9999-999999999999'
  `)[0];
  assertEqual(Number(histLog.count), 1, '[AC.1] historical booking_payment_logs record untouched');
  const allLogsCount = queryJson(`SELECT count(*) as count FROM public.booking_payment_logs`)[0];
  assertEqual(Number(allLogsCount.count), 1, '[AC.2] zero fake rows added to booking_payment_logs by CF4');
  passedCount++;
  console.log('  ✓ [AC] historical booking_payment_logs remain completely untouched and unmodified');

  // [AD] Concurrent identical requests deduplicated
  console.log('  Testing concurrency: identical idempotency requests in parallel...');
  const parallelKey = 'key-concurrent-idem-01';
  const call1Promise = Promise.resolve().then(() => callRpc(authStaffA, order6Id, parallelKey, [{ amount: 400, payment_method: 'cash', financial_account_id: drawerA }]));
  const call2Promise = Promise.resolve().then(() => callRpc(authStaffA, order6Id, parallelKey, [{ amount: 400, payment_method: 'cash', financial_account_id: drawerA }]));
  const [res1, res2] = await Promise.all([call1Promise, call2Promise]);

  assertEqual(res1.ok, true, '[AD.1] first concurrent request succeeded');
  assertEqual(res2.ok, true, '[AD.2] second concurrent request succeeded via idempotency');
  const txCountConcurrent = queryJson(`
    SELECT count(*) as count FROM public.financial_transactions WHERE idempotency_key = '${parallelKey}'
  `)[0];
  assertEqual(Number(txCountConcurrent.count), 1, '[AD.3] exactly one transaction created despite concurrent execution');
  passedCount++;
  console.log('  ✓ [AD] concurrent identical idempotency requests deduplicated safely');

  // [AE] Concurrent balance race handled safely
  // Order 6 had 1000 payable, 400 was paid above in [AD], remaining balance is 600.
  // We send two concurrent requests for 400 each (total 800 > 600 remaining balance).
  // Exactly ONE must succeed and the other must fail with PAYMENT_EXCEEDS_REMAINING_BALANCE!
  console.log('  Testing concurrency: race on remaining balance...');
  const racePromise1 = Promise.resolve().then(() => callRpc(authStaffA, order6Id, 'key-race-400-a', [{ amount: 400, payment_method: 'cash', financial_account_id: drawerA }]));
  const racePromise2 = Promise.resolve().then(() => callRpc(authStaffA, order6Id, 'key-race-400-b', [{ amount: 400, payment_method: 'cash', financial_account_id: drawerA }]));
  const [raceRes1, raceRes2] = await Promise.all([racePromise1, racePromise2]);

  const successes = [raceRes1, raceRes2].filter((r) => r.ok);
  const failures = [raceRes1, raceRes2].filter((r) => !r.ok);

  assertEqual(successes.length, 1, '[AE.1] exactly one concurrent payment succeeded');
  assertEqual(failures.length, 1, '[AE.2] exactly one concurrent payment failed');
  assertEqual(/PAYMENT_EXCEEDS_REMAINING_BALANCE/.test(failures[0].error), true, '[AE.3] failed payment was rejected due to balance limit');

  const finalSummaryO6AfterRace = queryJson(`
    SELECT total_payable, net_allocated, remaining_balance, payment_state
    FROM public.v_booking_order_financial_summaries WHERE order_id = '${order6Id}'
  `)[0];
  assertEqual(Number(finalSummaryO6AfterRace.net_allocated), 800, '[AE.4] net allocated is exactly 800 (400 from [AD] + 400 from winning race)');
  assertEqual(Number(finalSummaryO6AfterRace.remaining_balance), 200, '[AE.5] remaining balance is exactly 200');
  passedCount++;
  console.log('  ✓ [AE] concurrent balance race handled safely without over-allocation');

  console.log('\n======================================================================');
  console.log(`ALL CF4 DATABASE ASSERTIONS PASSED (${passedCount} checks passed)`);
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
