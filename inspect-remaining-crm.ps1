[CmdletBinding()]
param(
    [string[]]$Modules = @("dispatch","today","customers","staff","setup","reconciliation"),
    [switch]$RunVerification,
    [switch]$OpenReport
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Root = (Get-Location).Path
$Src = Join-Path $Root "src"
$ReportDir = Join-Path $Root "docs\system-audit"
$ReportPath = Join-Path $ReportDir "remaining-modules-health.md"

if (-not (Test-Path (Join-Path $Root "package.json"))) {
    throw "Run this script from the project root."
}
if (-not (Test-Path $Src)) {
    throw "Missing src directory."
}

New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

function Get-ModuleFiles {
    param([string]$Module)

    $patterns = @{
        "dispatch"       = @("*dispatch*","*home-service*")
        "today"          = @("*today*","*work-queue*")
        "customers"      = @("*customer*")
        "staff"          = @("*staff*","*staff-availability*")
        "setup"          = @("*setup*","*booking-rules*","*schedule-management*")
        "reconciliation" = @("*reconciliation*","*close-day*")
    }

    $all = Get-ChildItem $Src -Recurse -File -Include *.ts,*.tsx,*.js,*.jsx,*.css,*.scss -ErrorAction SilentlyContinue
    $selected = @()

    foreach ($pattern in $patterns[$Module]) {
        $selected += $all | Where-Object {
            $_.FullName -like $pattern -or $_.DirectoryName -like $pattern
        }
    }

    @($selected | Sort-Object FullName -Unique)
}

function Count-Regex {
    param(
        [System.IO.FileInfo[]]$Files,
        [string]$Pattern
    )

    $count = 0
    foreach ($file in $Files) {
        try {
            $content = Get-Content $file.FullName -Raw
            $count += ([regex]::Matches($content, $Pattern, "IgnoreCase")).Count
        } catch {}
    }
    $count
}

function Has-Regex {
    param(
        [System.IO.FileInfo[]]$Files,
        [string]$Pattern
    )
    (Count-Regex $Files $Pattern) -gt 0
}

function RelPath {
    param([string]$Path)
    $Path.Replace($Root + [IO.Path]::DirectorySeparatorChar, "").Replace("\","/")
}

function Risk-Level {
    param(
        [bool]$Shell,
        [bool]$Toolbar,
        [bool]$Loading,
        [bool]$Empty,
        [bool]$ErrorState,
        [int]$HardColors,
        [int]$InlineStyles,
        [int]$LargeFiles,
        [int]$ClientFiles
    )

    $score = 0
    if (-not $Shell)      { $score += 3 }
    if (-not $Toolbar)    { $score += 2 }
    if (-not $Loading)    { $score += 1 }
    if (-not $Empty)      { $score += 1 }
    if (-not $ErrorState) { $score += 1 }
    if ($HardColors -gt 20) { $score += 2 } elseif ($HardColors -gt 5) { $score += 1 }
    if ($InlineStyles -gt 10) { $score += 2 } elseif ($InlineStyles -gt 0) { $score += 1 }
    if ($LargeFiles -gt 3) { $score += 2 } elseif ($LargeFiles -gt 0) { $score += 1 }
    if ($ClientFiles -gt 15) { $score += 2 } elseif ($ClientFiles -gt 5) { $score += 1 }

    if ($score -ge 10) { return "HIGH" }
    if ($score -ge 5)  { return "MEDIUM" }
    return "LOW"
}

$results = @()

foreach ($module in $Modules) {
    Write-Host ("Auditing {0}..." -f $module) -ForegroundColor Cyan

    $files = Get-ModuleFiles $module
    $totalLines = 0
    $large = @()
    $clientCount = 0

    foreach ($file in $files) {
        try {
            $content = Get-Content $file.FullName -Raw
            $lines = ($content -split "`r?`n").Count
            $totalLines += $lines

            if ($content -match '(^|\r?\n)\s*["'']use client["''];?') {
                $clientCount++
            }

            if ($lines -ge 600) {
                $large += [PSCustomObject]@{
                    File  = RelPath $file.FullName
                    Lines = $lines
                }
            }
        } catch {}
    }

    $usesShell = Has-Regex $files 'crm-operational-page-shell|CrmOperationalPageShell|WorkspacePageShell'
    $usesToolbar = Has-Regex $files 'ToolbarShell'
    $usesSection = Has-Regex $files 'WorkspaceSection'
    $usesNotice = Has-Regex $files 'WorkspaceNotice'
    $usesChip = Has-Regex $files 'ContextChip'

    $hasLoading = Has-Regex $files 'Loading|Skeleton|isLoading|pending'
    $hasEmpty = Has-Regex $files 'EmptyState|No .* found|No .* available|empty state'
    $hasError = Has-Regex $files 'ErrorState|onError|errorMessage|catch\s*\('

    $hardColors = Count-Regex $files '#[0-9a-fA-F]{3,8}\b'
    $inlineStyles = Count-Regex $files 'style\s*=\s*\{\{'
    $arbitraryValues = Count-Regex $files '\[[^\]]+\]'
    $ariaCount = Count-Regex $files 'aria-[a-z-]+='
    $labelCount = Count-Regex $files '<Label|<label|htmlFor='
    $buttonCount = Count-Regex $files '<Button|<button'
    $inputCount = Count-Regex $files '<Input|<input|<Select|<textarea'
    $dialogCount = Count-Regex $files '<Dialog|DialogContent|<Modal|ModalContent'
    $tableCount = Count-Regex $files '<table|<Table'
    $realtimeCount = Count-Regex $files 'supabase\.channel|postgres_changes|realtime'
    $effectCount = Count-Regex $files 'useEffect\s*\('
    $memoCount = Count-Regex $files 'useMemo\s*\(|memo\s*\('
    $dynamicCount = Count-Regex $files 'dynamic\s*\(|import\s*\('

    $risk = Risk-Level `
        -Shell $usesShell `
        -Toolbar $usesToolbar `
        -Loading $hasLoading `
        -Empty $hasEmpty `
        -ErrorState $hasError `
        -HardColors $hardColors `
        -InlineStyles $inlineStyles `
        -LargeFiles $large.Count `
        -ClientFiles $clientCount

    $results += [PSCustomObject]@{
        Module          = $module
        Risk            = $risk
        Files           = $files.Count
        Lines           = $totalLines
        ClientFiles     = $clientCount
        Shell           = $usesShell
        Toolbar         = $usesToolbar
        Section         = $usesSection
        Notice          = $usesNotice
        ContextChip     = $usesChip
        Loading         = $hasLoading
        Empty           = $hasEmpty
        ErrorState      = $hasError
        HardColors      = $hardColors
        InlineStyles    = $inlineStyles
        ArbitraryValues = $arbitraryValues
        Aria            = $ariaCount
        Labels          = $labelCount
        Buttons         = $buttonCount
        Inputs          = $inputCount
        Dialogs         = $dialogCount
        Tables          = $tableCount
        Realtime        = $realtimeCount
        Effects         = $effectCount
        Memos           = $memoCount
        DynamicImports  = $dynamicCount
        LargeFiles      = $large
    }
}

$verification = @()
if ($RunVerification) {
    foreach ($item in @(
        @{ Name = "TypeScript"; Command = "pnpm type-check" },
        @{ Name = "Lint";       Command = "pnpm lint" },
        @{ Name = "Tests";      Command = "pnpm test -- --run" },
        @{ Name = "Build";      Command = "pnpm build" }
    )) {
        Write-Host ""
        Write-Host ("==> {0}" -f $item.Name) -ForegroundColor Cyan
        & powershell -NoProfile -Command $item.Command
        $verification += [PSCustomObject]@{
            Name     = $item.Name
            Passed   = ($LASTEXITCODE -eq 0)
            ExitCode = $LASTEXITCODE
        }
    }
}

$md = @()
$md += "# Remaining CRM Modules Health Report"
$md += ""
$md += ("Generated: {0}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))
$md += ("Project root: {0}" -f $Root)
$md += ("Modules: {0}" -f ($Modules -join ", "))
$md += ""
$md += "This is a static heuristic audit. It does not replace authenticated browser QA."
$md += ""
$md += "## Executive summary"
$md += ""
$md += "| Module | Risk | Files | Lines | Client files | Shell | Toolbar | Loading | Empty | Error |"
$md += "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|"

foreach ($r in $results) {
    $md += ("| {0} | {1} | {2} | {3} | {4} | {5} | {6} | {7} | {8} | {9} |" -f `
        $r.Module,
        $r.Risk,
        $r.Files,
        $r.Lines,
        $r.ClientFiles,
        $(if ($r.Shell) {"Yes"} else {"No"}),
        $(if ($r.Toolbar) {"Yes"} else {"No"}),
        $(if ($r.Loading) {"Yes"} else {"No"}),
        $(if ($r.Empty) {"Yes"} else {"No"}),
        $(if ($r.ErrorState) {"Yes"} else {"No"})
    )
}

foreach ($r in $results) {
    $md += ""
    $md += ("## {0}" -f $r.Module)
    $md += ""
    $md += ("Risk: **{0}**" -f $r.Risk)
    $md += ""
    $md += "### Shared platform"
    $md += ""
    $md += ("- Operational shell: {0}" -f $(if ($r.Shell) {"Yes"} else {"No"}))
    $md += ("- ToolbarShell: {0}" -f $(if ($r.Toolbar) {"Yes"} else {"No"}))
    $md += ("- WorkspaceSection: {0}" -f $(if ($r.Section) {"Yes"} else {"No"}))
    $md += ("- WorkspaceNotice: {0}" -f $(if ($r.Notice) {"Yes"} else {"No"}))
    $md += ("- ContextChip: {0}" -f $(if ($r.ContextChip) {"Yes"} else {"No"}))
    $md += ("- Loading state detected: {0}" -f $(if ($r.Loading) {"Yes"} else {"No"}))
    $md += ("- Empty state detected: {0}" -f $(if ($r.Empty) {"Yes"} else {"No"}))
    $md += ("- Error state detected: {0}" -f $(if ($r.ErrorState) {"Yes"} else {"No"}))
    $md += ""
    $md += "### Static indicators"
    $md += ""
    $md += ("- Files: {0}" -f $r.Files)
    $md += ("- Total lines: {0}" -f $r.Lines)
    $md += ("- Client component files: {0}" -f $r.ClientFiles)
    $md += ("- Hardcoded hex colors: {0}" -f $r.HardColors)
    $md += ("- Inline style objects: {0}" -f $r.InlineStyles)
    $md += ("- Tailwind arbitrary-value indicators: {0}" -f $r.ArbitraryValues)
    $md += ("- ARIA attributes: {0}" -f $r.Aria)
    $md += ("- Label references: {0}" -f $r.Labels)
    $md += ("- Buttons: {0}" -f $r.Buttons)
    $md += ("- Inputs/selects: {0}" -f $r.Inputs)
    $md += ("- Dialog references: {0}" -f $r.Dialogs)
    $md += ("- Table references: {0}" -f $r.Tables)
    $md += ("- Realtime references: {0}" -f $r.Realtime)
    $md += ("- useEffect references: {0}" -f $r.Effects)
    $md += ("- memo/useMemo references: {0}" -f $r.Memos)
    $md += ("- Dynamic import references: {0}" -f $r.DynamicImports)
    $md += ""
    $md += "### Large files"
    $md += ""
    if ($r.LargeFiles.Count -eq 0) {
        $md += "- None detected at 600+ lines."
    } else {
        foreach ($large in ($r.LargeFiles | Sort-Object Lines -Descending)) {
            $md += ("- {0} - {1} lines" -f $large.File, $large.Lines)
        }
    }
    $md += ""
    $md += "### Recommended Codex focus"
    $md += ""
    if (-not $r.Shell) { $md += "- Evaluate migration to the certified operational shell." }
    if (-not $r.Toolbar) { $md += "- Audit local search/filter controls against ToolbarShell, ToolbarSearch, and ToolbarSelect." }
    if (-not $r.Section) { $md += "- Audit repeated card wrappers against WorkspaceSection." }
    if (-not $r.Loading) { $md += "- Confirm a consistent loading state exists." }
    if (-not $r.Empty) { $md += "- Confirm every primary list has a meaningful empty state." }
    if (-not $r.ErrorState) { $md += "- Confirm visible and recoverable error states." }
    if ($r.HardColors -gt 5) { $md += "- Review hardcoded colors for theme-token drift." }
    if ($r.InlineStyles -gt 0) { $md += "- Review inline styles for duplicate layout rules." }
    if ($r.LargeFiles.Count -gt 0) { $md += "- Document responsibilities of large files before extraction." }
    if ($r.Buttons -gt 0 -and $r.Aria -eq 0) { $md += "- Manually inspect icon-only controls for accessible names." }
    if ($r.Inputs -gt 0 -and $r.Labels -eq 0) { $md += "- Manually inspect form fields for labels." }
}

if ($RunVerification) {
    $md += ""
    $md += "## Verification"
    $md += ""
    $md += "| Check | Result | Exit code |"
    $md += "|---|---:|---:|"
    foreach ($v in $verification) {
        $md += ("| {0} | {1} | {2} |" -f $v.Name, $(if ($v.Passed) {"PASS"} else {"FAIL"}), $v.ExitCode)
    }
}

Set-Content -Path $ReportPath -Value $md -Encoding UTF8

Write-Host ""
Write-Host "CRM module audit complete." -ForegroundColor Green
Write-Host ("Report: {0}" -f $ReportPath) -ForegroundColor Cyan
Write-Host ""

$results |
    Select-Object Module,Risk,Files,Lines,ClientFiles,Shell,Toolbar,Loading,Empty,ErrorState |
    Format-Table -AutoSize

if ($OpenReport) {
    Invoke-Item $ReportPath
}
