import { loadLocalEnv, runSupabase, safeError } from "./_shared.mjs";

loadLocalEnv();

const name = process.argv.slice(2).join(" ").trim();
if (!name) {
  console.log("Usage: pnpm db:migration <descriptive-name>");
  process.exit(1);
}

const result = runSupabase(["migration", "new", name], { timeoutMs: 30000 });
if (!result.ok) {
  console.log("Command: supabase migration new");
  console.log("Stage: local migration creation");
  console.log(`Safe error summary: ${safeError(result)}`);
  console.log("Remote schema changed: no");
  process.exit(1);
}

process.stdout.write(result.stdout);
