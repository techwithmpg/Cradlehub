import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { loadLocalEnv, repoRoot, runSupabase, safeError } from "./_shared.mjs";

loadLocalEnv();

const destination = join(repoRoot, "src", "types", "supabase.ts");
const temporary = `${destination}.tmp`;

const result = runSupabase(["gen", "types", "typescript", "--linked"], { timeoutMs: 120000 });

if (!result.ok) {
  console.log("Command: supabase gen types typescript --linked");
  console.log("Stage: linked type generation");
  console.log(`Safe error summary: ${safeError(result)}`);
  console.log("Remote schema changed: no");
  process.exit(1);
}

const output = result.stdout.trimEnd();
if (!output || !output.includes("export type Database")) {
  console.log("Command: supabase gen types typescript --linked");
  console.log("Stage: generated type validation");
  console.log("Safe error summary: CLI returned empty or unexpected TypeScript output");
  console.log("Remote schema changed: no");
  process.exit(1);
}

mkdirSync(dirname(destination), { recursive: true });
writeFileSync(temporary, `${output}\n`, "utf8");
if (existsSync(destination)) rmSync(destination);
renameSync(temporary, destination);

console.log(`Generated Supabase types: ${destination}`);
