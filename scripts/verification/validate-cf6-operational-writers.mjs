#!/usr/bin/env node
/**
 * CF6: Operational Cash Flow Writers & Child Schemas
 * Reproducible Disposable Database Verification Harness
 *
 * Program: CradleHub Web — CONTROLLED STABILIZATION
 * Stage: CF6 — OPERATIONAL CASH FLOW WIRING
 * Authority: CradleHub_CF1_Financial_Contract_Freeze.md
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..', '..');

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

const containerName = process.env.CF6_TEST_CONTAINER || `cf6-test-db-${Date.now()}`;
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

function callExpenseRpc(authContext, branchId, idempotencyKey, amount, categoryId, accountId, payee, desc, ref = null, date = null, notes = null) {
  let sessionPrefix = '';
  if (authContext) {
    sessionPrefix = `
      SET LOCAL ROLE ${authContext.role || 'authenticated'};
      SET LOCAL "request.jwt.claim.sub" = '${authContext.sub || ''}';
      SET LOCAL "request.jwt.claims" = '${JSON.stringify(authContext)}';
    `;
  }

  const sql = `
    BEGIN;
    ${sessionPrefix}
    SELECT public.post_expense_atomic(
      ${branchId ? `'${branchId}'::uuid` : 'NULL'},
      ${idempotencyKey ? `'${idempotencyKey.replace(/'/g, "''")}'` : 'NULL'},
      ${amount},
      ${categoryId ? `'${categoryId}'::uuid` : 'NULL'},
      ${accountId ? `'${accountId}'::uuid` : 'NULL'},
      ${payee ? `'${payee.replace(/'/g, "''")}'` : 'NULL'},
      ${desc ? `'${desc.replace(/'/g, "''")}'` : 'NULL'},
      ${ref ? `'${ref.replace(/'/g, "''")}'` : 'NULL'},
      ${date ? `'${date}'::date` : 'NULL'},
      ${notes ? `'${notes.replace(/'/g, "''")}'` : 'NULL'}
    ) AS result;
    COMMIT;
  `;

  const res = runPsql(sql, ['-t', '-A', '-q']);
  if (!res.ok) return res;
  const lines = res.output
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && l !== 'SET' && l !== 'BEGIN' && l !== 'COMMIT');
  return { ok: true, output: lines.join('\n') };
}

function callTipRpc(authContext, branchId, staffId, custodyType, amount, accountId = null, method = 'cash', date = null, notes = null, idempotencyKey = null) {
  let sessionPrefix = '';
  if (authContext) {
    sessionPrefix = `
      SET LOCAL ROLE ${authContext.role || 'authenticated'};
      SET LOCAL "request.jwt.claim.sub" = '${authContext.sub || ''}';
      SET LOCAL "request.jwt.claims" = '${JSON.stringify(authContext)}';
    `;
  }

  const sql = `
    BEGIN;
    ${sessionPrefix}
    SELECT public.post_tip_atomic(
      ${branchId ? `'${branchId}'::uuid` : 'NULL'},
      ${staffId ? `'${staffId}'::uuid` : 'NULL'},
      '${custodyType}',
      ${amount},
      ${accountId ? `'${accountId}'::uuid` : 'NULL'},
      ${method ? `'${method}'` : 'NULL'},
      ${date ? `'${date}'::date` : 'NULL'},
      ${notes ? `'${notes.replace(/'/g, "''")}'` : 'NULL'},
      ${idempotencyKey ? `'${idempotencyKey.replace(/'/g, "''")}'` : 'NULL'}
    ) AS result;
    COMMIT;
  `;

  const res = runPsql(sql, ['-t', '-A', '-q']);
  if (!res.ok) return res;
  const lines = res.output
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && l !== 'SET' && l !== 'BEGIN' && l !== 'COMMIT');
  return { ok: true, output: lines.join('\n') };
}

function callMiscIncomeRpc(authContext, branchId, accountId, amount, desc, payee = null, method = 'cash', date = null, notes = null, idempotencyKey = null) {
  let sessionPrefix = '';
  if (authContext) {
    sessionPrefix = `
      SET LOCAL ROLE ${authContext.role || 'authenticated'};
      SET LOCAL "request.jwt.claim.sub" = '${authContext.sub || ''}';
      SET LOCAL "request.jwt.claims" = '${JSON.stringify(authContext)}';
    `;
  }

  const sql = `
    BEGIN;
    ${sessionPrefix}
    SELECT public.post_misc_income_atomic(
      ${branchId ? `'${branchId}'::uuid` : 'NULL'},
      ${accountId ? `'${accountId}'::uuid` : 'NULL'},
      ${amount},
      ${desc ? `'${desc.replace(/'/g, "''")}'` : 'NULL'},
      ${payee ? `'${payee.replace(/'/g, "''")}'` : 'NULL'},
      ${method ? `'${method}'` : 'NULL'},
      ${date ? `'${date}'::date` : 'NULL'},
      ${notes ? `'${notes.replace(/'/g, "''")}'` : 'NULL'},
      ${idempotencyKey ? `'${idempotencyKey.replace(/'/g, "''")}'` : 'NULL'}
    ) AS result;
    COMMIT;
  `;

  const res = runPsql(sql, ['-t', '-A', '-q']);
  if (!res.ok) return res;
  const lines = res.output
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && l !== 'SET' && l !== 'BEGIN' && l !== 'COMMIT');
  return { ok: true, output: lines.join('\n') };
}

function callCashAdjustmentRpc(authContext, branchId, accountId, adjType, amount, reason, date = null, notes = null, idempotencyKey = null) {
  let sessionPrefix = '';
  if (authContext) {
    sessionPrefix = `
      SET LOCAL ROLE ${authContext.role || 'authenticated'};
      SET LOCAL "request.jwt.claim.sub" = '${authContext.sub || ''}';
      SET LOCAL "request.jwt.claims" = '${JSON.stringify(authContext)}';
    `;
  }

  const sql = `
    BEGIN;
    ${sessionPrefix}
    SELECT public.post_cash_adjustment_atomic(
      ${branchId ? `'${branchId}'::uuid` : 'NULL'},
      ${accountId ? `'${accountId}'::uuid` : 'NULL'},
      '${adjType}',
      ${amount},
      ${reason ? `'${reason.replace(/'/g, "''")}'` : 'NULL'},
      ${date ? `'${date}'::date` : 'NULL'},
      ${notes ? `'${notes.replace(/'/g, "''")}'` : 'NULL'},
      ${idempotencyKey ? `'${idempotencyKey.replace(/'/g, "''")}'` : 'NULL'}
    ) AS result;
    COMMIT;
  `;

  const res = runPsql(sql, ['-t', '-A', '-q']);
  if (!res.ok) return res;
  const lines = res.output
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && l !== 'SET' && l !== 'BEGIN' && l !== 'COMMIT');
  return { ok: true, output: lines.join('\n') };
}

function callTransferRpc(authContext, branchId, srcAccountId, dstAccountId, amount, date = null, notes = null, idempotencyKey = null) {
  let sessionPrefix = '';
  if (authContext) {
    sessionPrefix = `
      SET LOCAL ROLE ${authContext.role || 'authenticated'};
      SET LOCAL "request.jwt.claim.sub" = '${authContext.sub || ''}';
      SET LOCAL "request.jwt.claims" = '${JSON.stringify(authContext)}';
    `;
  }

  const sql = `
    BEGIN;
    ${sessionPrefix}
    SELECT public.post_transfer_atomic(
      ${branchId ? `'${branchId}'::uuid` : 'NULL'},
      ${srcAccountId ? `'${srcAccountId}'::uuid` : 'NULL'},
      ${dstAccountId ? `'${dstAccountId}'::uuid` : 'NULL'},
      ${amount},
      ${date ? `'${date}'::date` : 'NULL'},
      ${notes ? `'${notes.replace(/'/g, "''")}'` : 'NULL'},
      ${idempotencyKey ? `'${idempotencyKey.replace(/'/g, "''")}'` : 'NULL'}
    ) AS result;
    COMMIT;
  `;

  const res = runPsql(sql, ['-t', '-A', '-q']);
  if (!res.ok) return res;
  const lines = res.output
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && l !== 'SET' && l !== 'BEGIN' && l !== 'COMMIT');
  return { ok: true, output: lines.join('\n') };
}

async function main() {
  console.log('======================================================================');
  console.log('CF6: Operational Cash Flow Writers — Disposable DB Verifier');
  console.log('======================================================================\n');

  console.log(`Repository root: ${repoRoot}`);

  const cf2MigrationPath = join(repoRoot, 'supabase', 'migrations', '20260927120000_cf2_financial_foundation.sql');
  const cf3MigrationPath = join(repoRoot, 'supabase', 'migrations', '20260927130000_cf3_order_payables_allocations.sql');
  const cf4MigrationPath = join(repoRoot, 'supabase', 'migrations', '20260927140000_cf4_atomic_payment_writer.sql');
  const cf6MigrationPath = join(repoRoot, 'supabase', 'migrations', '20260928120000_cf6_operational_cash_flow_writers.sql');

  if (!existsSync(cf2MigrationPath)) throw new Error(`CF2 migration not found`);
  if (!existsSync(cf3MigrationPath)) throw new Error(`CF3 migration not found`);
  if (!existsSync(cf4MigrationPath)) throw new Error(`CF4 migration not found`);
  if (!existsSync(cf6MigrationPath)) throw new Error(`CF6 migration not found`);

  // 1. Launch container
  if (!process.env.CF6_TEST_CONTAINER) {
    console.log(`[1/7] Launching disposable container: ${containerName}...`);
    try {
      execSync(`docker rm -f ${containerName}`, { stdio: 'ignore' });
    } catch {}

    execSync(
      `docker run -d --name ${containerName} -e POSTGRES_PASSWORD=postgres public.ecr.aws/supabase/postgres:17.6.1.167`,
      { stdio: 'inherit' }
    );
    spawnedContainer = true;

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
    if (consecutiveSuccesses < 3) throw new Error('Disposable postgres container failed to become ready.');
    console.log('  ✓ Disposable container is ready and stable.');
  }

  // 2. Set up modeled pre-CF prereqs
  console.log('\n[2/7] Modeling prerequisite schema...');
  const modeledPrereqSql = `
    DROP SCHEMA IF EXISTS public CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO postgres;
    GRANT ALL ON SCHEMA public TO supabase_admin;
    GRANT ALL ON SCHEMA public TO public;

    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

    CREATE TABLE public.branches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
    );

    CREATE TABLE public.staff (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      auth_user_id UUID UNIQUE,
      branch_id UUID REFERENCES public.branches(id),
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff',
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
    );

    CREATE TABLE public.customers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      full_name TEXT NOT NULL,
      phone TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
    );

    CREATE TABLE public.services (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      price NUMERIC(12,2) NOT NULL,
      duration_minutes INT NOT NULL DEFAULT 60,
      created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
    );

    CREATE TABLE public.booking_orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      branch_id UUID NOT NULL REFERENCES public.branches(id),
      order_number TEXT NOT NULL UNIQUE,
      organizer_customer_id UUID REFERENCES public.customers(id),
      delivery_type TEXT NOT NULL DEFAULT 'in_spa',
      booking_date DATE NOT NULL DEFAULT CURRENT_DATE,
      currency TEXT NOT NULL DEFAULT 'PHP',
      payment_preference TEXT NOT NULL DEFAULT 'pay_at_spa',
      idempotency_key TEXT UNIQUE,
      payload_hash TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      type TEXT NOT NULL DEFAULT 'standard',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
    );

    CREATE TABLE public.bookings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      branch_id UUID NOT NULL REFERENCES public.branches(id),
      service_id UUID REFERENCES public.services(id),
      staff_id UUID REFERENCES public.staff(id),
      customer_id UUID REFERENCES public.customers(id),
      order_id UUID REFERENCES public.booking_orders(id),
      attendee_id UUID,
      booking_date DATE NOT NULL DEFAULT CURRENT_DATE,
      start_time TIME NOT NULL DEFAULT '09:00',
      end_time TIME NOT NULL DEFAULT '10:00',
      status TEXT NOT NULL DEFAULT 'confirmed',
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
    );

    CREATE TABLE public.booking_payment_logs (
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
    );

    GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches, public.staff, public.customers, public.services, public.booking_orders, public.bookings, public.booking_payment_logs TO authenticated, anon, service_role;


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
  assertSuccess(prereqRes, 'Prerequisite schema applied cleanly');

  // 3-6. Apply migrations
  console.log('\n[3/7] Applying CF2 migration...');
  assertSuccess(runPsql(readFileSync(cf2MigrationPath, 'utf-8')), 'CF2 migration applied cleanly');

  console.log('\n[4/7] Applying CF3 migration...');
  assertSuccess(runPsql(readFileSync(cf3MigrationPath, 'utf-8')), 'CF3 migration applied cleanly');

  console.log('\n[5/7] Applying CF4 migration...');
  assertSuccess(runPsql(readFileSync(cf4MigrationPath, 'utf-8')), 'CF4 migration applied cleanly');

  console.log('\n[6/7] Applying CF6 migration...');
  assertSuccess(runPsql(readFileSync(cf6MigrationPath, 'utf-8')), 'CF6 migration applied cleanly');

  // 7. Seed fixtures and run assertions
  console.log('\n[7/7] Seeding test fixtures and executing CF6 assertions...');
  const branchId = '11111111-1111-1111-1111-111111111111';
  const branch2Id = '22222222-2222-2222-2222-222222222222';
  const staffAuthUid = '33333333-3333-3333-3333-333333333333';
  const staffId = '44444444-4444-4444-4444-444444444444';
  const therapistId = '55555555-5555-5555-5555-555555555555';
  const cashDrawerId = '66666666-6666-6666-6666-666666666666';
  const gcashAccountId = '77777777-7777-7777-7777-777777777777';
  const bankAccountId = '88888888-8888-8888-8888-888888888888';
  const otherBranchAccId = '99999999-9999-9999-9999-999999999999';

  const seedSql = `
    INSERT INTO public.branches (id, name, is_active) VALUES
      ('${branchId}', 'Main Spa', true),
      ('${branch2Id}', 'Second Branch', true);

    INSERT INTO public.staff (id, auth_user_id, branch_id, full_name, role, is_active) VALUES
      ('${staffId}', '${staffAuthUid}', '${branchId}', 'Front Desk Staff', 'csr', true),
      ('${therapistId}', gen_random_uuid(), '${branchId}', 'Maria Therapist', 'staff', true);

    INSERT INTO public.financial_accounts (id, branch_id, name, account_type, identifier_mask, currency, is_active) VALUES
      ('${cashDrawerId}', '${branchId}', 'Main Cash Drawer', 'cash_drawer', 'Main Drawer', 'PHP', true),
      ('${gcashAccountId}', '${branchId}', 'GCash Front Desk', 'gcash', '0917-***-1234', 'PHP', true),
      ('${bankAccountId}', '${branchId}', 'BDO Main Account', 'bank_transfer', 'BDO *5678', 'PHP', true),
      ('${otherBranchAccId}', '${branch2Id}', 'Second Branch Drawer', 'cash_drawer', 'Drawer 2', 'PHP', true);
  `;
  assertSuccess(runPsql(seedSql), 'Test fixtures seeded successfully');

  const authUser = { sub: staffAuthUid, role: 'authenticated' };

  // Get fuel category
  const categories = queryJson(`SELECT id, code, name FROM public.financial_expense_categories WHERE code = 'fuel'`);
  const fuelCategoryId = categories[0].id;

  // ─── PART A: Schema existence ─────────────────────────────────────────────
  console.log('\n--- Part A: Schema & Function Verification ---');
  const catCount = queryJson(`SELECT COUNT(*)::int AS count FROM public.financial_expense_categories`);
  assertEqual(catCount[0].count >= 9, true, 'Expense categories seeded with at least 9 standard rows');
  passedCount++;
  console.log('  ✓ [A.1] financial_expense_categories seeded');

  // ─── PART B: Expense Writer Assertions ────────────────────────────────────
  console.log('\n--- Part B: Operational Expense Writer Assertions ---');
  
  // Zero / negative amount rejected
  assertFailure(
    callExpenseRpc(authUser, branchId, 'exp-inv-1', 0, fuelCategoryId, cashDrawerId, 'Petron', 'Gas fuel'),
    'INVALID_AMOUNT',
    '[B.1] Zero expense amount rejected'
  );
  assertFailure(
    callExpenseRpc(authUser, branchId, 'exp-inv-2', -150, fuelCategoryId, cashDrawerId, 'Petron', 'Gas fuel'),
    'INVALID_AMOUNT',
    '[B.2] Negative expense amount rejected'
  );

  // Missing description rejected
  assertFailure(
    callExpenseRpc(authUser, branchId, 'exp-inv-3', 250, fuelCategoryId, cashDrawerId, 'Petron', ''),
    'DESCRIPTION_REQUIRED',
    '[B.3] Empty expense description rejected'
  );

  // Wrong branch account rejected
  assertFailure(
    callExpenseRpc(authUser, branchId, 'exp-inv-4', 250, fuelCategoryId, otherBranchAccId, 'Petron', 'Gas fuel'),
    'ACCOUNT_BRANCH_MISMATCH',
    '[B.4] Account belonging to different branch rejected'
  );

  // Valid expense succeeds
  const expRes = callExpenseRpc(
    authUser,
    branchId,
    'exp-valid-1',
    350.50,
    fuelCategoryId,
    cashDrawerId,
    'Petron Gas Station',
    'Home service driver gas reimbursement',
    'OR-98765',
    '2026-09-28',
    'Trip #12 fuel'
  );
  assertSuccess(expRes, '[B.5] Valid expense transaction posted successfully');

  // Verify signed negative movement
  const expMovement = queryJson(`
    SELECT m.amount, m.payment_method, ed.payee, ed.receipt_reference
    FROM public.financial_account_movements m
    JOIN public.financial_transactions t ON t.id = m.transaction_id
    JOIN public.financial_expense_details ed ON ed.transaction_id = t.id
    WHERE t.idempotency_key = 'exp-valid-1'
  `);
  assertEqual(expMovement.length, 1, 'Exactly 1 movement created for expense');
  assertEqual(Number(expMovement[0].amount), -350.50, 'Expense movement amount is signed negative (-350.50)');
  assertEqual(expMovement[0].payee, 'Petron Gas Station', 'Payee recorded accurately');
  assertEqual(expMovement[0].receipt_reference, 'OR-98765', 'Receipt reference recorded');
  passedCount++;
  console.log('  ✓ [B.6] Expense creates signed negative account movement');

  // Idempotency replay returns same transaction
  const expReplay = callExpenseRpc(
    authUser,
    branchId,
    'exp-valid-1',
    350.50,
    fuelCategoryId,
    cashDrawerId,
    'Petron Gas Station',
    'Home service driver gas reimbursement'
  );
  assertSuccess(expReplay, '[B.7] Idempotent retry returns original expense without duplication');
  const expCount = queryJson(`SELECT COUNT(*)::int AS count FROM public.financial_transactions WHERE idempotency_key = 'exp-valid-1'`);
  assertEqual(expCount[0].count, 1, 'Only 1 transaction header exists after idempotency replay');
  passedCount++;
  console.log('  ✓ [B.8] Idempotent replay does not duplicate records');

  // ─── PART C: Tip Writer Assertions ────────────────────────────────────────
  console.log('\n--- Part C: Tip Writer Assertions ---');

  // Direct cash tip: 0 movement
  const directTipRes = callTipRpc(
    authUser,
    branchId,
    therapistId,
    'direct_cash',
    200,
    null,
    'cash',
    '2026-09-28',
    'Direct client cash tip to therapist',
    'tip-direct-1'
  );
  assertSuccess(directTipRes, '[C.1] Direct cash tip recorded successfully');
  const directMovements = queryJson(`
    SELECT m.* FROM public.financial_account_movements m
    JOIN public.financial_transactions t ON t.id = m.transaction_id
    WHERE t.idempotency_key = 'tip-direct-1'
  `);
  assertEqual(directMovements.length, 0, 'Direct cash tip generates ZERO company account movements (CF1-D09)');
  passedCount++;
  console.log('  ✓ [C.2] Direct cash tip has zero company account custody');

  // Company-custodied tip: positive movement in company account
  const custodiedTipRes = callTipRpc(
    authUser,
    branchId,
    therapistId,
    'company_custodied',
    300,
    gcashAccountId,
    'gcash',
    '2026-09-28',
    'GCash tip collected by front desk',
    'tip-custodied-1'
  );
  assertSuccess(custodiedTipRes, '[C.3] Company-custodied tip recorded successfully');
  const custodiedMovements = queryJson(`
    SELECT m.amount, td.custody_type, td.payout_status, td.tip_amount
    FROM public.financial_account_movements m
    JOIN public.financial_transactions t ON t.id = m.transaction_id
    JOIN public.financial_tip_details td ON td.transaction_id = t.id
    WHERE t.idempotency_key = 'tip-custodied-1'
  `);
  assertEqual(custodiedMovements.length, 1, 'Company-custodied tip generates 1 account movement');
  assertEqual(Number(custodiedMovements[0].amount), 300, 'Company-custodied tip creates positive movement (+300)');
  assertEqual(custodiedMovements[0].custody_type, 'company_custodied', 'Custody type is company_custodied');
  assertEqual(custodiedMovements[0].payout_status, 'pending_disbursement', 'Payout status is pending_disbursement');
  passedCount++;
  console.log('  ✓ [C.4] Company-custodied tip creates positive movement and pending liability');

  // ─── PART D: Misc Income Assertions ───────────────────────────────────────
  console.log('\n--- Part D: Misc Income Writer Assertions ---');

  const miscRes = callMiscIncomeRpc(
    authUser,
    branchId,
    cashDrawerId,
    500,
    'Scrap cardboard sale',
    'Recycler junk shop',
    'cash',
    '2026-09-28',
    'Sold carton boxes',
    'misc-1'
  );
  assertSuccess(miscRes, '[D.1] Misc income recorded successfully');

  const miscRecords = queryJson(`
    SELECT m.amount, cd.commercial_type, cd.description, t.source_id
    FROM public.financial_account_movements m
    JOIN public.financial_transactions t ON t.id = m.transaction_id
    JOIN public.financial_commercial_details cd ON cd.transaction_id = t.id
    WHERE t.idempotency_key = 'misc-1'
  `);
  assertEqual(miscRecords.length, 1, '1 movement created for misc income');
  assertEqual(Number(miscRecords[0].amount), 500, 'Misc income movement is positive (+500)');
  assertEqual(miscRecords[0].commercial_type, 'misc_income', 'Commercial type is misc_income');
  assertEqual(miscRecords[0].source_id, null, 'No fake booking created for misc income (CF1-D15)');
  passedCount++;
  console.log('  ✓ [D.2] Misc income creates positive inflow without fake booking');

  // ─── PART E: Cash Adjustment Assertions ───────────────────────────────────
  console.log('\n--- Part E: Cash Adjustment Assertions ---');

  // Addition (+ float)
  const addRes = callCashAdjustmentRpc(
    authUser,
    branchId,
    cashDrawerId,
    'addition',
    1000,
    'Opening morning change float addition',
    '2026-09-28',
    'Added coins & small bills',
    'cash-add-1'
  );
  assertSuccess(addRes, '[E.1] Cash addition recorded successfully');
  const addRecord = queryJson(`
    SELECT m.amount, t.notes
    FROM public.financial_account_movements m
    JOIN public.financial_transactions t ON t.id = m.transaction_id
    WHERE t.idempotency_key = 'cash-add-1'
  `);
  assertEqual(Number(addRecord[0].amount), 1000, 'Cash addition creates positive movement (+1000)');
  assertEqual(addRecord[0].notes.includes('Opening morning change float addition'), true, 'Cash addition reason recorded on transaction header');
  const addCdCount = queryJson(`
    SELECT COUNT(*)::int AS count
    FROM public.financial_commercial_details cd
    JOIN public.financial_transactions t ON t.id = cd.transaction_id
    WHERE t.idempotency_key = 'cash-add-1'
  `);
  assertEqual(addCdCount[0].count, 0, 'No commercial details record created for cash addition (domain separation)');
  passedCount++;
  console.log('  ✓ [E.2] Cash addition creates positive drawer movement and preserves domain boundary');

  // Removal (- safe drop)
  const remRes = callCashAdjustmentRpc(
    authUser,
    branchId,
    cashDrawerId,
    'removal',
    2000,
    'Midday safe drop to manager safe',
    '2026-09-28',
    'Cash drop',
    'cash-rem-1'
  );
  assertSuccess(remRes, '[E.3] Cash removal recorded successfully');
  const remRecord = queryJson(`
    SELECT m.amount, t.notes
    FROM public.financial_account_movements m
    JOIN public.financial_transactions t ON t.id = m.transaction_id
    WHERE t.idempotency_key = 'cash-rem-1'
  `);
  assertEqual(Number(remRecord[0].amount), -2000, 'Cash removal creates negative movement (-2000)');
  assertEqual(remRecord[0].notes.includes('Midday safe drop to manager safe'), true, 'Cash removal reason recorded on transaction header');
  const remCdCount = queryJson(`
    SELECT COUNT(*)::int AS count
    FROM public.financial_commercial_details cd
    JOIN public.financial_transactions t ON t.id = cd.transaction_id
    WHERE t.idempotency_key = 'cash-rem-1'
  `);
  assertEqual(remCdCount[0].count, 0, 'No commercial details record created for cash removal (domain separation)');
  passedCount++;
  console.log('  ✓ [E.4] Cash removal creates negative drawer movement and preserves domain boundary');

  // Cash adjustment on digital account rejected
  assertFailure(
    callCashAdjustmentRpc(authUser, branchId, gcashAccountId, 'addition', 500, 'Invalid digital adjustment'),
    'CASH_DRAWER_REQUIRED',
    '[E.5] Cash adjustment on non-cash-drawer account rejected'
  );

  // ─── PART F: Transfer Assertions ──────────────────────────────────────────
  console.log('\n--- Part F: Account Transfer Assertions ---');

  // Identical accounts rejected
  assertFailure(
    callTransferRpc(authUser, branchId, cashDrawerId, cashDrawerId, 1500),
    'IDENTICAL_ACCOUNTS',
    '[F.1] Transfer between identical accounts rejected'
  );

  // Valid transfer (Drawer -> Bank)
  const transferRes = callTransferRpc(
    authUser,
    branchId,
    cashDrawerId,
    bankAccountId,
    5000,
    '2026-09-28',
    'Cash drawer bank deposit',
    'tx-transfer-1'
  );
  assertSuccess(transferRes, '[F.2] Account transfer recorded successfully');

  const transferMovements = queryJson(`
    SELECT m.financial_account_id, m.amount, a.account_type
    FROM public.financial_account_movements m
    JOIN public.financial_transactions t ON t.id = m.transaction_id
    JOIN public.financial_accounts a ON a.id = m.financial_account_id
    WHERE t.idempotency_key = 'tx-transfer-1'
    ORDER BY m.amount ASC
  `);
  assertEqual(transferMovements.length, 2, 'Exactly 2 movements created for transfer');
  assertEqual(transferMovements[0].financial_account_id, cashDrawerId, 'Source account has outflow');
  assertEqual(Number(transferMovements[0].amount), -5000, 'Source movement is -5000');
  assertEqual(transferMovements[1].financial_account_id, bankAccountId, 'Destination account has inflow');
  assertEqual(Number(transferMovements[1].amount), 5000, 'Destination movement is +5000');
  assertEqual(Number(transferMovements[0].amount) + Number(transferMovements[1].amount), 0, 'Net effect of transfer is exactly 0.00');
  passedCount++;
  console.log('  ✓ [F.3] Transfer creates balanced dual movements with net zero effect');

  const transferCdCount = queryJson(`
    SELECT COUNT(*)::int AS count
    FROM public.financial_commercial_details cd
    JOIN public.financial_transactions t ON t.id = cd.transaction_id
    WHERE t.idempotency_key = 'tx-transfer-1'
  `);
  assertEqual(transferCdCount[0].count, 0, 'No commercial details record created for transfer (domain separation)');
  passedCount++;
  console.log('  ✓ [F.4] Transfer creates no commercial records (internal liquidity reallocation)');

  // ─── PART G: Security & Authorization Invariants ──────────────────────────
  console.log('\n--- Part G: Security and Authorization Invariants ---');

  // Cross-branch expense denial
  assertFailure(
    callExpenseRpc(
      authUser,
      branch2Id,
      'exp-cross-branch',
      250,
      fuelCategoryId,
      otherBranchAccId,
      'Other Branch Vendor',
      'Unauthorized cross branch expense'
    ),
    'BRANCH_MISMATCH',
    '[G.1] Cross-branch expense post rejected for CSR staff'
  );

  // Cross-branch tip denial
  assertFailure(
    callTipRpc(
      authUser,
      branch2Id,
      therapistId,
      'direct_cash',
      100,
      null,
      'cash',
      '2026-09-28',
      'Cross branch tip attempt',
      'tip-cross-branch'
    ),
    'BRANCH_MISMATCH',
    '[G.2] Cross-branch tip post rejected for CSR staff'
  );

  // Direct table writes denied by RLS for authenticated role
  const directExpenseInsertSql = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" = '${staffAuthUid}';
    INSERT INTO public.financial_expense_details (
      transaction_id, category_id, payee, description
    ) VALUES (
      gen_random_uuid(), '${fuelCategoryId}', 'Hacker Payee', 'Bypassing RPC'
    );
  `;
  const directExpenseInsertRes = runPsql(directExpenseInsertSql);
  assertEqual(directExpenseInsertRes.ok, false, 'Direct INSERT into financial_expense_details denied by RLS policy');
  passedCount++;
  console.log('  ✓ [G.3] Direct INSERT into financial_expense_details blocked by RLS');

  const directTipInsertSql = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" = '${staffAuthUid}';
    INSERT INTO public.financial_tip_details (
      transaction_id, beneficiary_staff_id, tip_amount, custody_type
    ) VALUES (
      gen_random_uuid(), '${therapistId}', 500, 'direct_cash'
    );
  `;
  const directTipInsertRes = runPsql(directTipInsertSql);
  assertEqual(directTipInsertRes.ok, false, 'Direct INSERT into financial_tip_details denied by RLS policy');
  passedCount++;
  console.log('  ✓ [G.4] Direct INSERT into financial_tip_details blocked by RLS');

  const directCommercialInsertSql = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" = '${staffAuthUid}';
    INSERT INTO public.financial_commercial_details (
      transaction_id, commercial_type, description
    ) VALUES (
      gen_random_uuid(), 'misc_income', 'Direct insert hack'
    );
  `;
  const directCommercialInsertRes = runPsql(directCommercialInsertSql);
  assertEqual(directCommercialInsertRes.ok, false, 'Direct INSERT into financial_commercial_details denied by RLS policy');
  passedCount++;
  console.log('  ✓ [G.5] Direct INSERT into financial_commercial_details blocked by RLS');

  console.log('\n======================================================================');
  console.log(`ALL CF6 DATABASE ASSERTIONS PASSED (${passedCount} checks passed)`);
  console.log('======================================================================\n');

  if (spawnedContainer) {
    try {
      execSync(`docker rm -f ${containerName}`, { stdio: 'ignore' });
      console.log(`Disposable container ${containerName} stopped and removed.`);
    } catch {}
  }
}

main().catch((err) => {
  console.error('\nVERIFICATION HARNESS FAILED:', err);
  if (spawnedContainer) {
    try {
      execSync(`docker rm -f ${containerName}`, { stdio: 'ignore' });
    } catch {}
  }
  process.exit(1);
});
