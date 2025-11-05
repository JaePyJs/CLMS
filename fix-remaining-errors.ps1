#!/usr/bin/env pwsh
# Comprehensive error fixer for remaining lint issues

$rootDir = "C:\Users\jmbar\Desktop\ALL REPOS\Pia_REPOS\CLMS\Frontend\src"
$totalFixed = 0

Write-Host "`n🔍 Finding and fixing duplicate imports..." -ForegroundColor Cyan

# Get all TypeScript files
$files = Get-ChildItem -Path $rootDir -Recurse -Filter "*.tsx" -File

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    $modified = $false
    
    # Fix patterns that can be auto-merged
    # Pattern 1: Duplicate react imports on consecutive lines
    if ($content -match "import\s+React[^;]+from\s+['"'"]react['"'""];?\s*\nimport\s+[^;]+from\s+['"'"]react['"'""];?") {
        $lines = $content -split "`n"
        $newLines = @()
        $skipNext = $false
        
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($skipNext) {
                $skipNext = $false
                continue
            }
            
            $line = $lines[$i]
            
            # Check if this is a react import and next line is also react import
            if ($i -lt $lines.Count - 1 -and 
                $line -match "^import\s+.*from\s+['"'"]react['"'""];?\s*$" -and
                $lines[$i + 1] -match "^import\s+.*from\s+['"'"]react['"'""];?\s*$") {
                
                # Extract imports from both lines
                $import1 = $line -replace "^import\s+", "" -replace "\s+from\s+['"'"]react['"'""];?\s*$", ""
                $import2 = $lines[$i + 1] -replace "^import\s+", "" -replace "\s+from\s+['"'"]react['"'""];?\s*$", ""
                
                # Merge them
                $merged = "import $import1, $import2 from 'react';"
                $newLines += $merged
                $skipNext = $true
                $modified = $true
                Write-Host "  ✓ Merged react imports in $($file.Name)" -ForegroundColor Green
            }
            else {
                $newLines += $line
            }
        }
        
        if ($modified) {
            $content = $newLines -join "`n"
        }
    }
    
    # Pattern 2: Prefix unused function parameters with underscore
    $patterns = @(
        @{Pattern = '\bonOpenChange\b(?=[:,])'; Replacement = '_onOpenChange'},
        @{Pattern = '\bonValueChange\b(?=[:,])'; Replacement = '_onValueChange'},
        @{Pattern = 'const \[([^,]+), (setIsGeneratingQRCodes|setIsPrintingIDs|setIsExporting)\]'; Replacement = 'const [$1, _$2]'}
    )
    
    foreach ($pattern in $patterns) {
        if ($content -match $pattern.Pattern) {
            $newContent = $content -replace $pattern.Pattern, $pattern.Replacement
            if ($newContent -ne $content) {
                $content = $newContent
                $modified = $true
                Write-Host "  ✓ Fixed unused param/var in $($file.Name)" -ForegroundColor Green
            }
        }
    }
    
    if ($modified) {
        Set-Content $file.FullName -Value $content -NoNewline
        $totalFixed++
    }
}

Write-Host "`n✅ Modified $totalFixed files" -ForegroundColor Green
Write-Host "`n🧹 Running lint to verify..." -ForegroundColor Yellow

cd "C:\Users\jmbar\Desktop\ALL REPOS\Pia_REPOS\CLMS\Frontend"
$lintResult = npm run lint 2>&1 | Out-String
$problemLine = $lintResult -split "`n" | Where-Object { $_ -match "(\d+) problems" }

if ($problemLine) {
    Write-Host $problemLine -ForegroundColor Cyan
}
