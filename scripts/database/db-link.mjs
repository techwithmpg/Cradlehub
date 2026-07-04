import { configuredProjectRef, loadLocalEnv, mask, runSupabaseWithPassword, safeError } from "./_shared.mjs";

loadLocalEnv();

const projectRef = process.env.SUPABASE_PROJECT_REF || configuredProjectRef();

if (!projectRef) {
  console.log("Command: supabase link");
  console.log("Stage: project ref lookup");
  console.log("Safe error summary: SUPABASE_PROJECT_REF is not set and no linked project metadata exists");
  console.log("Remote schema changed: no");
  process.exit(1);
}

const result = runSupabaseWithPassword(["link", "--project-ref", projectRef, "--dns-resolver", "https"], {
  timeoutMs: 120000,
});

if (!result.ok) {
  console.log("Command: supabase link --project-ref [masked]");
  console.log("Stage: project link");
  console.log(`Safe error summary: ${safeError(result)}`);
  console.log("Remote schema changed: no");
  process.exit(1);
}

console.log(`Linked Supabase project: ${mask(projectRef)}`);
