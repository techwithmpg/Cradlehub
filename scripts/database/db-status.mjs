import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  loadLocalEnv,
  printCommandFailure,
  repoRoot,
  runSupabaseWithPassword,
} from "./_shared.mjs";

loadLocalEnv();

const migrationsDir = join(repoRoot, "supabase", "migrations");
const localVersions = existsSync(migrationsDir)
  ? readdirSync(migrationsDir)
      .filter((name) => /^\d{14}_.+\.sql$/.test(name))
      .map((name) => name.slice(0, 14))
      .sort()
  : [];

console.log(`Local migration count: ${localVersions.length}`);

const result = runSupabaseWithPassword(["migration", "list", "--linked", "--dns-resolver", "https"], {
  timeoutMs: 60000,
});

if (!result.ok) {
  printCommandFailure("supabase migration list --linked", "migration history read", result, "no");
  console.log(`Recommended recovery step: run pnpm db:doctor, confirm rotated DB password/local login, then retry pnpm db:status.`);
  process.exit(1);
}

const { remote } = parseMigrationList(result.stdout);
const localSet = new Set(localVersions);
const remoteSet = new Set(remote);
const pendingLocal = localVersions.filter((version) => !remoteSet.has(version));
const remoteOnly = remote.filter((version) => !localSet.has(version));

console.log(`Remote migration count: ${remote.length}`);
console.log(`Pending local migrations: ${pendingLocal.length ? pendingLocal.join(", ") : "none"}`);
console.log(`Remote-only migration versions: ${remoteOnly.length ? remoteOnly.join(", ") : "none"}`);
console.log(`Schema-history mismatch: ${pendingLocal.length || remoteOnly.length ? "yes" : "no"}`);

if (pendingLocal.length || remoteOnly.length) process.exitCode = 2;

function parseMigrationList(output) {
  const local = [];
  const remote = [];

  for (const line of output.split(/\r?\n/)) {
    const versions = [...line.matchAll(/\b(\d{14})\b/g)].map((match) => match[1]);
    if (versions.length === 1) {
      if (/remote/i.test(line) && !/local/i.test(line)) remote.push(versions[0]);
      else local.push(versions[0]);
    }
    if (versions.length >= 2) {
      local.push(versions[0]);
      remote.push(versions[1]);
    }
  }

  return {
    local: [...new Set(local)].sort(),
    remote: [...new Set(remote)].sort(),
  };
}
