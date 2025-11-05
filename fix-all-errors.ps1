# Comprehensive Error Fixing Script for CLMS
# This script systematically fixes lint errors and warnings

Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "CLMS Error & Warning Fixing Script" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Function to run command and show output
function Run-Command {
    param($Command, $Description)
    Write-Host "`n▶ $Description" -ForegroundColor Yellow
    Write-Host "  Command: $Command" -ForegroundColor Gray
    Invoke-Expression $Command
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Success" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Command had warnings/errors" -ForegroundColor Red
    }
}

# Step 1: Fix Backend auto-fixable issues
Write-Host "`n[1/5] Fixing Backend auto-fixable issues..." -ForegroundColor Magenta
Push-Location "Backend"
Run-Command "npx eslint src/**/*.ts --fix" "Running ESLint --fix on Backend"
Pop-Location

# Step 2: Fix Frontend auto-fixable issues  
Write-Host "`n[2/5] Fixing Frontend auto-fixable issues..." -ForegroundColor Magenta
Push-Location "Frontend"
Run-Command "npx eslint . --ext ts,tsx --fix" "Running ESLint --fix on Frontend"
Pop-Location

# Step 3: Show remaining Backend issues
Write-Host "`n[3/5] Checking remaining Backend issues..." -ForegroundColor Magenta
Push-Location "Backend"
Write-Host "`nRemaining Backend warnings/errors:" -ForegroundColor Cyan
npm run lint 2>&1 | Select-String -Pattern "warning|error" | Select-Object -First 30
Pop-Location

# Step 4: Show remaining Frontend issues
Write-Host "`n[4/5] Checking remaining Frontend issues..." -ForegroundColor Magenta
Push-Location "Frontend"
Write-Host "`nRemaining Frontend warnings/errors:" -ForegroundColor Cyan
npm run lint 2>&1 | Select-String -Pattern "warning|error" | Select-Object -First 30
Pop-Location

# Step 5: Summary
Write-Host "`n═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Auto-fix Complete!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "`nNext steps for remaining issues:" -ForegroundColor Yellow
Write-Host "  1. Fix App.tsx React Hooks violations (move hooks before conditional returns)" -ForegroundColor White
Write-Host "  2. Remove duplicate imports" -ForegroundColor White  
Write-Host "  3. Replace 'any' types with proper TypeScript types" -ForegroundColor White
Write-Host "  4. Remove unnecessary type assertions" -ForegroundColor White
Write-Host "  5. Fix promise handling (add await/catch)" -ForegroundColor White
Write-Host ""
