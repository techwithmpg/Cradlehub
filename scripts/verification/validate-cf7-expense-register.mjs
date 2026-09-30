#!/usr/bin/env node
/**
 * CF7: Operational Expense Register & Receipt Storage Verification Harness
 * Reproducible Disposable Database Verification Harness
 *
 * Program: CradleHub Web — CONTROLLED STABILIZATION
 * Stage: CF7 — OPERATIONAL EXPENSE REGISTER & RECEIPT ATTACHMENT
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

const containerName = process.env.CF7_TEST_CONTAINER || process.env.CF6_TEST_CONTAINER || `cf7-test-db-${Date.now()}`;
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

  const cleanSql = sql.trim().replace(/;+$/, '');
  const wrappedSql = `
    BEGIN;
    ${sessionPrefix}
    SELECT COALESCE(json_agg(t), '[]'::json) FROM (${cleanSql}) t;
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

function callExpenseRpc(
  authContext,
  branchId,
  idempotencyKey,
  amount,
  categoryId,
  accountId,
  payee,
  desc,
  ref = null,
  date = null,
  notes = null,
  receiptPath = null
) {
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
      ${notes ? `'${notes.replace(/'/g, "''")}'` : 'NULL'},
      ${receiptPath ? `'${receiptPath.replace(/'/g, "''")}'` : 'NULL'}
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
  console.log('CF7: Operational Expense Register & Receipts — Disposable DB Verifier');
  console.log('======================================================================\n');

  console.log(`Repository root: ${repoRoot}`);

  const cf2MigrationPath = join(repoRoot, 'supabase', 'migrations', '20260927120000_cf2_financial_foundation.sql');
  const cf3MigrationPath = join(repoRoot, 'supabase', 'migrations', '20260927130000_cf3_order_payables_allocations.sql');
  const cf4MigrationPath = join(repoRoot, 'supabase', 'migrations', '20260927140000_cf4_atomic_payment_writer.sql');
  const cf6MigrationPath = join(repoRoot, 'supabase', 'migrations', '20260928120000_cf6_operational_cash_flow_writers.sql');
  const cf7MigrationPath = join(repoRoot, 'supabase', 'migrations', '20260929120000_cf7_expense_receipt_storage.sql');

  if (!existsSync(cf2MigrationPath)) throw new Error('CF2 migration not found');
  if (!existsSync(cf3MigrationPath)) throw new Error('CF3 migration not found');
  if (!existsSync(cf4MigrationPath)) throw new Error('CF4 migration not found');
  if (!existsSync(cf6MigrationPath)) throw new Error('CF6 migration not found');
  if (!existsSync(cf7MigrationPath)) throw new Error('CF7 migration not found');

  // 1. Launch container if not provided
  if (!process.env.CF7_TEST_CONTAINER && !process.env.CF6_TEST_CONTAINER) {
    console.log(`[1/8] Launching disposable container: ${containerName}...`);
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

  // 2. Set up prerequisite schema including storage mocks
  console.log('\n[2/8] Modeling prerequisite schema & Storage structures...');
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

    -- Supabase Storage schema setup
    CREATE SCHEMA IF NOT EXISTS storage;
    GRANT USAGE ON SCHEMA storage TO authenticated, anon, service_role;

    CREATE TABLE IF NOT EXISTS storage.buckets (
      id text NOT NULL PRIMARY KEY,
      name text NOT NULL UNIQUE,
      owner uuid,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      public boolean DEFAULT false,
      avif_autodetection boolean DEFAULT false,
      file_size_limit bigint,
      allowed_mime_types text[],
      owner_id text
    );

    CREATE TABLE IF NOT EXISTS storage.objects (
      id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      bucket_id text REFERENCES storage.buckets(id),
      name text,
      owner uuid,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      last_accessed_at timestamptz DEFAULT now(),
      metadata jsonb,
      path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/')) STORED,
      version text,
      owner_id text,
      user_metadata jsonb
    );

    CREATE OR REPLACE FUNCTION storage.foldername(name text)
    RETURNS text[]
    LANGUAGE plpgsql
    IMMUTABLE
    AS $$
    DECLARE
      _parts text[];
    BEGIN
      _parts := string_to_array(name, '/');
      RETURN _parts[1:array_length(_parts, 1) - 1];
    END;
    $$;

    CREATE OR REPLACE FUNCTION storage.filename(name text)
    RETURNS text
    LANGUAGE plpgsql
    IMMUTABLE
    AS $$
    DECLARE
      _parts text[];
    BEGIN
      _parts := string_to_array(name, '/');
      RETURN _parts[array_length(_parts, 1)];
    END;
    $$;

    CREATE OR REPLACE FUNCTION storage.extension(name text)
    RETURNS text
    LANGUAGE plpgsql
    IMMUTABLE
    AS $$
    DECLARE
      _filename text;
      _parts text[];
    BEGIN
      _filename := storage.filename(name);
      _parts := string_to_array(_filename, '.');
      IF array_length(_parts, 1) > 1 THEN
        RETURN _parts[array_length(_parts, 1)];
      ELSE
        RETURN '';
      END IF;
    END;
    $$;

    GRANT ALL ON ALL TABLES IN SCHEMA storage TO authenticated, anon, service_role;
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

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
      system_role TEXT NOT NULL DEFAULT 'staff',
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
      total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      operational_status TEXT NOT NULL DEFAULT 'confirmed',
      created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
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

    -- Helper functions matching production
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
      SELECT coalesce(s.system_role, s.role) INTO v_role
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
  if (!prereqRes.ok) throw new Error(`Failed to apply modeled prereqs:\n${prereqRes.error}`);
  console.log('  ✓ Prerequisite schema & Storage structures applied cleanly');

  // 3. Apply baseline CF migrations
  console.log('\n[3/8] Applying CF2 migration...');
  const cf2Sql = readFileSync(cf2MigrationPath, 'utf-8');
  const cf2Res = runPsql(cf2Sql);
  if (!cf2Res.ok) throw new Error(`CF2 migration failed:\n${cf2Res.error}`);
  console.log('  ✓ CF2 migration applied cleanly');

  console.log('\n[4/8] Applying CF3 migration...');
  const cf3Sql = readFileSync(cf3MigrationPath, 'utf-8');
  const cf3Res = runPsql(cf3Sql);
  if (!cf3Res.ok) throw new Error(`CF3 migration failed:\n${cf3Res.error}`);
  console.log('  ✓ CF3 migration applied cleanly');

  console.log('\n[5/8] Applying CF4 migration...');
  const cf4Sql = readFileSync(cf4MigrationPath, 'utf-8');
  const cf4Res = runPsql(cf4Sql);
  if (!cf4Res.ok) throw new Error(`CF4 migration failed:\n${cf4Res.error}`);
  console.log('  ✓ CF4 migration applied cleanly');

  console.log('\n[6/8] Applying CF6 migration...');
  const cf6Sql = readFileSync(cf6MigrationPath, 'utf-8');
  const cf6Res = runPsql(cf6Sql);
  if (!cf6Res.ok) throw new Error(`CF6 migration failed:\n${cf6Res.error}`);
  console.log('  ✓ CF6 migration applied cleanly');

  // 4. Apply CF7 migration
  console.log('\n[7/8] Applying CF7 receipt storage & writer migration...');
  const cf7Sql = readFileSync(cf7MigrationPath, 'utf-8');
  const cf7Res = runPsql(cf7Sql);
  if (!cf7Res.ok) throw new Error(`CF7 migration failed:\n${cf7Res.error}`);
  console.log('  ✓ CF7 migration applied cleanly');

  // 5. Seed test fixtures
  console.log('\n[8/8] Seeding test fixtures and executing CF7 assertions...');
  const branchA = '11111111-1111-1111-1111-111111111111';
  const branchB = '22222222-2222-2222-2222-222222222222';

  const staffCsrUid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const staffCsr2Uid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab';
  const staffBranchBUid = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const staffOwnerUid = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

  const staffCsrId = '00000000-0000-0000-0000-000000000001';
  const staffCsr2Id = '00000000-0000-0000-0000-000000000002';
  const staffBranchBId = '00000000-0000-0000-0000-000000000003';
  const staffOwnerId = '00000000-0000-0000-0000-000000000004';

  const cashDrawerA = '44444444-4444-4444-4444-444444444441';
  const cashDrawerB = '44444444-4444-4444-4444-444444444442';

  const fixturesSql = `
    INSERT INTO public.branches (id, name) VALUES
      ('${branchA}', 'Branch Alpha'),
      ('${branchB}', 'Branch Beta')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.staff (id, auth_user_id, branch_id, full_name, role, system_role) VALUES
      ('${staffCsrId}', '${staffCsrUid}', '${branchA}', 'CSR Alpha One', 'csr', 'csr'),
      ('${staffCsr2Id}', '${staffCsr2Uid}', '${branchA}', 'CSR Alpha Two', 'csr', 'csr'),
      ('${staffBranchBId}', '${staffBranchBUid}', '${branchB}', 'CSR Beta Staff', 'csr', 'csr'),
      ('${staffOwnerId}', '${staffOwnerUid}', NULL, 'Platform Owner', 'owner', 'owner')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.financial_accounts (id, branch_id, name, account_type, identifier_mask, currency, is_active) VALUES
      ('${cashDrawerA}', '${branchA}', 'Alpha Cash Drawer', 'cash_drawer', 'Drawer A', 'PHP', true),
      ('${cashDrawerB}', '${branchB}', 'Beta Cash Drawer', 'cash_drawer', 'Drawer B', 'PHP', true)
    ON CONFLICT (id) DO NOTHING;
  `;
  const seedRes = runPsql(fixturesSql);
  if (!seedRes.ok) throw new Error(`Fixtures seed failed:\n${seedRes.error}`);
  console.log('  ✓ Test fixtures seeded successfully\n');

  const authCsrA = { role: 'authenticated', sub: staffCsrUid };
  const authCsrA2 = { role: 'authenticated', sub: staffCsr2Uid };
  const authCsrB = { role: 'authenticated', sub: staffBranchBUid };
  const authOwner = { role: 'authenticated', sub: staffOwnerUid };
  const authAnon = { role: 'anon', sub: '' };

  const catSupplies = queryJson("SELECT id FROM public.financial_expense_categories WHERE code = 'supplies' LIMIT 1;")[0]?.id;
  if (!catSupplies) throw new Error('Supplies category not found');

  // --- Part A: Bucket Configuration Verification ---
  console.log('--- Part A: Storage Bucket Configuration ---');
  const bucketRow = queryJson("SELECT * FROM storage.buckets WHERE id = 'expense-receipts';")[0];
  assertEqual(bucketRow?.id, 'expense-receipts', 'Bucket id is expense-receipts');
  assertEqual(bucketRow?.public, false, 'Bucket is strictly private (public = false)');
  assertEqual(Number(bucketRow?.file_size_limit), 5242880, 'Bucket file size limit is 5,242,880 bytes (5 MB)');
  const mimes = bucketRow?.allowed_mime_types || [];
  assertEqual(mimes.includes('image/jpeg'), true, 'Allowed MIME includes image/jpeg');
  assertEqual(mimes.includes('image/png'), true, 'Allowed MIME includes image/png');
  assertEqual(mimes.includes('image/webp'), true, 'Allowed MIME includes image/webp');
  assertEqual(mimes.includes('application/pdf'), true, 'Allowed MIME includes application/pdf');
  passedCount++;
  console.log('  ✓ [A.1] Private expense-receipts bucket configured with 5MB limit and allowed MIMEs');

  // --- Part B: Storage RLS & Access Policies ---
  console.log('\n--- Part B: Storage Security & RLS Policies ---');

  // T06: Anonymous upload blocked
  const anonInsert = runPsql(`
    BEGIN;
    SET LOCAL ROLE anon;
    INSERT INTO storage.objects (bucket_id, name, owner_id)
    VALUES ('expense-receipts', '${branchA}/2026/09/rec_test_anon.jpg', 'anon-user');
    COMMIT;
  `);
  assertFailure(anonInsert, 'violates row-level security policy', '[T06] Anonymous upload blocked by RLS');

  // T07: Anonymous select blocked (cannot read receipts)
  const anonSelect = queryJson("SELECT * FROM storage.objects WHERE bucket_id = 'expense-receipts';", authAnon);
  assertEqual(anonSelect.length, 0, '[T07] Anonymous read cannot access private expense receipts');
  passedCount++;
  console.log('  ✓ [T07] Private receipt not publicly readable');

  // Authenticated upload to own branch succeeds
  const objectPathBranchA1 = `${branchA}/2026/09/rec_20260929_alpha01.jpg`;
  const staffUploadRes = runPsql(`
    BEGIN;
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" = '${staffCsrUid}';
    SET LOCAL "request.jwt.claims" = '${JSON.stringify(authCsrA)}';
    INSERT INTO storage.objects (bucket_id, name, owner_id)
    VALUES ('expense-receipts', '${objectPathBranchA1}', '${staffCsrUid}');
    COMMIT;
  `);
  assertSuccess(staffUploadRes, 'Authenticated staff uploads receipt to own branch folder');

  // T05: Cross-branch Storage upload blocked
  const objectPathCrossBranch = `${branchB}/2026/09/rec_20260929_cross.jpg`;
  const crossUploadRes = runPsql(`
    BEGIN;
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" = '${staffCsrUid}';
    SET LOCAL "request.jwt.claims" = '${JSON.stringify(authCsrA)}';
    INSERT INTO storage.objects (bucket_id, name, owner_id)
    VALUES ('expense-receipts', '${objectPathCrossBranch}', '${staffCsrUid}');
    COMMIT;
  `);
  assertFailure(crossUploadRes, 'violates row-level security policy', '[T05] Cross-branch Storage upload blocked by RLS');

  // Authenticated branch staff read isolation
  const staffReadOwnBranch = queryJson(
    `SELECT name FROM storage.objects WHERE bucket_id = 'expense-receipts' AND name = '${objectPathBranchA1}';`,
    authCsrA
  );
  assertEqual(staffReadOwnBranch.length, 1, 'Branch staff can read own branch receipts');
  passedCount++;
  console.log('  ✓ Staff member reads receipt within own branch folder');

  const staffBReadBranchA = queryJson(
    `SELECT name FROM storage.objects WHERE bucket_id = 'expense-receipts' AND name = '${objectPathBranchA1}';`,
    authCsrB
  );
  assertEqual(staffBReadBranchA.length, 0, 'Cross-branch staff cannot read Branch A receipts');
  passedCount++;
  console.log('  ✓ Cross-branch staff read blocked by branch folder RLS');

  // Owner can read across branches
  const ownerRead = queryJson(
    `SELECT name FROM storage.objects WHERE bucket_id = 'expense-receipts' AND name = '${objectPathBranchA1}';`,
    authOwner
  );
  assertEqual(ownerRead.length, 1, 'Platform owner can read receipts across branches');
  passedCount++;
  console.log('  ✓ Owner/admin can read receipts across all branch folders');

  // T13: Orphan cleanup authorization (owner_id check)
  // Staff 2 cannot delete Staff 1's uploaded receipt
  const unauthorizedDelete = runPsql(`
    BEGIN;
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" = '${staffCsr2Uid}';
    SET LOCAL "request.jwt.claims" = '${JSON.stringify(authCsrA2)}';
    DELETE FROM storage.objects WHERE bucket_id = 'expense-receipts' AND name = '${objectPathBranchA1}';
    COMMIT;
  `);
  // DELETE does not throw in postgres if 0 rows matched, but affected rows must be 0!
  const checkStillExists = queryJson(`SELECT name FROM storage.objects WHERE name = '${objectPathBranchA1}';`)[0];
  assertEqual(checkStillExists?.name, objectPathBranchA1, 'Staff 2 cannot delete Staff 1 object due to owner_id check');
  passedCount++;
  console.log('  ✓ Unauthorized deletion blocked: owner_id ownership rule prevents deleting other staff files');

  // Staff 1 CAN delete their own uploaded object (orphan cleanup)
  const staff1Cleanup = runPsql(`
    BEGIN;
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" = '${staffCsrUid}';
    SET LOCAL "request.jwt.claims" = '${JSON.stringify(authCsrA)}';
    DELETE FROM storage.objects WHERE bucket_id = 'expense-receipts' AND name = '${objectPathBranchA1}';
    COMMIT;
  `);
  const checkDeleted = queryJson(`SELECT name FROM storage.objects WHERE name = '${objectPathBranchA1}';`);
  assertEqual(checkDeleted.length, 0, '[T13] Staff 1 successfully cleans up own newly-uploaded receipt');
  passedCount++;
  console.log('  ✓ [T13] Orphan cleanup: uploader deletes own object via owner_id match');

  // --- Part C: Operational Expense Writer with Receipts ---
  console.log('\n--- Part C: Operational Expense Writer (post_expense_atomic) ---');

  // T01: Expense without receipt succeeds
  const keyNoReceipt = `cf7_exp_norec_${Date.now()}`;
  const resNoReceipt = callExpenseRpc(
    authCsrA,
    branchA,
    keyNoReceipt,
    750.50,
    catSupplies,
    cashDrawerA,
    'Paper Supply Co',
    'Receipt paper rolls for front desk',
    'OR-112233',
    '2026-09-29',
    'Purchased cash from local store',
    null // No receipt image path
  );
  assertSuccess(resNoReceipt, '[T01] Expense without receipt succeeds');
  const parsedNoRec = JSON.parse(resNoReceipt.output);
  assertEqual(parsedNoRec.success, true, 'Expense returns success: true');
  assertEqual(parsedNoRec.receiptImagePath, null, 'No receipt path returned');

  // Verify details in DB for no-receipt expense
  const expNoRecDetail = queryJson(`
    SELECT ed.receipt_reference, ed.receipt_image_url, ed.approval_status
    FROM public.financial_expense_details ed
    WHERE ed.transaction_id = '${parsedNoRec.transactionId}';
  `)[0];
  assertEqual(expNoRecDetail.receipt_reference, 'OR-112233', 'Receipt reference persisted');
  assertEqual(expNoRecDetail.receipt_image_url, null, 'receipt_image_url is NULL when omitted');
  assertEqual(expNoRecDetail.approval_status, 'approved_instant', 'Preserves approved_instant status');
  passedCount++;
  console.log('  ✓ [T01b] Expense without receipt properly stored with NULL receipt_image_url');

  // T02: Expense with valid receipt path persists
  const durableReceiptPath = `${branchA}/2026/09/rec_20260929_f9a8b2c1.jpg`;
  const keyWithReceipt = `cf7_exp_withrec_${Date.now()}`;
  const resWithReceipt = callExpenseRpc(
    authCsrA,
    branchA,
    keyWithReceipt,
    1450.00,
    catSupplies,
    cashDrawerA,
    'Clean Linen Services',
    'Towels and linen sanitization',
    'INV-98877',
    '2026-09-29',
    'Delivered and paid from drawer',
    durableReceiptPath
  );
  assertSuccess(resWithReceipt, '[T02] Expense with valid receipt path persists');
  const parsedWithRec = JSON.parse(resWithReceipt.output);
  assertEqual(parsedWithRec.receiptImagePath, durableReceiptPath, 'Receipt path returned in RPC response');

  // T11: Receipt path belongs to correct expense
  const expWithRecDetail = queryJson(`
    SELECT ed.transaction_id, ed.receipt_reference, ed.receipt_image_url, ed.approval_status
    FROM public.financial_expense_details ed
    WHERE ed.transaction_id = '${parsedWithRec.transactionId}';
  `)[0];
  assertEqual(expWithRecDetail.receipt_image_url, durableReceiptPath, '[T11] Durable storage path stored in receipt_image_url');
  passedCount++;
  console.log('  ✓ [T11] Receipt path is associated with exactly the correct expense detail');

  // T08: Exactly one operational_expense transaction created
  const txRows = queryJson(`
    SELECT id, transaction_type, status, business_date, currency, recorded_by
    FROM public.financial_transactions
    WHERE id = '${parsedWithRec.transactionId}';
  `);
  assertEqual(txRows.length, 1, '[T08] Exactly one operational_expense transaction created');
  assertEqual(txRows[0].transaction_type, 'operational_expense', 'Transaction type is operational_expense');
  assertEqual(txRows[0].status, 'posted', 'Transaction status is posted');
  assertEqual(txRows[0].currency, 'PHP', 'Currency is PHP');
  assertEqual(txRows[0].recorded_by, staffCsrId, 'recorded_by is authenticated staff ID');
  passedCount++;
  console.log('  ✓ [T08] Canonical financial transaction header created with posted status');

  // T09: Exactly one signed negative account movement created (-amount)
  const movRows = queryJson(`
    SELECT id, financial_account_id, amount, payment_method, external_reference
    FROM public.financial_account_movements
    WHERE transaction_id = '${parsedWithRec.transactionId}';
  `);
  assertEqual(movRows.length, 1, '[T09] Exactly one account movement created');
  assertEqual(Number(movRows[0].amount), -1450.00, '[T09] Movement amount is signed negative outflow (-1450.00)');
  assertEqual(movRows[0].financial_account_id, cashDrawerA, 'Movement linked to correct financial account');
  assertEqual(movRows[0].payment_method, 'cash', 'Payment method mapped to cash');
  passedCount++;
  console.log('  ✓ [T09] Signed negative account movement correctly posted (-1450.00 PHP)');

  // T10: Idempotent replay creates no duplicate
  const replayRes = callExpenseRpc(
    authCsrA,
    branchA,
    keyWithReceipt, // Same idempotency key
    1450.00,
    catSupplies,
    cashDrawerA,
    'Clean Linen Services',
    'Towels and linen sanitization',
    'INV-98877',
    '2026-09-29',
    'Delivered and paid from drawer',
    durableReceiptPath
  );
  assertSuccess(replayRes, '[T10] Idempotent replay returns success');
  const parsedReplay = JSON.parse(replayRes.output);
  assertEqual(parsedReplay.idempotentReplay, true, 'idempotentReplay is true');
  assertEqual(parsedReplay.transactionId, parsedWithRec.transactionId, 'Replay returns original transactionId');

  // Verify no duplicate transactions or movements
  const totalTxForKey = queryJson(`SELECT COUNT(*) as count FROM public.financial_transactions WHERE idempotency_key = '${keyWithReceipt}';`)[0].count;
  assertEqual(Number(totalTxForKey), 1, 'No duplicate transactions created on replay');
  const totalMovForKey = queryJson(`
    SELECT COUNT(*) as count FROM public.financial_account_movements m
    JOIN public.financial_transactions t ON m.transaction_id = t.id
    WHERE t.idempotency_key = '${keyWithReceipt}';
  `)[0].count;
  assertEqual(Number(totalMovForKey), 1, 'No duplicate movements created on replay');
  passedCount++;
  console.log('  ✓ [T10] Idempotent replay verified: zero duplicate transactions or movements');

  // T12: Pre-post validation failure creates no transaction
  const failedExpenseRes = callExpenseRpc(
    authCsrA,
    branchA,
    `cf7_fail_${Date.now()}`,
    -50.00, // Invalid negative amount
    catSupplies,
    cashDrawerA,
    'Invalid Payee',
    'Should fail',
    null,
    '2026-09-29',
    null,
    null
  );
  assertFailure(failedExpenseRes, 'INVALID_AMOUNT', '[T12] Pre-post failure rejects negative amount');

  // Backward compatibility test: calling post_expense_atomic with 10 positional arguments (omitting 11th)
  const backwardCompatSql = `
    BEGIN;
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" = '${staffCsrUid}';
    SET LOCAL "request.jwt.claims" = '${JSON.stringify(authCsrA)}';
    SELECT public.post_expense_atomic(
      '${branchA}'::uuid,
      'cf7_bkw_${Date.now()}',
      300.00,
      '${catSupplies}'::uuid,
      '${cashDrawerA}'::uuid,
      'Vendor BC',
      'Backward compat 10 args',
      'REF-BC',
      '2026-09-29'::date,
      'Notes BC'
      -- 11th argument p_receipt_image_path omitted entirely!
    ) AS result;
    COMMIT;
  `;
  const bkwRes = runPsql(backwardCompatSql, ['-t', '-A', '-q']);
  assertSuccess(bkwRes, '10-argument call backwards compatibility preserved for existing callers');

  console.log('\n======================================================================');
  console.log(`ALL CF7 DISPOSABLE VERIFICATION ASSERTIONS PASSED (${passedCount} checks passed)`);
  console.log('======================================================================\n');

  if (spawnedContainer) {
    try {
      execSync(`docker rm -f ${containerName}`, { stdio: 'ignore' });
    } catch {}
  }
}

main().catch((err) => {
  console.error('\n❌ CF7 VERIFICATION HARNESS FAILED:');
  console.error(err);
  if (spawnedContainer) {
    try {
      execSync(`docker rm -f ${containerName}`, { stdio: 'ignore' });
    } catch {}
  }
  process.exit(1);
});
