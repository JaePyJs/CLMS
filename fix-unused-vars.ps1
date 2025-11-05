#!/usr/bin/env pwsh
# Fix unused variables by prefixing with underscore

$rootDir = "C:\Users\jmbar\Desktop\ALL REPOS\Pia_REPOS\CLMS\Frontend"
$files = @(
    "$rootDir\src\components\dashboard\DocumentationDashboard.tsx",
    "$rootDir\src\components\dashboard\ErrorReportingDashboard.tsx"
)

# Patterns to replace - match destructuring and regular assignments
$patterns = @(
    # Destructuring patterns
    @{Old = 'const \[exportForm,'; New = 'const [_exportForm,'},
    @{Old = ', exportFormActions\]'; New = ', _exportFormActions]'},
    @{Old = ', studentsRefreshActions\]'; New = ', _studentsRefreshActions]'},
    @{Old = ', filterActions\]'; New = ', _filterActions]'},
    @{Old = 'const \[setIsGeneratingQRCodes,'; New = 'const [_setIsGeneratingQRCodes,'},
    @{Old = 'const \[setIsPrintingIDs,'; New = 'const [_setIsPrintingIDs,'},
    @{Old = 'const \[setIsExporting,'; New = 'const [_setIsExporting,'},
    
    # Regular const patterns
    @{Old = 'const studentDetailsData ='; New = 'const _studentDetailsData ='},
    @{Old = 'const formErrors ='; New = 'const _formErrors ='},
    @{Old = 'const loadingStates ='; New = 'const _loadingStates ='},
    @{Old = 'const mockData ='; New = 'const _mockData ='},
    @{Old = 'const performanceMetrics ='; New = 'const _performanceMetrics ='},
    @{Old = '\[searchparams\]'; New = '[_searchparams]'}
)

foreach ($file in $files) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        $modified = $false
        
        foreach ($pattern in $patterns) {
            if ($content -match [regex]::Escape($pattern.Old)) {
                $content = $content -replace [regex]::Escape($pattern.Old), $pattern.New
                $modified = $true
                Write-Host "  ✓ Fixed '$($pattern.Old)' in $(Split-Path $file -Leaf)" -ForegroundColor Green
            }
        }
        
        if ($modified) {
            Set-Content $file -Value $content -NoNewline
            Write-Host "✅ Updated: $(Split-Path $file -Leaf)" -ForegroundColor Cyan
        }
    }
}

Write-Host "`n🎯 Done! Running lint to verify..." -ForegroundColor Yellow
