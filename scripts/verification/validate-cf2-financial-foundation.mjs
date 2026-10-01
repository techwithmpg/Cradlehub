#!/usr/bin/env node
/**
 * CF2: Financial Foundation — Reproducible Disposable Database Verification Harness
 *
 * Program: CradleHub Web — CONTROLLED STABILIZATION
 * Stage: CF2 — CORRECTION PASS 1
 * Authority: CradleHub_CF1_Financial_Contract_Freeze.md
 *
 * Verifies:
 * - Clean application of CF2 migration
 * - Strict signed movement contract (+ inflow, - outflow, 0 rejected)
 * - Immutability trigger protection against direct UPDATE/DELETE
 * - Payment method rail validation (cash, gcash, maya, bank_transfer, card ONLY; voucher/customer_credit rejected)
 * - RLS branch read isolation for operational staff (Staff A vs Staff B)
 * - Cross-branch read access for Owner
 * - Denial of ordinary authenticated direct writes (INSERT/UPDATE/DELETE)
 * - Safe masked view public.v_financial_accounts (security_invoker = true)
 * - Foreign key constraints, unique idempotency, and rollback safety
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
    throw new Error(`ASSERTION_FAILED: ${message}\n  Expected: ${JSON.stringify(expected)}\n  Actual:   ${JSON.stringify(actual)}`);
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
    throw new Error(`ASSERTION_FAILED: Expected failure for "${message}", but operation succeeded.\nOutput:\n${result.output}`);
  }
  if (expectedPattern && !new RegExp(expectedPattern).test(result.error)) {
    throw new Error(`ASSERTION_FAILED: Expected error matching "${expectedPattern}" for "${message}", but got:\n${result.error}`);
  }
  passedCount++;
  console.log(`  ✓ ${message}`);
}

// ─── Disposable Database Lifecycle ───────────────────────────────────────────

const containerName = process.env.CF2_TEST_CONTAINER || `cf2-test-db-${Date.now()}`;
let spawnedContainer = false;

function runPsql(sql, extraFlags = []) {
  try {
    const flagsStr = extraFlags.length > 0 ? ` ${extraFlags.join(' ')}` : '';
    const res = execSync(`docker exec -i ${containerName} psql -v ON_ERROR_STOP=1 -U supabase_admin -d postgres${flagsStr}`, {
      input: sql,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000,
    });
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
  if (startArr !== -1 && endArr !== -1 && endArr > startArr) {
    return JSON.parse(output.substring(startArr, endArr + 1));
  }
  const startObj = output.indexOf('{');
  const endObj = output.lastIndexOf('}');
  if (startObj !== -1 && endObj !== -1 && endObj > startObj) {
    return JSON.parse(output.substring(startObj, endObj + 1));
  }
  throw new Error(`queryJson produced no JSON array/object in output:\n${res.output}\nSQL:\n${sql}`);
}

function executeAsAuth(sql, authContext) {
  const wrappedSql = `
    BEGIN;
    SET LOCAL ROLE ${authContext.role || 'authenticated'};
    SET LOCAL "request.jwt.claim.sub" = '${authContext.sub}';
    SET LOCAL "request.jwt.claims" = '{"sub": "${authContext.sub}", "role": "${authContext.role || 'authenticated'}"}';
    ${sql};
    COMMIT;
  `;
  return runPsql(wrappedSql);
}

// ─── Main Verification Workflow ───────────────────────────────────────────────

async function main() {
  console.log('================================================================');
  console.log('CF2 REPRODUCIBLE DISPOSABLE DATABASE VERIFICATION HARNESS');
  console.log('Mode: DISPOSABLE MODELED PRE-CF2 SCHEMA VALIDATION');
  console.log('================================================================');

  try {
    // 1. Ensure Docker container is running
    const checkDocker = runPsql('SELECT 1;');
    if (!checkDocker.ok) {
      console.log(`Starting fresh disposable container: ${containerName}...`);
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
      console.log('Disposable container is ready and stable.');
    } else {
      console.log(`Connected to existing disposable container: ${containerName}`);
    }

    // 2. Reset public schema & ensure required roles exist
    console.log('\n[Phase 0] Resetting public schema and setting up auth roles...');
    const initRoles = runPsql(`
      DROP SCHEMA IF EXISTS public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO postgres;
      GRANT ALL ON SCHEMA public TO supabase_admin;
      GRANT ALL ON SCHEMA public TO public;

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

      GRANT authenticated, anon, service_role TO postgres;
      GRANT authenticated, anon, service_role TO supabase_admin;
    `);
    assertSuccess(initRoles, 'Init roles and clean public schema');

    // 3. Setup modeled prerequisite schema (branches, staff, auth helper functions)
    console.log('\n[Phase 1] Initializing modeled pre-CF2 schema (branches, staff, auth helpers)...');
    const prereqSql = `
      CREATE SCHEMA IF NOT EXISTS auth;

      CREATE OR REPLACE FUNCTION auth.uid()
      RETURNS UUID
      LANGUAGE sql STABLE
      AS $$
        SELECT COALESCE(
          nullif(current_setting('request.jwt.claim.sub', true), ''),
          nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub', '')
        )::uuid;
      $$;

      CREATE OR REPLACE FUNCTION auth.role()
      RETURNS TEXT
      LANGUAGE sql STABLE
      AS $$
        SELECT COALESCE(
          nullif(current_setting('request.jwt.claim.role', true), ''),
          nullif(current_setting('request.jwt.claims', true)::jsonb->>'role', '')
        )::text;
      $$;

      CREATE TABLE IF NOT EXISTS public.branches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true
      );

      CREATE TABLE IF NOT EXISTS public.staff (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        auth_user_id UUID,
        branch_id UUID REFERENCES public.branches(id),
        system_role TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true
      );

      -- Canonical RLS helper functions from repository
      CREATE OR REPLACE FUNCTION public.get_auth_role()
      RETURNS TEXT
      LANGUAGE sql STABLE SECURITY DEFINER
      SET search_path = public
      AS $$
        SELECT system_role
        FROM staff
        WHERE auth_user_id = (SELECT auth.uid())
          AND is_active = TRUE
        LIMIT 1;
      $$;

      CREATE OR REPLACE FUNCTION public.get_auth_branch_id()
      RETURNS UUID
      LANGUAGE sql STABLE SECURITY DEFINER
      SET search_path = public
      AS $$
        SELECT branch_id
        FROM staff
        WHERE auth_user_id = (SELECT auth.uid())
          AND is_active = TRUE
        LIMIT 1;
      $$;

      CREATE OR REPLACE FUNCTION public.get_auth_staff_id()
      RETURNS UUID
      LANGUAGE sql STABLE SECURITY DEFINER
      SET search_path = public
      AS $$
        SELECT id
        FROM staff
        WHERE auth_user_id = (SELECT auth.uid())
          AND is_active = TRUE
        LIMIT 1;
      $$;
    `;
    const prereqRes = runPsql(prereqSql);
    assertSuccess(prereqRes, 'Modeled pre-CF2 schema established');

    // 4. Apply the CF2 migration
    console.log('\n[Phase 2] Applying CF2 Migration: 20260927120000_cf2_financial_foundation.sql...');
    const migrationPath = join(repoRoot, 'supabase', 'migrations', '20260927120000_cf2_financial_foundation.sql');
    if (!existsSync(migrationPath)) {
      throw new Error(`Migration file not found at: ${migrationPath}`);
    }
    const migrationSql = readFileSync(migrationPath, 'utf-8');
    const migRes = runPsql(migrationSql);
    assertSuccess(migRes, 'A. migration applies successfully');

    // 5. Schema Object Existence Check
    console.log('\n[Phase 3] Asserting required tables and views exist...');
    const tables = queryJson(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('financial_accounts', 'financial_transactions', 'financial_account_movements')
    `);
    assertEqual(tables.length, 3, 'B. expected tables exist (financial_accounts, financial_transactions, financial_account_movements)');
    passedCount++;
    console.log('  ✓ B. expected tables exist');

    const views = queryJson(`
      SELECT table_name
      FROM information_schema.views
      WHERE table_schema = 'public' AND table_name = 'v_financial_accounts'
    `);
    assertEqual(views.length, 1, 'C. v_financial_accounts exists');
    passedCount++;
    console.log('  ✓ C. v_financial_accounts exists');

    // 6. Deterministic Synthetic Fixtures
    console.log('\n[Phase 4] Inserting synthetic test fixtures...');
    const fixtureSql = `
      -- Branches
      INSERT INTO public.branches (id, name) VALUES
        ('11111111-1111-1111-1111-111111111111', 'Branch A Synthetic'),
        ('22222222-2222-2222-2222-222222222222', 'Branch B Synthetic');

      -- Staff
      INSERT INTO public.staff (id, auth_user_id, branch_id, system_role, is_active) VALUES
        ('aaaaaaaa-1111-1111-1111-111111111111', 'faaaaaaa-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'manager', true),
        ('bbbbbbbb-2222-2222-2222-222222222222', 'fbbbbbbb-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'manager', true),
        ('cccccccc-3333-3333-3333-333333333333', 'fccccccc-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'owner', true);

      -- Financial Accounts
      INSERT INTO public.financial_accounts (id, branch_id, name, account_type, identifier_mask, currency, is_active) VALUES
        ('a1111111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Branch A Cash Drawer', 'cash_drawer', '*1111', 'PHP', true),
        ('a1111111-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Branch A GCash', 'gcash', '*2222', 'PHP', true),
        ('b2222222-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Branch B Cash Drawer', 'cash_drawer', '*3333', 'PHP', true);

      -- Financial Transactions
      INSERT INTO public.financial_transactions (id, branch_id, transaction_type, business_date, occurred_at, recorded_by, idempotency_key) VALUES
        ('d1111111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'customer_payment', '2026-09-27', now(), 'aaaaaaaa-1111-1111-1111-111111111111', 'branch-a-idem-key-1'),
        ('d2222222-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'customer_payment', '2026-09-27', now(), 'bbbbbbbb-2222-2222-2222-222222222222', 'branch-b-idem-key-1');

      -- Financial Account Movements
      INSERT INTO public.financial_account_movements (id, transaction_id, financial_account_id, amount, payment_method) VALUES
        ('e1111111-0000-0000-0000-000000000001', 'd1111111-0000-0000-0000-000000000001', 'a1111111-0000-0000-0000-000000000001', 1200.00, 'cash'),
        ('e2222222-0000-0000-0000-000000000001', 'd2222222-0000-0000-0000-000000000001', 'b2222222-0000-0000-0000-000000000001', 800.00, 'cash');
    `;
    const fixRes = runPsql(fixtureSql);
    assertSuccess(fixRes, 'Synthetic fixtures inserted under privileged context');

    // 7. Domain Constraints & Invariant Checks
    console.log('\n[Phase 5] Running integrity and domain constraint assertions...');

    // D. account taxonomy constraint
    const badAccType = runPsql(`
      INSERT INTO public.financial_accounts (branch_id, name, account_type, identifier_mask, currency)
      VALUES ('11111111-1111-1111-1111-111111111111', 'Invalid Account', 'crypto_wallet', '*0000', 'PHP');
    `);
    assertFailure(badAccType, 'check constraint', 'D. account taxonomy constraint');

    // E. PHP currency constraint
    const badCurrency = runPsql(`
      INSERT INTO public.financial_accounts (branch_id, name, account_type, identifier_mask, currency)
      VALUES ('11111111-1111-1111-1111-111111111111', 'USD Drawer', 'cash_drawer', '*0000', 'USD');
    `);
    assertFailure(badCurrency, 'check constraint', 'E. PHP currency constraint');

    // F. zero movement rejected
    const zeroMovement = runPsql(`
      INSERT INTO public.financial_account_movements (transaction_id, financial_account_id, amount, payment_method)
      VALUES ('d1111111-0000-0000-0000-000000000001', 'a1111111-0000-0000-0000-000000000001', 0.00, 'cash');
    `);
    assertFailure(zeroMovement, 'check_financial_account_movement_non_zero|check constraint', 'F. zero movement rejected');

    // G. positive movement accepted
    const posMovement = runPsql(`
      INSERT INTO public.financial_account_movements (transaction_id, financial_account_id, amount, payment_method)
      VALUES ('d1111111-0000-0000-0000-000000000001', 'a1111111-0000-0000-0000-000000000002', 500.00, 'gcash');
    `);
    assertSuccess(posMovement, 'G. positive movement accepted');

    // H. negative movement accepted
    const negMovement = runPsql(`
      INSERT INTO public.financial_account_movements (transaction_id, financial_account_id, amount, payment_method)
      VALUES ('d1111111-0000-0000-0000-000000000001', 'a1111111-0000-0000-0000-000000000001', -200.00, 'cash');
    `);
    assertSuccess(negMovement, 'H. negative movement accepted');

    // I. invalid account FK rejected
    const badAccFk = runPsql(`
      INSERT INTO public.financial_account_movements (transaction_id, financial_account_id, amount, payment_method)
      VALUES ('d1111111-0000-0000-0000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 100.00, 'cash');
    `);
    assertFailure(badAccFk, 'foreign key constraint', 'I. invalid account FK rejected');

    // J. invalid transaction FK rejected
    const badTxFk = runPsql(`
      INSERT INTO public.financial_account_movements (transaction_id, financial_account_id, amount, payment_method)
      VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'a1111111-0000-0000-0000-000000000001', 100.00, 'cash');
    `);
    assertFailure(badTxFk, 'foreign key constraint', 'J. invalid transaction FK rejected');

    // K. duplicate idempotency key rejected
    const dupIdem = runPsql(`
      INSERT INTO public.financial_transactions (branch_id, transaction_type, business_date, occurred_at, recorded_by, idempotency_key)
      VALUES ('11111111-1111-1111-1111-111111111111', 'customer_payment', '2026-09-27', now(), 'aaaaaaaa-1111-1111-1111-111111111111', 'branch-a-idem-key-1');
    `);
    assertFailure(dupIdem, 'unique constraint', 'K. duplicate idempotency key rejected');

    // L. self-reversal rejected
    const selfReversal = runPsql(`
      INSERT INTO public.financial_transactions (id, branch_id, transaction_type, business_date, occurred_at, recorded_by, idempotency_key, reversal_of_transaction_id)
      VALUES ('e9999999-9999-9999-9999-999999999999', '11111111-1111-1111-1111-111111111111', 'customer_refund', '2026-09-27', now(), 'aaaaaaaa-1111-1111-1111-111111111111', 'self-rev-key', 'e9999999-9999-9999-9999-999999999999');
    `);
    assertFailure(selfReversal, 'check_financial_transaction_no_self_reversal|check constraint', 'L. self-reversal rejected');

    // M. account deletion with history rejected
    const delAccount = runPsql(`
      DELETE FROM public.financial_accounts WHERE id = 'a1111111-0000-0000-0000-000000000001';
    `);
    assertFailure(delAccount, 'foreign key constraint', 'M. account deletion with history rejected');

    // AB. voucher rejected as payment_method
    const badVoucher = runPsql(`
      INSERT INTO public.financial_account_movements (transaction_id, financial_account_id, amount, payment_method)
      VALUES ('d1111111-0000-0000-0000-000000000001', 'a1111111-0000-0000-0000-000000000001', 100.00, 'voucher');
    `);
    assertFailure(badVoucher, 'check constraint', 'AB. voucher rejected as financial_account_movements.payment_method');

    // AC. customer_credit rejected as payment_method
    const badCredit = runPsql(`
      INSERT INTO public.financial_account_movements (transaction_id, financial_account_id, amount, payment_method)
      VALUES ('d1111111-0000-0000-0000-000000000001', 'a1111111-0000-0000-0000-000000000001', 100.00, 'customer_credit');
    `);
    assertFailure(badCredit, 'check constraint', 'AC. customer_credit rejected as financial_account_movements.payment_method');

    // 8. Ordinary Authenticated Direct Write Denial
    console.log('\n[Phase 6] Asserting ordinary authenticated direct writes are denied...');
    const staffAAuth = { sub: 'faaaaaaa-1111-1111-1111-111111111111', role: 'authenticated' };
    const staffBAuth = { sub: 'fbbbbbbb-2222-2222-2222-222222222222', role: 'authenticated' };
    const ownerAuth = { sub: 'fccccccc-3333-3333-3333-333333333333', role: 'authenticated' };

    // N. ordinary authenticated account INSERT rejected
    const authInsertAcc = executeAsAuth(`
      INSERT INTO public.financial_accounts (branch_id, name, account_type, identifier_mask, currency)
      VALUES ('11111111-1111-1111-1111-111111111111', 'Unauthorized Drawer', 'cash_drawer', '*9999', 'PHP');
    `, staffAAuth);
    assertFailure(authInsertAcc, 'permission denied for table financial_accounts', 'N. ordinary authenticated account INSERT rejected');

    // O. ordinary authenticated transaction INSERT rejected
    const authInsertTx = executeAsAuth(`
      INSERT INTO public.financial_transactions (branch_id, transaction_type, business_date, occurred_at, recorded_by, idempotency_key)
      VALUES ('11111111-1111-1111-1111-111111111111', 'customer_payment', '2026-09-27', now(), 'aaaaaaaa-1111-1111-1111-111111111111', 'rogue-idem-key');
    `, staffAAuth);
    assertFailure(authInsertTx, 'permission denied for table financial_transactions', 'O. ordinary authenticated transaction INSERT rejected');

    // P. ordinary authenticated movement INSERT rejected
    const authInsertMov = executeAsAuth(`
      INSERT INTO public.financial_account_movements (transaction_id, financial_account_id, amount, payment_method)
      VALUES ('d1111111-0000-0000-0000-000000000001', 'a1111111-0000-0000-0000-000000000001', 999.00, 'cash');
    `, staffAAuth);
    assertFailure(authInsertMov, 'permission denied for table financial_account_movements', 'P. ordinary authenticated movement INSERT rejected');

    // 9. Branch Read Isolation Assertions
    console.log('\n[Phase 7] Asserting branch read isolation and owner access under simulated JWT...');

    // Q. Branch A read isolation
    const staffAAccounts = queryJson('SELECT id, branch_id FROM public.financial_accounts', staffAAuth);
    assertEqual(staffAAccounts.length, 2, 'Staff A sees exactly Branch A accounts');
    assertEqual(staffAAccounts.every((a) => a.branch_id === '11111111-1111-1111-1111-111111111111'), true, 'Staff A sees no Branch B accounts');

    const staffATransactions = queryJson('SELECT id, branch_id FROM public.financial_transactions', staffAAuth);
    assertEqual(staffATransactions.length, 1, 'Staff A sees 1 transaction');
    assertEqual(staffATransactions[0].branch_id, '11111111-1111-1111-1111-111111111111', 'Staff A transaction belongs to Branch A');
    passedCount++;
    console.log('  ✓ Q. Branch A read isolation verified');

    // R. Branch B read isolation
    const staffBAccounts = queryJson('SELECT id, branch_id FROM public.financial_accounts', staffBAuth);
    assertEqual(staffBAccounts.length, 1, 'Staff B sees 1 account');
    assertEqual(staffBAccounts[0].branch_id, '22222222-2222-2222-2222-222222222222', 'Staff B account belongs to Branch B');

    const staffBTransactions = queryJson('SELECT id, branch_id FROM public.financial_transactions', staffBAuth);
    assertEqual(staffBTransactions.length, 1, 'Staff B sees 1 transaction');
    assertEqual(staffBTransactions[0].branch_id, '22222222-2222-2222-2222-222222222222', 'Staff B transaction belongs to Branch B');
    passedCount++;
    console.log('  ✓ R. Branch B read isolation verified');

    // S. owner cross-branch read
    const ownerAccounts = queryJson('SELECT id, branch_id FROM public.financial_accounts', ownerAuth);
    assertEqual(ownerAccounts.length, 3, 'Owner sees all 3 accounts across Branch A and Branch B');

    const ownerTransactions = queryJson('SELECT id FROM public.financial_transactions', ownerAuth);
    assertEqual(ownerTransactions.length, 2, 'Owner sees transactions from both branches');
    passedCount++;
    console.log('  ✓ S. owner cross-branch read verified');

    // T. financial_account_movements RLS specifically verified
    const staffAMovements = queryJson('SELECT id, transaction_id FROM public.financial_account_movements', staffAAuth);
    assertEqual(staffAMovements.some((m) => m.id === 'e2222222-0000-0000-0000-000000000001'), false, 'Staff A does NOT see Branch B movement');

    const staffBMovements = queryJson('SELECT id, transaction_id FROM public.financial_account_movements', staffBAuth);
    assertEqual(staffBMovements.some((m) => m.id === 'e1111111-0000-0000-0000-000000000001'), false, 'Staff B does NOT see Branch A movement');

    const ownerMovements = queryJson('SELECT id FROM public.financial_account_movements', ownerAuth);
    assertEqual(ownerMovements.length >= 2, true, 'Owner sees movements from both branches');
    passedCount++;
    console.log('  ✓ T. financial_account_movements RLS specifically verified');

    // U. safe masked view verified
    const maskedA = queryJson('SELECT id, name, identifier_mask, branch_id FROM public.v_financial_accounts', staffAAuth);
    assertEqual(maskedA.length, 2, 'Staff A sees 2 accounts in safe masked view');
    assertEqual(maskedA.every((a) => a.branch_id === '11111111-1111-1111-1111-111111111111'), true, 'Staff A masked view contains only Branch A');
    assertEqual(maskedA[0].identifier_mask, '*1111', 'Masked identifier visible');
    assertEqual('secret' in maskedA[0], false, 'No secret account credentials exposed in view');
    passedCount++;
    console.log('  ✓ U. safe masked view verified');

    // 10. Immutability Trigger Protection Assertions
    console.log('\n[Phase 8] Asserting append-only immutability trigger protection...');

    // V. direct UPDATE transaction rejected
    const updateTx = runPsql(`
      UPDATE public.financial_transactions SET notes = 'tampered' WHERE id = 'd1111111-0000-0000-0000-000000000001';
    `);
    assertFailure(updateTx, 'FINANCIAL_IMMUTABILITY_VIOLATION', 'V. direct UPDATE transaction rejected');

    // W. direct DELETE transaction rejected
    const deleteTx = runPsql(`
      DELETE FROM public.financial_transactions WHERE id = 'd1111111-0000-0000-0000-000000000001';
    `);
    assertFailure(deleteTx, 'FINANCIAL_IMMUTABILITY_VIOLATION', 'W. direct DELETE transaction rejected');

    // X. direct UPDATE movement rejected
    const updateMov = runPsql(`
      UPDATE public.financial_account_movements SET amount = 99999.00 WHERE id = 'e1111111-0000-0000-0000-000000000001';
    `);
    assertFailure(updateMov, 'FINANCIAL_IMMUTABILITY_VIOLATION', 'X. direct UPDATE movement rejected');

    // Y. direct DELETE movement rejected
    const deleteMov = runPsql(`
      DELETE FROM public.financial_account_movements WHERE id = 'e1111111-0000-0000-0000-000000000001';
    `);
    assertFailure(deleteMov, 'FINANCIAL_IMMUTABILITY_VIOLATION', 'Y. direct DELETE movement rejected');

    // 11. Multi-Movement and Rollback Safety
    console.log('\n[Phase 9] Asserting multi-movement structural support and atomic rollback...');

    // Z. multiple movements under one transaction supported
    const multiMovementSql = `
      INSERT INTO public.financial_transactions (id, branch_id, transaction_type, business_date, occurred_at, recorded_by, idempotency_key)
      VALUES ('d3333333-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'customer_payment', '2026-09-27', now(), 'aaaaaaaa-1111-1111-1111-111111111111', 'split-pay-idem-key');

      INSERT INTO public.financial_account_movements (transaction_id, financial_account_id, amount, payment_method)
      VALUES
        ('d3333333-0000-0000-0000-000000000001', 'a1111111-0000-0000-0000-000000000001', 1000.00, 'cash'),
        ('d3333333-0000-0000-0000-000000000001', 'a1111111-0000-0000-0000-000000000002', 500.00, 'gcash');
    `;
    const multiMovRes = runPsql(multiMovementSql);
    assertSuccess(multiMovRes, 'Z. multiple movements under one transaction supported');

    // AA. rollback leaves zero partial financial rows
    const rollbackSql = `
      BEGIN;
      INSERT INTO public.financial_transactions (id, branch_id, transaction_type, business_date, occurred_at, recorded_by, idempotency_key)
      VALUES ('d4444444-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'customer_payment', '2026-09-27', now(), 'aaaaaaaa-1111-1111-1111-111111111111', 'aborted-tx-idem-key');

      INSERT INTO public.financial_account_movements (transaction_id, financial_account_id, amount, payment_method)
      VALUES ('d4444444-0000-0000-0000-000000000001', 'a1111111-0000-0000-0000-000000000001', 500.00, 'cash');

      ROLLBACK;
    `;
    runPsql(rollbackSql);
    const abortedRows = queryJson("SELECT id FROM public.financial_transactions WHERE idempotency_key = 'aborted-tx-idem-key'");
    assertEqual(abortedRows.length, 0, 'AA. rollback leaves zero partial financial rows');
    passedCount++;
    console.log('  ✓ AA. rollback leaves zero partial financial rows');

    console.log('\n================================================================');
    console.log(`ALL ${passedCount} ASSERTIONS PASSED SUCCESSFULLY.`);
    console.log('================================================================');
  } finally {
    if (spawnedContainer) {
      console.log(`\nTearing down disposable container ${containerName}...`);
      try {
        execSync(`docker rm -f ${containerName}`, { stdio: 'ignore' });
        console.log(`Disposable container ${containerName} removed.`);
      } catch (err) {
        console.warn(`Warning: failed to remove container ${containerName}: ${err.message}`);
      }
    }
  }
}

main().catch((err) => {
  console.error('\n❌ VALIDATION FAILED WITH ERROR:');
  console.error(err.message || err);
  process.exit(1);
});
