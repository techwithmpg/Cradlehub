#!/usr/bin/env node
/**
 * CF8-B1/B2: Canonical Cash Session Foundation & Open Session Writer Verification Harness
 * Reproducible Disposable Database Verification Harness
 *
 * Program: CradleHub Web — CONTROLLED STABILIZATION
 * Stage: CF8-B1/B2 — CANONICAL CASH SESSION FOUNDATION + SERVER/READ WIRING
 * Authority: CradleHub_CF1_Financial_Contract_Freeze.md / CF8 Invariants
 *
 * Test Scenarios:
 *   T01: Unauthenticated open denied (AUTH_REQUIRED)
 *   T02: Inactive staff denied (STAFF_INACTIVE)
 *   T03: Unauthorized branch denied (BRANCH_UNAUTHORIZED)
 *   T04: Missing drawer denied (ACCOUNT_NOT_FOUND)
 *   T05: Inactive drawer denied (ACCOUNT_INACTIVE)
 *   T06: Non-cash account denied (ACCOUNT_INVALID_TYPE)
 *   T07: Wrong-branch drawer denied (ACCOUNT_BRANCH_MISMATCH)
 *   T08: Negative opening float denied (INVALID_OPENING_FLOAT)
 *   T09: Valid zero opening float accepted
 *   T10: Valid positive opening float accepted
 *   T11: Opening creates NO financial transaction
 *   T12: Opening creates NO financial account movement
 *   T13: Duplicate open on same drawer denied (DRAWER_ALREADY_OPEN / uq_cash_sessions_open_drawer)
 *   T14: Same idempotency key safely replays
 *   T15: Conflicting idempotency payload denied (IDEMPOTENCY_PAYLOAD_MISMATCH)
 *   T16: Second branch cannot read unauthorized session (RLS isolation)
 *   T17: Authorized branch staff can read own session (RLS)
 *   T18: Expected cash = opening float + signed drawer movements
 *   T19: Drawer → bank transfer reduces expected cash
 *   T20: Bank → drawer transfer increases expected cash
 *   T21: Other-account movement does not alter expected drawer cash
 *   T22: Reversed/voided transaction is excluded
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

const containerName = process.env.CF8_TEST_CONTAINER || `cf8-test-db-${Date.now()}`;
let spawnedContainer = false;

function runPsql(sql, extraFlags = []) {
  try {
    const flagsStr = extraFlags.length > 0 ? ` ${extraFlags.join(' ')}` : '';
    const res = execSync(
      `docker exec -i ${containerName} psql -v ON_ERROR_STOP=1 -U supabase_admin -d postgres${flagsStr}`,
      { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return { ok: true, output: res.trim() };
  } catch (err) {
    return { ok: false, error: err.stderr ? err.stderr.toString() : err.message };
  }
}

export function printTestPlan() {
  console.log('CF8-B1/B2 Test Coverage Plan (T01 - T22):');
  const scenarios = [
    'T01: Unauthenticated open denied (AUTH_REQUIRED)',
    'T02: Inactive staff denied (STAFF_INACTIVE)',
    'T03: Unauthorized branch denied (BRANCH_UNAUTHORIZED)',
    'T04: Missing drawer denied (ACCOUNT_NOT_FOUND)',
    'T05: Inactive drawer denied (ACCOUNT_INACTIVE)',
    'T06: Non-cash account denied (ACCOUNT_INVALID_TYPE)',
    'T07: Wrong-branch drawer denied (ACCOUNT_BRANCH_MISMATCH)',
    'T08: Negative opening float denied (INVALID_OPENING_FLOAT)',
    'T09: Valid zero opening float accepted',
    'T10: Valid positive opening float accepted',
    'T11: Opening creates NO financial transaction (operational state only)',
    'T12: Opening creates NO financial account movement (operational state only)',
    'T13: Duplicate open on same drawer denied (partial unique index)',
    'T14: Same idempotency key safely replays identical session payload',
    'T15: Conflicting idempotency payload denied (IDEMPOTENCY_PAYLOAD_MISMATCH)',
    'T16: Second branch cannot read unauthorized session (RLS isolation)',
    'T17: Authorized branch staff can read own session (RLS)',
    'T18: Expected cash = opening float + signed drawer movements',
    'T19: Drawer → bank transfer reduces expected cash',
    'T20: Bank → drawer transfer increases expected cash',
    'T21: Other-account movement does not alter expected drawer cash',
    'T22: Reversed/voided transaction is excluded from expected cash',
  ];
  for (const s of scenarios) {
    console.log(`  - ${s}`);
  }
}

if (process.argv.includes('--plan')) {
  printTestPlan();
  process.exit(0);
}

console.log('CF8-B1/B2 Verification Harness defined.');
console.log('Note: Full test suite execution is deferred until full CF8 assembly (per instructions).');
