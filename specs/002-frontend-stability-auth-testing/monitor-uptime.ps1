# Server Uptime Monitor for T033
# Tracks frontend server uptime and alerts if it crashes

param(
    [int]$DurationMinutes = 30,
    [int]$CheckIntervalSeconds = 60
)

$startTime = Get-Date
$targetEndTime = $startTime.AddMinutes($DurationMinutes)
$checkCount = 0
$crashDetected = $false

Write-Host "=== Frontend Stability Monitor - T033 ===" -ForegroundColor Cyan
Write-Host "Start Time: $($startTime.ToString('HH:mm:ss'))" -ForegroundColor Yellow
Write-Host "Target Duration: $DurationMinutes minutes" -ForegroundColor Yellow
Write-Host "Target End Time: $($targetEndTime.ToString('HH:mm:ss'))" -ForegroundColor Yellow
Write-Host "Check Interval: $CheckIntervalSeconds seconds" -ForegroundColor Yellow
Write-Host "`nMonitoring server on port 3000...`n" -ForegroundColor Green

while ((Get-Date) -lt $targetEndTime) {
    $checkCount++
    $currentTime = Get-Date
    $elapsed = $currentTime - $startTime
    $remaining = $targetEndTime - $currentTime
    
    # Check if server is running
    $processId = (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess
    
    if ($processId) {
        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
        if ($process) {
            $uptime = $currentTime - $process.StartTime
            
            Write-Host "[$($currentTime.ToString('HH:mm:ss'))] " -NoNewline -ForegroundColor Gray
            Write-Host "Check #$checkCount " -NoNewline -ForegroundColor White
            Write-Host "✅ Server Running " -NoNewline -ForegroundColor Green
            Write-Host "| Uptime: $([Math]::Floor($uptime.TotalMinutes))m $($uptime.Seconds)s " -NoNewline -ForegroundColor Yellow
            Write-Host "| Remaining: $([Math]::Floor($remaining.TotalMinutes))m $($remaining.Seconds)s" -ForegroundColor Cyan
            
            # Milestone alerts
            if ($uptime.TotalMinutes -ge 10 -and $uptime.TotalMinutes -lt 10.5) {
                Write-Host "  🎯 Milestone: 10 minutes uptime!" -ForegroundColor Magenta
            }
            if ($uptime.TotalMinutes -ge 20 -and $uptime.TotalMinutes -lt 20.5) {
                Write-Host "  🎯 Milestone: 20 minutes uptime!" -ForegroundColor Magenta
            }
            if ($uptime.TotalMinutes -ge 30 -and $uptime.TotalMinutes -lt 30.5) {
                Write-Host "  🎯 Milestone: 30 minutes uptime!" -ForegroundColor Magenta
            }
        } else {
            Write-Host "[$($currentTime.ToString('HH:mm:ss'))] ❌ CRASH DETECTED - Process terminated!" -ForegroundColor Red
            $crashDetected = $true
            break
        }
    } else {
        Write-Host "[$($currentTime.ToString('HH:mm:ss'))] ❌ CRASH DETECTED - Port 3000 not listening!" -ForegroundColor Red
        $crashDetected = $true
        break
    }
    
    # Wait before next check
    Start-Sleep -Seconds $CheckIntervalSeconds
}

Write-Host "`n=== Test Complete ===" -ForegroundColor Cyan

if ($crashDetected) {
    Write-Host "❌ T033 FAILED - Server crashed during uptime test" -ForegroundColor Red
    Write-Host "Uptime achieved: $([Math]::Floor($elapsed.TotalMinutes)) minutes" -ForegroundColor Yellow
    exit 1
} else {
    $finalUptime = (Get-Date) - $startTime
    Write-Host "✅ T033 PASSED - Server ran for $([Math]::Floor($finalUptime.TotalMinutes)) minutes without crashes!" -ForegroundColor Green
    Write-Host "`nFinal Stats:" -ForegroundColor Cyan
    Write-Host "  - Checks performed: $checkCount" -ForegroundColor Yellow
    Write-Host "  - Total uptime: $([Math]::Floor($finalUptime.TotalMinutes))m $($finalUptime.Seconds)s" -ForegroundColor Yellow
    Write-Host "  - Crashes: 0" -ForegroundColor Green
    Write-Host "`n🎉 Frontend stability test COMPLETE!" -ForegroundColor Green
    exit 0
}
