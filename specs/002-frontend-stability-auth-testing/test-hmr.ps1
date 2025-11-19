# HMR Stress Test Script
# Tests Hot Module Replacement stability by making 20+ file changes

Write-Host "=== Frontend Stability Test - HMR Stress Testing ===" -ForegroundColor Cyan
Write-Host "Target: 20+ HMR triggers without crashes" -ForegroundColor Yellow
Write-Host ""

$testFile = "c:\Users\jmbar\Desktop\ALL REPOS\Pia_REPOS\CLMS\Frontend\src\components\LoadingSpinner.tsx"
$successCount = 0
$failCount = 0

# Read original content
$originalContent = Get-Content $testFile -Raw

for ($i = 2; $i -le 21; $i++) {
    Write-Host "HMR Test #$i..." -NoNewline
    
    try {
        # Modify file by adding/updating comment
        $newContent = $originalContent -replace "HMR Test #\d+", "HMR Test #$i"
        
        # If no match, add comment
        if ($newContent -eq $originalContent) {
            $newContent = $originalContent -replace "(\* @example)", ("* @example`n * HMR Test #$i")
        }
        
        Set-Content $testFile -Value $newContent -NoNewline
        
        # Wait for HMR
        Start-Sleep -Milliseconds 300
        
        # Check if Vite process is still running
        $viteProcess = Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {
            (Get-NetTCPConnection -OwningProcess $_.Id -ErrorAction SilentlyContinue | Where-Object LocalPort -eq 3000)
        }
        
        if ($viteProcess) {
            Write-Host " ✅ PASSED" -ForegroundColor Green
            $successCount++
        } else {
            Write-Host " ❌ FAILED (Server crashed!)" -ForegroundColor Red
            $failCount++
            break
        }
        
    } catch {
        Write-Host " ❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red
        $failCount++
        break
    }
}

# Restore original content
Write-Host ""
Write-Host "Restoring original file..." -NoNewline
Set-Content $testFile -Value $originalContent -NoNewline
Write-Host " ✅ Done" -ForegroundColor Green

Write-Host ""
Write-Host "=== HMR Test Results ===" -ForegroundColor Cyan
Write-Host "✅ Successful: $successCount" -ForegroundColor Green
Write-Host "❌ Failed: $failCount" -ForegroundColor $(if ($failCount -eq 0) { "Green" } else { "Red" })
Write-Host ""

if ($successCount -ge 20) {
    Write-Host "🎉 T034 PASSED: HMR triggered $successCount times without crashes!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "⚠️  T034 FAILED: Only $successCount successful HMR triggers (need 20+)" -ForegroundColor Red
    exit 1
}
