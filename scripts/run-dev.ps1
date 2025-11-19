Param(
  [string]$FrontendPath = "Frontend",
  [string]$BackendPath = "Backend",
  [string]$WsUrl = "ws://localhost:3001"
)

Write-Host "Starting CLMS manual dev servers..." -ForegroundColor Cyan
$backendFull = Join-Path (Get-Location) $BackendPath
if (!(Test-Path $backendFull)) { Write-Error "Backend path not found: $backendFull"; exit 1 }
Write-Host "Launching backend at $backendFull" -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit -NoProfile -Command cd `"$backendFull`"; npm run dev" | Out-Null

$frontendFull = Join-Path (Get-Location) $FrontendPath
if (!(Test-Path $frontendFull)) { Write-Error "Frontend path not found: $frontendFull"; exit 1 }
Write-Host "Launching frontend at $frontendFull (VITE_WS_URL=$WsUrl)" -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit -NoProfile -Command cd `"$frontendFull`"; $env:VITE_WS_URL=`"$WsUrl`"; npm run dev" | Out-Null

Write-Host "Servers started in separate terminals. Close those terminals to stop." -ForegroundColor Cyan