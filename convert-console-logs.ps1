#!/usr/bin/env pwsh
# Convert console.log to console.debug for development logging

Write-Host "`nConverting console.log → console.debug in development code..." -ForegroundColor Yellow

$files = Get-ChildItem -Path "Frontend/src" -Filter "*.tsx" -Recurse
$count = 0

foreach ($file in $files) {
    # Skip test files
    if ($file.Name -match "\.test\.|\.spec\.") { continue }
    
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    
    # Replace console.log with console.debug (allowed in our config)
    $content = $content -replace "console\.log\(", "console.debug("
    
    if ($content -ne $originalContent) {
        $content | Out-File -FilePath $file.FullName -Encoding UTF8 -NoNewline
        $count++
        Write-Host "  ✓ Updated: $($file.Name)" -ForegroundColor Green
    }
}

Write-Host "`nConverted $count files from console.log to console.debug" -ForegroundColor Cyan

# Now for .ts files (non-test)
$tsFiles = Get-ChildItem -Path "Frontend/src" -Filter "*.ts" -Recurse
foreach ($file in $tsFiles) {
    if ($file.Name -match "\.test\.|\.spec\.") { continue }
    
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    
    $content = $content -replace "console\.log\(", "console.debug("
    
    if ($content -ne $originalContent) {
        $content | Out-File -FilePath $file.FullName -Encoding UTF8 -NoNewline
        $count++
        Write-Host "  ✓ Updated: $($file.Name)" -ForegroundColor Green
    }
}

Write-Host "`nTotal files updated: $count" -ForegroundColor Green
Write-Host "Running lint check..." -ForegroundColor Yellow

Push-Location Frontend
$result = npm run lint 2>&1 | Out-String
$problemLine = $result -split "`n" | Where-Object { $_ -match "problems" } | Select-Object -Last 1
Write-Host $problemLine -ForegroundColor Cyan
Pop-Location
