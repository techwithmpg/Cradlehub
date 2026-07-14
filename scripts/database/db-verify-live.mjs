import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  loadLocalEnv,
  mask,
  parsePoolerUrl,
  repoRoot,
  statusLine,
} from "./_shared.mjs";
import {
  LIVE_VERIFICATION_TABLES,
  produceSanitizedVerificationReport,
  queryPoolerReadOnly,
  queryLiveDatabaseReadOnly,
  verifyLiveDatabaseConnection,
  verifyTableExists,
} from "./live-verification.mjs";

loadLocalEnv();

try {
  const result = await verifyLiveDatabaseConnection({ timeoutMs: 15_000 });
  statusLine("Live project identity", "PASS", mask(result.projectRef));
  statusLine("Linked read-only SQL", "PASS", `Postgres ${result.database.postgres_version}`);
  statusLine("Database clock", "PASS", "available");
  statusLine("Public schema", "PASS", `${result.database.public_table_count} tables`);
  statusLine("Migration metadata", "PASS", `${result.database.migration_count} recorded versions`);
  statusLine("Anon public REST", result.rls.publicBranchesReadable ? "PASS" : "FAIL");
  statusLine("Anon staff isolation", result.rls.privateStaffRowsVisible ? "FAIL" : "PASS");

  for (const table of LIVE_VERIFICATION_TABLES) {
    statusLine(`REST table ${table}`, verifyTableExists(result.rest, table) ? "PASS" : "FAIL");
  }

  const localVersions = readLocalMigrationVersions();
  const remoteRows = queryLiveDatabaseReadOnly(
    "select version from supabase_migrations.schema_migrations order by version",
    { timeoutMs: 15_000 },
  );
  const remoteVersions = remoteRows.map((row) => String(row.version));
  const remoteSet = new Set(remoteVersions);
  const localSet = new Set(localVersions);
  const pendingLocal = localVersions.filter((version) => !remoteSet.has(version));
  const remoteOnly = remoteVersions.filter((version) => !localSet.has(version));
  statusLine("Local migrations", "PASS", String(localVersions.length));
  statusLine("Remote migrations", "PASS", String(remoteVersions.length));
  statusLine("Migration parity", pendingLocal.length || remoteOnly.length ? "WARNING" : "PASS", `${pendingLocal.length} local-only, ${remoteOnly.length} remote-only`);

  const pooler = parsePoolerUrl();
  statusLine("Pooler configuration", pooler.present && pooler.valid && pooler.tls ? "PASS" : "WARNING", pooler.present ? "configured" : "missing");
  try {
    queryPoolerReadOnly("select now() as database_time", { port: 6543, timeoutMs: 15_000 });
    statusLine("Transaction pooler 6543", "PASS", "read-only SQL available");
  } catch (error) {
    statusLine("Transaction pooler 6543", "WARNING", error instanceof Error ? error.message : "unavailable");
  }
  console.log(JSON.stringify(produceSanitizedVerificationReport({
    ok: true,
    pendingLocalCount: pendingLocal.length,
    remoteOnlyCount: remoteOnly.length,
  })));
  if (result.rest.some((entry) => !entry.readable) || !result.rls.publicBranchesReadable || result.rls.privateStaffRowsVisible) process.exitCode = 1;
} catch (error) {
  statusLine("Live connection", "FAIL", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
}

function readLocalMigrationVersions() {
  const directory = join(repoRoot, "supabase", "migrations");
  if (!existsSync(directory)) return [];
  return [...new Set(readdirSync(directory)
    .filter((name) => /^\d{14}_.+\.sql$/.test(name))
    .map((name) => name.slice(0, 14))
  )].sort();
}
