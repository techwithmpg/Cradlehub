import { existsSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const prettierBaseline = "b4192d811e95a4fef73624548df634aebfd77a3f";
const mode = process.argv[2] === "--write" ? "--write" : "--check";
const supportedExtensions = new Set([
  ".cjs",
  ".css",
  ".js",
  ".json",
  ".jsx",
  ".mjs",
  ".mts",
  ".scss",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);
const excludedPrefixes = [
  ".agents/",
  ".claude/",
  ".codex-artifacts/",
  ".context/",
  ".next/",
  ".tmp/",
  "deliverables/",
  "docs/",
  "node_modules/",
  "project-brain/",
  "supabase/",
];

function runGit(args, allowFailure = false) {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false,
  });
  if (!allowFailure && result.status !== 0) {
    process.stderr.write(result.stderr || `git ${args.join(" ")} failed.\n`);
    process.exit(result.status ?? 1);
  }
  return result;
}

function splitNullDelimited(output) {
  return output.split("\0").filter(Boolean);
}

function baselinePaths() {
  const baselineExists =
    runGit(["cat-file", "-e", `${prettierBaseline}^{commit}`], true).status === 0;
  if (baselineExists) {
    return splitNullDelimited(
      runGit(["diff", "--name-only", "--diff-filter=ACMR", "-z", `${prettierBaseline}...HEAD`])
        .stdout
    );
  }

  return splitNullDelimited(
    runGit(["diff-tree", "--no-commit-id", "--name-only", "--diff-filter=ACMR", "-r", "-z", "HEAD"])
      .stdout
  );
}

function workingTreePaths() {
  return [
    ...splitNullDelimited(runGit(["diff", "--name-only", "--diff-filter=ACMR", "-z"]).stdout),
    ...splitNullDelimited(
      runGit(["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"]).stdout
    ),
    ...splitNullDelimited(runGit(["ls-files", "--others", "--exclude-standard", "-z"]).stdout),
  ];
}

const files = [...new Set([...baselinePaths(), ...workingTreePaths()])]
  .map((path) => path.replaceAll("\\", "/"))
  .filter((path) => supportedExtensions.has(extname(path).toLowerCase()))
  .filter((path) => !excludedPrefixes.some((prefix) => path.startsWith(prefix)))
  .filter((path) => existsSync(join(repoRoot, path)))
  .sort();

if (files.length === 0) {
  console.log("No incremental JavaScript/TypeScript/config files require a formatting check.");
  process.exit(0);
}

console.log(
  `${mode === "--write" ? "Formatting" : "Checking"} ${files.length} incremental code/config files since ${prettierBaseline.slice(0, 8)}.`
);

const prettierCli = join(repoRoot, "node_modules", "prettier", "bin", "prettier.cjs");
let failed = false;
for (let index = 0; index < files.length; index += 75) {
  const chunk = files.slice(index, index + 75);
  const result = spawnSync(process.execPath, [prettierCli, mode, ...chunk], {
    cwd: repoRoot,
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) failed = true;
}

if (failed) process.exit(1);
