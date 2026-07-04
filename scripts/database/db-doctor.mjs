import {
  configuredProjectRef,
  getLinkedProjectRef,
  loadLocalEnv,
  mask,
  parsePoolerUrl,
  runSupabase,
  runSupabaseWithPassword,
  safeError,
  statusLine,
} from "./_shared.mjs";

loadLocalEnv();

let hasFailure = false;
let hasWarning = false;

function pass(label, detail = "") {
  statusLine(label, "PASS", detail);
}

function warn(label, detail = "") {
  hasWarning = true;
  statusLine(label, "WARNING", detail);
}

function fail(label, detail = "") {
  hasFailure = true;
  statusLine(label, "FAIL", detail);
}

const version = runSupabase(["--version"], { timeoutMs: 30000 });
if (version.ok) pass("Supabase CLI", version.stdout.trim());
else fail("Supabase CLI", safeError(version));

const configuredRef = configuredProjectRef();
const linkedRef = getLinkedProjectRef();

if (process.env.SUPABASE_PROJECT_REF) pass("Configured project ref", mask(process.env.SUPABASE_PROJECT_REF));
else warn("Configured project ref", "SUPABASE_PROJECT_REF is not set; using linked/app URL fallback where possible");

if (linkedRef) pass("Linked project", mask(linkedRef));
else fail("Linked project", "supabase/.temp/project-ref is missing; run pnpm db:link after setting local secrets");

if (configuredRef && linkedRef && configuredRef !== linkedRef) {
  fail("Project identity match", `configured ${mask(configuredRef)} does not match linked ${mask(linkedRef)}`);
} else if (configuredRef && linkedRef) {
  pass("Project identity match", mask(linkedRef));
} else {
  warn("Project identity match", "not enough local metadata to compare");
}

if (process.env.SUPABASE_ACCESS_TOKEN) pass("CLI access token", "set");
else warn("CLI access token", "SUPABASE_ACCESS_TOKEN is not set; cached interactive login may still work");

if (process.env.SUPABASE_DB_PASSWORD) warn("DB password", "set locally; rotate any password previously pasted into chat before trusting it");
else warn("DB password", "SUPABASE_DB_PASSWORD is not set; linked CLI commands may prompt or fail");

const pooler = parsePoolerUrl();
if (!pooler.present) {
  warn("Pooler URL", "SUPABASE_DB_POOLER_URL is not set");
} else if (!pooler.valid) {
  fail("Pooler URL", "value is not a valid PostgreSQL URL");
} else if (!pooler.tls) {
  fail("Pooler TLS", "add sslmode=require or ssl=true");
} else {
  pass("Pooler URL", `${pooler.host}:${pooler.port || "default"} as ${pooler.user ? "configured user" : "missing user"}`);
}

const migrationList = runSupabaseWithPassword(["migration", "list", "--linked", "--dns-resolver", "https"], {
  timeoutMs: 45000,
});
if (migrationList.ok) pass("Migration history", "linked migration list is readable");
else warn("Migration history", safeError(migrationList));

const typesProbe = runSupabase(["gen", "types", "typescript", "--help"], { timeoutMs: 30000 });
if (typesProbe.ok) pass("Type generation", "CLI supports linked TypeScript generation");
else fail("Type generation", safeError(typesProbe));

if (hasFailure) process.exit(1);
if (hasWarning) process.exitCode = 2;
