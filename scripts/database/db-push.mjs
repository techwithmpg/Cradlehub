import { loadLocalEnv, runSupabaseWithPassword, safeError } from "./_shared.mjs";

loadLocalEnv();

const forwardedArgs = process.argv.slice(2).filter((arg) => arg !== "--");
const isDryRun = forwardedArgs.includes("--dry-run");
const result = runSupabaseWithPassword(["db", "push", "--linked", "--dns-resolver", "https", ...forwardedArgs], {
  timeoutMs: 180000,
});

if (!result.ok) {
  console.log("Command: supabase db push --linked");
  console.log("Stage: migration push");
  console.log(`Safe error summary: ${safeError(result)}`);
  console.log(
    `Remote schema changed: ${isDryRun ? "no" : "unknown; inspect Supabase migration output before retrying"}`,
  );
  process.exit(1);
}

process.stdout.write(result.stdout);
