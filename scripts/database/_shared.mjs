import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(__dirname, "..", "..");

const LOCAL_ENV_FILES = [".env.local", ".env.database.local"];

export function loadLocalEnv() {
  for (const name of LOCAL_ENV_FILES) {
    const filePath = join(repoRoot, name);
    if (!existsSync(filePath)) continue;

    const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const index = trimmed.indexOf("=");
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

export function supabaseBin() {
  if (process.platform === "win32") {
    const localExe = join(repoRoot, "node_modules", "supabase", "bin", "supabase.exe");
    if (existsSync(localExe)) return localExe;
  }

  const command = process.platform === "win32" ? "supabase.CMD" : "supabase";
  const localBin = join(repoRoot, "node_modules", ".bin", command);
  return existsSync(localBin) ? localBin : command;
}

export function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false,
    timeout: options.timeoutMs ?? 45000,
    env: process.env,
  });

  return {
    ok: result.status === 0,
    status: result.status,
    stdout: redact(result.stdout ?? ""),
    stderr: redact(result.stderr ?? ""),
    error: result.error ? redact(result.error.message) : "",
  };
}

export function runSupabase(args, options = {}) {
  return runCommand(supabaseBin(), args, options);
}

export function runSupabaseWithPassword(args, options = {}) {
  const password = process.env.SUPABASE_DB_PASSWORD;
  const nextArgs = password ? [...args, "--password", password] : args;
  return runSupabase(nextArgs, options);
}

export function statusLine(label, status, detail = "") {
  const suffix = detail ? `  ${detail}` : "";
  console.log(`${label.padEnd(28)} ${status}${suffix}`);
}

export function safeError(result) {
  const text = [result.error, result.stderr, result.stdout].filter(Boolean).join("\n").trim();
  if (!text) return "no output";
  return text.split(/\r?\n/).slice(0, 4).join(" | ");
}

export function getLinkedProjectRef() {
  const filePath = join(repoRoot, "supabase", ".temp", "project-ref");
  if (!existsSync(filePath)) return "";
  return readFileSync(filePath, "utf8").trim();
}

export function configuredProjectRef() {
  return process.env.SUPABASE_PROJECT_REF || getLinkedProjectRef() || projectRefFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function projectRefFromUrl(value) {
  if (!value) return "";
  try {
    const host = new URL(value).hostname;
    const [first] = host.split(".");
    return first || "";
  } catch {
    return "";
  }
}

export function mask(value) {
  if (!value) return "missing";
  if (value.length <= 8) return "set";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function parsePoolerUrl() {
  const raw = process.env.SUPABASE_DB_POOLER_URL;
  if (!raw) return { present: false };
  try {
    const parsed = new URL(raw);
    return {
      present: true,
      valid: parsed.protocol === "postgresql:" || parsed.protocol === "postgres:",
      host: parsed.hostname,
      port: parsed.port,
      user: parsed.username,
      tls: parsed.searchParams.get("sslmode") === "require" || parsed.searchParams.get("ssl") === "true",
    };
  } catch {
    return { present: true, valid: false };
  }
}

export function commandExists(command) {
  const checker = process.platform === "win32" ? "where.exe" : "which";
  const args = [command];
  return runCommand(checker, args, { timeoutMs: 10000 }).ok;
}

export function redact(text) {
  let output = text;
  const sensitiveKeys = [
    "SUPABASE_ACCESS_TOKEN",
    "SUPABASE_DB_PASSWORD",
    "SUPABASE_DB_POOLER_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "DATABASE_URL",
  ];

  for (const key of sensitiveKeys) {
    const value = process.env[key];
    if (value && value.length > 3) {
      output = output.split(value).join("[redacted]");
    }
  }

  return output
    .replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, "postgresql://[redacted]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted-jwt]");
}

export function printCommandFailure(command, stage, result, remoteChanged = "no") {
  console.log(`Command: ${command}`);
  console.log(`Stage: ${stage}`);
  console.log(`Safe error summary: ${safeError(result)}`);
  console.log(`Remote schema changed: ${remoteChanged}`);
}
