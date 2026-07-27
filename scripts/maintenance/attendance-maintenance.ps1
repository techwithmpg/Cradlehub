[CmdletBinding()]
param(
  [ValidateSet("Backup", "EnableInstructions", "DisableInstructions")]
  [string]$Mode = "Backup",
  [string]$RepoRoot = (Join-Path $PSScriptRoot "..\.."),
  [string]$BackupRoot,
  [switch]$FrontDeskConfirmed,
  [switch]$DatabaseGuardVerified
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-ResolvedRepoRoot {
  param([string]$Candidate)

  $resolved = (Resolve-Path -LiteralPath $Candidate).Path
  if (-not (Test-Path -LiteralPath (Join-Path $resolved "package.json") -PathType Leaf)) {
    throw "RepoRoot does not contain package.json: $resolved"
  }
  if (-not (Test-Path -LiteralPath (Join-Path $resolved ".git"))) {
    throw "RepoRoot is not a Git worktree: $resolved"
  }
  return [IO.Path]::GetFullPath($resolved).TrimEnd([IO.Path]::DirectorySeparatorChar)
}

function Show-EnableInstructions {
  if (-not $FrontDeskConfirmed) {
    throw "Confirm the front desk manual arrival/departure procedure, then rerun with -FrontDeskConfirmed."
  }
  if (-not $DatabaseGuardVerified) {
    throw "Production enable is blocked: direct Supabase Attendance cron jobs and booking/schedule triggers cannot read the Vercel flag. Verify an approved database-native guard, then rerun with -DatabaseGuardVerified."
  }

  Write-Host "Vercel Production enable procedure:"
  Write-Host "1. Project > Settings > Environment Variables."
  Write-Host "2. Set ATTENDANCE_MAINTENANCE_MODE=true for Production (server-only)."
  Write-Host "3. Save, then redeploy the current Production release."
  Write-Host "4. Verify the CRM banner, friendly staff scan result, read-only phone controls, and booking/service continuity."
  Write-Host "5. Verify the separately approved database-native guard remains active for direct cron and trigger paths."
  Write-Host "This script has not changed Vercel or deployed anything."
}

function Show-DisableInstructions {
  Write-Host "Vercel Production restore procedure:"
  Write-Host "1. Project > Settings > Environment Variables."
  Write-Host "2. Set ATTENDANCE_MAINTENANCE_MODE=false for Production."
  Write-Host "3. Save, then redeploy the current Production release."
  Write-Host "4. Run one controlled registered-phone scan and confirm normal Attendance-aware availability."
  Write-Host "This script has not changed Vercel or deployed anything."
}

if ($Mode -eq "EnableInstructions") {
  Show-EnableInstructions
  exit 0
}

if ($Mode -eq "DisableInstructions") {
  Show-DisableInstructions
  exit 0
}

$repoPath = Get-ResolvedRepoRoot -Candidate $RepoRoot
$repoParent = Split-Path -Parent $repoPath
$defaultBackupRoot = Join-Path $repoParent "cradlehub-attendance-maintenance-backups"
$backupRootPath = if ([string]::IsNullOrWhiteSpace($BackupRoot)) {
  [IO.Path]::GetFullPath($defaultBackupRoot)
} else {
  [IO.Path]::GetFullPath($BackupRoot)
}

$repoPrefix = $repoPath + [IO.Path]::DirectorySeparatorChar
if ($backupRootPath.StartsWith($repoPrefix, [StringComparison]::OrdinalIgnoreCase) -or
    $backupRootPath.Equals($repoPath, [StringComparison]::OrdinalIgnoreCase)) {
  throw "BackupRoot must be outside the repository: $backupRootPath"
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$bundlePath = Join-Path $backupRootPath "attendance-maintenance-$timestamp"
$snapshotPath = Join-Path $bundlePath "current-files"
New-Item -ItemType Directory -Path $snapshotPath -Force | Out-Null

$head = (& git -C $repoPath rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($head)) {
  throw "Could not resolve the repository HEAD."
}

$trackedChanges = @(
  & git -C $repoPath diff --name-only --diff-filter=ACMR HEAD |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
)
$deletedTracked = @(
  & git -C $repoPath diff --name-only --diff-filter=D HEAD |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
)
$untrackedFiles = @(
  & git -C $repoPath ls-files --others --exclude-standard |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
)

$patchPath = Join-Path $bundlePath "attendance-maintenance.patch"
& git -C $repoPath diff --binary HEAD --output=$patchPath
if ($LASTEXITCODE -ne 0) {
  throw "Could not create the tracked rollback patch."
}

$headFiles = @($trackedChanges + $deletedTracked | Sort-Object -Unique)
if ($headFiles.Count -gt 0) {
  $beforeZip = Join-Path $bundlePath "pre-change-tracked-files.zip"
  & git -C $repoPath archive --format=zip --output=$beforeZip $head -- @headFiles
  if ($LASTEXITCODE -ne 0) {
    throw "Could not archive the pre-change tracked files."
  }
}

$currentFiles = @($trackedChanges + $untrackedFiles | Sort-Object -Unique)
foreach ($relativePath in $currentFiles) {
  $sourcePath = [IO.Path]::GetFullPath((Join-Path $repoPath $relativePath))
  if (-not $sourcePath.StartsWith($repoPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to snapshot a path outside the repository: $relativePath"
  }
  if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
    continue
  }

  $destinationPath = Join-Path $snapshotPath $relativePath
  $destinationDirectory = Split-Path -Parent $destinationPath
  New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
  Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Force
}

$manifestPath = Join-Path $bundlePath "manifest.txt"
$status = @(& git -C $repoPath status --short)
$manifest = @(
  "CradleHub Attendance maintenance external rollback bundle"
  "Created: $((Get-Date).ToString('o'))"
  "Repository: $repoPath"
  "Baseline HEAD: $head"
  ""
  "Tracked files changed from HEAD:"
  ($trackedChanges | ForEach-Object { "  $_" })
  ""
  "Tracked files deleted from HEAD:"
  ($deletedTracked | ForEach-Object { "  $_" })
  ""
  "New files not present at HEAD (review before removing during source rollback):"
  ($untrackedFiles | ForEach-Object { "  $_" })
  ""
  "Git status at backup time:"
  ($status | ForEach-Object { "  $_" })
)
$manifest | Set-Content -LiteralPath $manifestPath -Encoding utf8

$rollbackPath = Join-Path $bundlePath "ROLLBACK.md"
@"
# Rollback notes

Fast operational restore: set `ATTENDANCE_MAINTENANCE_MODE=false` in Vercel Production and redeploy.

Source rollback is manual and must preserve later work:

1. Confirm the worktree still matches this bundle's manifest and baseline.
2. Preserve any changes made after this bundle.
3. Reverse the tracked patch with `git apply --reverse --binary attendance-maintenance.patch` only after review.
4. Review the manifest's new-file list before removing those files.
5. `pre-change-tracked-files.zip` contains the tracked versions from baseline HEAD.
6. `current-files` contains a snapshot of changed and new files at backup time.
7. Run all Node 24 gates before publishing. Do not run database reset, push, or migration repair.
"@ | Set-Content -LiteralPath $rollbackPath -Encoding utf8

Write-Host "External rollback bundle created: $bundlePath"
Write-Host "Baseline HEAD: $head"
Write-Host "No Git push, Vercel change, deployment, or database command was performed."
