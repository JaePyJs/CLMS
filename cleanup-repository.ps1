# CLMS Repository Cleanup Script
# This script consolidates documentation and removes legacy files

Write-Host "=== CLMS Repository Cleanup ===" -ForegroundColor Cyan
Write-Host ""

$repoRoot = "C:\Users\jmbar\Desktop\ALL REPOS\Pia_REPOS\CLMS"
Set-Location $repoRoot

# Create backup directory
$backupDir = Join-Path $repoRoot "docs\archive\$(Get-Date -Format 'yyyy-MM-dd')"
if (!(Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    Write-Host "✓ Created backup directory: $backupDir" -ForegroundColor Green
}

Write-Host "`n=== Step 1: Archive Legacy Documentation ===" -ForegroundColor Yellow

# Files to archive (not delete, just move to archive)
$filesToArchive = @(
    "API_STATUS.md",
    "ATTENDANCE_EXPORT_IMPLEMENTATION_SUMMARY.md", 
    "COMPREHENSIVE_IMPLEMENTATION_SUMMARY.md",
    "ERROR_FIX_SUMMARY.md",
    "FINAL_IMPLEMENTATION_REPORT.md",
    "FINAL_TEST_RESULTS.md",
    "INTEGRATION_TEST_REPORT.md",
    "MARKDOWN_CONSOLIDATION_SUMMARY.md",
    "PHASE_3_COMPLETION_REPORT.md",
    "PHASE_4_COMPLETION_SUMMARY.md"
)

foreach ($file in $filesToArchive) {
    $sourcePath = Join-Path $repoRoot $file
    if (Test-Path $sourcePath) {
        $destPath = Join-Path $backupDir $file
        Move-Item -Path $sourcePath -Destination $destPath -Force
        Write-Host "  → Archived: $file" -ForegroundColor Gray
    }
}

Write-Host "`n=== Step 2: Move Test Files ===" -ForegroundColor Yellow

$testDir = Join-Path $repoRoot "tests\legacy"
if (!(Test-Path $testDir)) {
    New-Item -ItemType Directory -Path $testDir -Force | Out-Null
}

$testFiles = Get-ChildItem -Path $repoRoot -Filter "test_*"
foreach ($file in $testFiles) {
    if ($file.Extension -eq ".py" -or $file.Extension -eq ".sh" -or $file.Extension -eq ".txt" -or $file.Extension -eq ".js") {
        Move-Item -Path $file.FullName -Destination $testDir -Force
        Write-Host "  → Moved: $($file.Name)" -ForegroundColor Gray
    }
}

Write-Host "`n=== Step 3: Remove Log Files ===" -ForegroundColor Yellow

$logFiles = @(
    "backend-dev.log",
    "frontend-dev.log",
    "frontend.log",
    "build.log"
)

foreach ($file in $logFiles) {
    $filePath = Join-Path $repoRoot $file
    if (Test-Path $filePath) {
        Remove-Item -Path $filePath -Force
        Write-Host "  → Deleted: $file" -ForegroundColor Gray
    }
}

Write-Host "`n=== Step 4: Remove Temporary Files ===" -ForegroundColor Yellow

$tempFiles = @(
    "nul",
    "backend_deletions.txt",
    "CLMS_SUMMARY.txt",
    "DISTRIBUTION_README.txt"
)

foreach ($file in $tempFiles) {
    $filePath = Join-Path $repoRoot $file
    if (Test-Path $filePath) {
        Remove-Item -Path $filePath -Force
        Write-Host "  → Deleted: $file" -ForegroundColor Gray
    }
}

Write-Host "`n=== Step 5: Update .gitignore ===" -ForegroundColor Yellow

$gitignorePath = Join-Path $repoRoot ".gitignore"
$gitignoreContent = @"
# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
logs/
backend-dev.log
frontend-dev.log
build.log

# Temporary files
nul
*.tmp
*.temp

# Test results
test_results*.txt

# Environment variables
.env
.env.local
.env.*.local

# Dependencies
node_modules/
dist/
build/

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Prisma
prisma/.env

# Uploads
uploads/*
!uploads/.gitkeep

# Generated
barcodes/
qr-codes/
generated/
"@

Set-Content -Path $gitignorePath -Value $gitignoreContent -Force
Write-Host "  ✓ Updated .gitignore" -ForegroundColor Green

Write-Host "`n=== Cleanup Summary ===" -ForegroundColor Cyan
Write-Host "  ✓ Archived 10 legacy documentation files" -ForegroundColor Green
Write-Host "  ✓ Moved test files to tests/legacy/" -ForegroundColor Green
Write-Host "  ✓ Removed log files" -ForegroundColor Green
Write-Host "  ✓ Removed temporary files" -ForegroundColor Green
Write-Host "  ✓ Updated .gitignore" -ForegroundColor Green

Write-Host "`n=== Remaining Core Documentation ===" -ForegroundColor Cyan
$remainingDocs = @(
    "README.md",
    "CLAUDE.md",
    "CODEBASE_ANALYSIS.md",
    "BUGS_AND_FIXES.md",
    "PLANNING.md",
    "DEPLOYMENT_GUIDE.md",
    "DEPENDENCY_UPDATE_GUIDE.md",
    "TESTING_GUIDE.md",
    "SECURITY_AUDIT_REPORT.md"
)

foreach ($doc in $remainingDocs) {
    if (Test-Path (Join-Path $repoRoot $doc)) {
        Write-Host "  • $doc" -ForegroundColor White
    }
}

Write-Host "`n=== Cleanup Complete! ===" -ForegroundColor Green
Write-Host "Backup location: $backupDir" -ForegroundColor Gray
