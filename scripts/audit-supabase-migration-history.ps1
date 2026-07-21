[CmdletBinding()]
param(
  [Parameter(Mandatory = $false)]
  [string]$ProjectRoot = (Get-Location).Path,
  [string]$LiveHistoryPath,
  [string]$ReportPath
)

$resolvedRoot = Resolve-Path -LiteralPath $ProjectRoot -ErrorAction Stop
$migrationRoot = Join-Path $resolvedRoot 'supabase\migrations'
if (-not (Test-Path -LiteralPath $migrationRoot -PathType Container)) {
  throw "Invalid ProjectRoot: no supabase\migrations directory exists at '$resolvedRoot'."
}

$migrations = Get-ChildItem -LiteralPath $migrationRoot -File -Filter '*.sql' |
  ForEach-Object {
    if ($_.Name -match '^(\d+)_') {
      [pscustomobject]@{ Version = $Matches[1]; File = $_.FullName; Name = $_.Name }
    }
  } | Sort-Object Version, Name

$duplicates = $migrations | Group-Object Version | Where-Object Count -gt 1
$lines = [System.Collections.Generic.List[string]]::new()
$lines.Add("Supabase migration history audit")
$lines.Add("Project root: $resolvedRoot")
$lines.Add("Repository migrations: $($migrations.Count)")
$lines.Add("Duplicate numeric prefixes: $($duplicates.Count)")
foreach ($group in $duplicates) {
  $lines.Add("")
  $lines.Add("Duplicate version $($group.Name):")
  foreach ($item in $group.Group) { $lines.Add("  $($item.Name)") }
}

if ($LiveHistoryPath) {
  $resolvedLive = Resolve-Path -LiteralPath $LiveHistoryPath -ErrorAction Stop
  $liveVersions = Get-Content -LiteralPath $resolvedLive |
    Select-String -AllMatches -Pattern '(?<!\d)(\d{8,20})(?!\d)' |
    ForEach-Object { $_.Matches } | ForEach-Object { $_.Groups[1].Value } |
    Sort-Object -Unique
  $repositoryVersions = $migrations.Version | Sort-Object -Unique
  $lines.Add("")
  $lines.Add("Live versions parsed: $($liveVersions.Count)")
  $lines.Add("Repository-only versions:")
  foreach ($version in ($repositoryVersions | Where-Object { $_ -notin $liveVersions })) { $lines.Add("  $version") }
  $lines.Add("Live-only versions:")
  foreach ($version in ($liveVersions | Where-Object { $_ -notin $repositoryVersions })) { $lines.Add("  $version") }
}

$report = $lines -join [Environment]::NewLine
if ($ReportPath) { Set-Content -LiteralPath $ReportPath -Value $report -Encoding utf8 }
$report
