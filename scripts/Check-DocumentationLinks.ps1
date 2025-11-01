#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Validates all markdown documentation links in the CLMS project.

.DESCRIPTION
    This script scans all markdown files for broken links, validates that referenced
    files and anchors exist, and generates a report of link health.

.PARAMETER Path
    The root path to search for markdown files. Defaults to current directory.

.PARAMETER Verbose
    If specified, shows all links being checked, not just broken ones.

.PARAMETER ReportPath
    Path where to save the validation report. Defaults to 'docs/reports/'.

.PARAMETER ExitOnError
    If specified, exits with error code 1 if any broken links found.

.EXAMPLE
    .\scripts\Check-DocumentationLinks.ps1 -Path "." -Verbose
    
    Validates all markdown files with verbose output.

.EXAMPLE
    .\scripts\Check-DocumentationLinks.ps1 -Path ".\Docs" -ReportPath ".\reports"
    
    Validates Docs folder and saves report to reports directory.

.NOTES
    Created for CLMS Documentation Maintenance Playbook
    Version: 1.0
    Date: October 17, 2025
#>

param(
    [Parameter(Mandatory=$false)]
    [string]$Path = ".",
    
    [Parameter(Mandatory=$false)]
    [bool]$Verbose = $false,
    
    [Parameter(Mandatory=$false)]
    [string]$ReportPath = "docs/reports",
    
    [Parameter(Mandatory=$false)]
    [bool]$ExitOnError = $false
)

# Color codes for output
$colors = @{
    Success = "Green"
    Error = "Red"
    Warning = "Yellow"
    Info = "Cyan"
    Debug = "Gray"
}

# Initialize counters
$totalLinks = 0
$validLinks = 0
$brokenLinks = @()
$externalLinks = 0
$anchorLinks = 0
$checksPerformed = @{
    Files = 0
    Links = 0
    Anchors = 0
}

# Script start
Write-Host "`n╔══════════════════════════════════════════════════════════════╗" -ForegroundColor $colors.Info
Write-Host "║     CLMS Documentation Link Validation Tool                  ║" -ForegroundColor $colors.Info
Write-Host "║     Version 1.0 | October 17, 2025                          ║" -ForegroundColor $colors.Info
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor $colors.Info

Write-Host "`n[INFO] Starting documentation link validation..." -ForegroundColor $colors.Info
Write-Host "[INFO] Search path: $Path" -ForegroundColor $colors.Info
Write-Host "[INFO] Verbose mode: $Verbose" -ForegroundColor $colors.Info

# Resolve path
$Path = Resolve-Path -Path $Path -ErrorAction Stop

# Find all markdown files
Write-Host "`n[SCANNING] Finding markdown files..." -ForegroundColor $colors.Info

$mdFiles = Get-ChildItem -Path $Path -Filter "*.md" -Recurse -ErrorAction SilentlyContinue | 
    Where-Object { 
        $fullPath = $_.FullName
        -not ($fullPath -match '\\node_modules|\\dist|\\build|\\.git|\\.*')
    }

Write-Host "[INFO] Found $($mdFiles.Count) markdown files" -ForegroundColor $colors.Info
$checksPerformed.Files = $mdFiles.Count

# Process each file
$fileIndex = 0
foreach ($file in $mdFiles) {
    $fileIndex++
    $fileName = $file.Name
    $filePath = $file.FullName
    $fileDir = $file.Directory.FullName
    
    Write-Host "`n[PROCESSING] ($fileIndex/$($mdFiles.Count)) $fileName" -ForegroundColor $colors.Debug
    
    try {
        $content = Get-Content $filePath -Raw -ErrorAction Stop
    }
    catch {
        Write-Host "[ERROR] Failed to read file: $filePath" -ForegroundColor $colors.Error
        continue
    }
    
    # Find all markdown links
    $linkPattern = '\[([^\]]+)\]\(([^)]+)\)'
    $links = [regex]::Matches($content, $linkPattern)
    
    Write-Host "[INFO] Found $($links.Count) links in this file" -ForegroundColor $colors.Debug
    
    foreach ($match in $links) {
        $totalLinks++
        $checksPerformed.Links++
        
        $linkText = $match.Groups[1].Value
        $linkPath = $match.Groups[2].Value
        
        # Categorize link
        if ($linkPath -match '^https?://') {
            # External link - skip validation
            $externalLinks++
            if ($Verbose) {
                Write-Host "  [EXTERNAL] $linkPath" -ForegroundColor $colors.Debug
            }
            $validLinks++
            continue
        }
        
        if ($linkPath -match '^#') {
            # Anchor link - validate anchor exists in current file
            $anchorLinks++
            $anchorName = $linkPath.Substring(1)
            
            # Check if anchor exists (heading with same name)
            $headingPattern = "^#+\s+(.*)$"
            $headingMatches = [regex]::Matches($content, $headingPattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)
            
            $anchorFound = $false
            foreach ($heading in $headingMatches) {
                $headingText = $heading.Groups[1].Value.Trim()
                # Convert heading text to anchor (simple conversion)
                $generatedAnchor = $headingText.ToLower() -replace '[^a-z0-9]', '-' -replace '-+', '-' -replace '^-|-$', ''
                
                if ($generatedAnchor -eq $anchorName) {
                    $anchorFound = $true
                    break
                }
            }
            
            if ($anchorFound) {
                if ($Verbose) {
                    Write-Host "  [ANCHOR-OK] #$anchorName" -ForegroundColor $colors.Success
                }
                $validLinks++
            }
            else {
                Write-Host "  [ANCHOR-BROKEN] #$anchorName in [$linkText]" -ForegroundColor $colors.Error
                $brokenLinks += @{
                    File = $filePath
                    LinkText = $linkText
                    LinkPath = $linkPath
                    Type = "Anchor"
                    Status = "BROKEN"
                }
            }
            $checksPerformed.Anchors++
            continue
        }
        
        # Internal file link
        # Resolve the relative path
        $resolvedPath = $linkPath.Split('#')[0]  # Get path without anchor
        $anchor = if ($linkPath -match '#') { $linkPath.Split('#')[1] } else { $null }
        
        if ([System.IO.Path]::IsPathRooted($resolvedPath)) {
            $fullPath = $resolvedPath
        }
        else {
            $fullPath = Join-Path -Path $fileDir -ChildPath $resolvedPath -ErrorAction SilentlyContinue
        }
        
        if (-not $fullPath) {
            $fullPath = Join-Path -Path $Path -ChildPath $linkPath.Split('#')[0] -ErrorAction SilentlyContinue
        }
        
        # Check if file exists
        if (Test-Path $fullPath -ErrorAction SilentlyContinue) {
            if ($Verbose) {
                Write-Host "  [FILE-OK] $linkPath" -ForegroundColor $colors.Success
            }
            $validLinks++
            
            # If anchor specified, verify it exists
            if ($anchor) {
                $targetContent = Get-Content $fullPath -Raw -ErrorAction SilentlyContinue
                $targetHeadings = [regex]::Matches($targetContent, $headingPattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)
                
                $anchorFound = $false
                foreach ($heading in $targetHeadings) {
                    $headingText = $heading.Groups[1].Value.Trim()
                    $generatedAnchor = $headingText.ToLower() -replace '[^a-z0-9]', '-' -replace '-+', '-' -replace '^-|-$', ''
                    
                    if ($generatedAnchor -eq $anchor) {
                        $anchorFound = $true
                        break
                    }
                }
                
                if (-not $anchorFound) {
                    Write-Host "  [ANCHOR-BROKEN] Anchor #$anchor not found in target file" -ForegroundColor $colors.Error
                    $validLinks--  # Deduct since anchor is broken
                    $brokenLinks += @{
                        File = $filePath
                        LinkText = $linkText
                        LinkPath = $linkPath
                        Type = "Anchor in File"
                        Status = "BROKEN"
                        TargetFile = $fullPath
                    }
                }
            }
        }
        else {
            Write-Host "  [FILE-BROKEN] $linkPath (resolved to: $fullPath)" -ForegroundColor $colors.Error
            $brokenLinks += @{
                File = $filePath
                LinkText = $linkText
                LinkPath = $linkPath
                Type = "File"
                Status = "BROKEN"
            }
        }
    }
}

# Generate report
Write-Host "`n╔══════════════════════════════════════════════════════════════╗" -ForegroundColor $colors.Info
Write-Host "║                    VALIDATION SUMMARY                        ║" -ForegroundColor $colors.Info
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor $colors.Info

Write-Host "`n[STATISTICS]" -ForegroundColor $colors.Info
Write-Host "  Files checked:      $($checksPerformed.Files)" -ForegroundColor $colors.Info
Write-Host "  Total links found:  $totalLinks" -ForegroundColor $colors.Info
Write-Host "  External links:     $externalLinks" -ForegroundColor $colors.Info
Write-Host "  Anchor links:       $anchorLinks" -ForegroundColor $colors.Info
Write-Host "  Valid links:        $validLinks" -ForegroundColor $colors.Success
Write-Host "  Broken links:       $($brokenLinks.Count)" -ForegroundColor $(if ($brokenLinks.Count -gt 0) { $colors.Error } else { $colors.Success })

$healthPercentage = if ($totalLinks -gt 0) { [math]::Round(($validLinks / $totalLinks) * 100, 2) } else { 100 }
Write-Host "  Link health:        $healthPercentage%" -ForegroundColor $(if ($healthPercentage -eq 100) { $colors.Success } else { $colors.Warning })

# Detailed report
if ($brokenLinks.Count -gt 0) {
    Write-Host "`n[BROKEN LINKS DETAILS]" -ForegroundColor $colors.Error
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor $colors.Error
    
    foreach ($brokenLink in $brokenLinks) {
        $relativeFile = $brokenLink.File -replace [regex]::Escape($Path), "."
        Write-Host "`n  File: $relativeFile" -ForegroundColor $colors.Warning
        Write-Host "  Link text: [$($brokenLink.LinkText)]" -ForegroundColor $colors.Info
        Write-Host "  Link path: $($brokenLink.LinkPath)" -ForegroundColor $colors.Error
        Write-Host "  Type: $($brokenLink.Type)" -ForegroundColor $colors.Debug
        if ($brokenLink.TargetFile) {
            Write-Host "  Target: $($brokenLink.TargetFile)" -ForegroundColor $colors.Debug
        }
    }
}

# Save report
if (-not (Test-Path $ReportPath)) {
    New-Item -Path $ReportPath -ItemType Directory -Force | Out-Null
}

$reportFile = Join-Path -Path $ReportPath -ChildPath "link-validation-$(Get-Date -Format 'yyyy-MM-dd-HHmmss').txt"

@"
CLMS Documentation Link Validation Report
Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

SUMMARY
─────────────────────────────────────────
Files checked:        $($checksPerformed.Files)
Total links found:    $totalLinks
External links:       $externalLinks
Anchor links:         $anchorLinks
Valid links:          $validLinks
Broken links:         $($brokenLinks.Count)
Link health:          $healthPercentage%

BROKEN LINKS
─────────────────────────────────────────
$($brokenLinks | ConvertTo-Json -Depth 10)

END OF REPORT
"@ | Out-File -FilePath $reportFile -Encoding UTF8

Write-Host "`n[REPORT] Saved to: $reportFile" -ForegroundColor $colors.Info

# Final status
Write-Host "`n╔══════════════════════════════════════════════════════════════╗" -ForegroundColor $colors.Info

if ($brokenLinks.Count -eq 0) {
    Write-Host "║            ✅ ALL LINKS VALID - VALIDATION PASSED           ║" -ForegroundColor $colors.Success
}
else {
    Write-Host "║            ❌ BROKEN LINKS FOUND - VALIDATION FAILED        ║" -ForegroundColor $colors.Error
}

Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor $colors.Info

# Exit with appropriate code
if ($brokenLinks.Count -gt 0 -and $ExitOnError) {
    Write-Host "`n[EXIT] Exiting with error code 1 due to broken links" -ForegroundColor $colors.Error
    exit 1
}
else {
    Write-Host "`n[EXIT] Validation complete" -ForegroundColor $colors.Info
    exit 0
}