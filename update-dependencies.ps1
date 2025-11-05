#!/usr/bin/env pwsh
# CLMS Dependency Update Script
# Version: 1.0.0
# Last Updated: November 5, 2025
# Requires: PowerShell 7+, Node.js 20+, npm 10+

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('check', 'update-safe', 'update-all', 'update-frontend', 'update-backend', 'test')]
    [string]$Action = 'check',
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipTests,
    
    [Parameter(Mandatory=$false)]
    [switch]$Force
)

# Color output functions
function Write-Success { param($Message) Write-Host "✅ $Message" -ForegroundColor Green }
function Write-Error { param($Message) Write-Host "❌ $Message" -ForegroundColor Red }
function Write-Warning { param($Message) Write-Host "⚠️  $Message" -ForegroundColor Yellow }
function Write-Info { param($Message) Write-Host "ℹ️  $Message" -ForegroundColor Cyan }
function Write-Step { param($Message) Write-Host "`n🔧 $Message" -ForegroundColor Magenta }

# Configuration
$RootDir = $PSScriptRoot
$FrontendDir = Join-Path $RootDir "Frontend"
$BackendDir = Join-Path $RootDir "Backend"

Write-Host @"
╔═══════════════════════════════════════════════════════════════╗
║        CLMS Dependency Update Script v1.0.0                   ║
║        Constitution v1.0.1 Compliant                          ║
╚═══════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

# Check if Node.js and npm are installed
function Test-Prerequisites {
    Write-Step "Checking prerequisites..."
    
    try {
        $nodeVersion = node --version
        $npmVersion = npm --version
        Write-Success "Node.js: $nodeVersion, npm: $npmVersion"
    } catch {
        Write-Error "Node.js or npm not found. Please install Node.js 20+ LTS"
        exit 1
    }
    
    if (-not (Test-Path $FrontendDir)) {
        Write-Error "Frontend directory not found: $FrontendDir"
        exit 1
    }
    
    if (-not (Test-Path $BackendDir)) {
        Write-Error "Backend directory not found: $BackendDir"
        exit 1
    }
    
    Write-Success "Prerequisites check passed"
}

# Check outdated packages
function Get-OutdatedPackages {
    param([string]$Directory, [string]$Name)
    
    Write-Step "Checking outdated packages in $Name..."
    Push-Location $Directory
    
    try {
        Write-Info "Running 'npm outdated' in $Name..."
        npm outdated --json | ConvertFrom-Json -ErrorAction SilentlyContinue
    } catch {
        Write-Warning "No outdated packages or error checking $Name"
    } finally {
        Pop-Location
    }
}

# Run type checking
function Test-TypeScript {
    param([string]$Directory, [string]$Name)
    
    Write-Step "Type checking $Name..."
    Push-Location $Directory
    
    try {
        $result = npx tsc --noEmit 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "$Name type check passed"
            return $true
        } else {
            Write-Error "$Name type check failed:"
            Write-Host $result -ForegroundColor Red
            return $false
        }
    } finally {
        Pop-Location
    }
}

# Run linting
function Test-Linting {
    param([string]$Directory, [string]$Name)
    
    Write-Step "Linting $Name..."
    Push-Location $Directory
    
    try {
        $result = npm run lint 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "$Name linting passed"
            return $true
        } else {
            Write-Error "$Name linting failed:"
            Write-Host $result -ForegroundColor Red
            return $false
        }
    } finally {
        Pop-Location
    }
}

# Run tests
function Test-Unit {
    param([string]$Directory, [string]$Name)
    
    Write-Step "Running unit tests for $Name..."
    Push-Location $Directory
    
    try {
        $result = npm test 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "$Name tests passed"
            return $true
        } else {
            Write-Error "$Name tests failed:"
            Write-Host $result -ForegroundColor Red
            return $false
        }
    } finally {
        Pop-Location
    }
}

# Run build
function Test-Build {
    param([string]$Directory, [string]$Name)
    
    Write-Step "Building $Name..."
    Push-Location $Directory
    
    try {
        $result = npm run build 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "$Name build passed"
            return $true
        } else {
            Write-Error "$Name build failed:"
            Write-Host $result -ForegroundColor Red
            return $false
        }
    } finally {
        Pop-Location
    }
}

# Update packages safely (minor/patch only)
function Update-PackagesSafe {
    param([string]$Directory, [string]$Name)
    
    Write-Step "Updating packages (safe) in $Name..."
    Push-Location $Directory
    
    try {
        Write-Info "Running 'npm update'..."
        npm update
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "$Name packages updated (safe)"
        } else {
            Write-Error "$Name package update failed"
        }
    } finally {
        Pop-Location
    }
}

# Update specific major packages
function Update-MajorPackages {
    param([string]$Directory, [string]$Name, [string[]]$Packages)
    
    Write-Step "Updating major packages in $Name..."
    Push-Location $Directory
    
    try {
        foreach ($package in $Packages) {
            Write-Info "Updating $package..."
            npm install $package
            
            if ($LASTEXITCODE -ne 0) {
                Write-Error "Failed to update $package"
                if (-not $Force) {
                    Write-Warning "Stopping updates. Use -Force to continue on errors."
                    return $false
                }
            } else {
                Write-Success "Updated $package"
            }
        }
        return $true
    } finally {
        Pop-Location
    }
}

# Main execution
Test-Prerequisites

switch ($Action) {
    'check' {
        Write-Info "Checking for outdated packages..."
        
        Get-OutdatedPackages -Directory $FrontendDir -Name "Frontend"
        Get-OutdatedPackages -Directory $BackendDir -Name "Backend"
        Get-OutdatedPackages -Directory $RootDir -Name "Root"
        
        Write-Info "`nTo update packages, run:"
        Write-Host "  .\update-dependencies.ps1 -Action update-safe" -ForegroundColor Yellow
        Write-Host "  .\update-dependencies.ps1 -Action update-all" -ForegroundColor Yellow
    }
    
    'update-safe' {
        Write-Warning "This will update packages to latest compatible versions (minor/patch only)"
        if (-not $Force) {
            $confirm = Read-Host "Continue? (y/N)"
            if ($confirm -ne 'y') {
                Write-Info "Update cancelled"
                exit 0
            }
        }
        
        Update-PackagesSafe -Directory $FrontendDir -Name "Frontend"
        Update-PackagesSafe -Directory $BackendDir -Name "Backend"
        Update-PackagesSafe -Directory $RootDir -Name "Root"
        
        if (-not $SkipTests) {
            & $MyInvocation.MyCommand.Path -Action test
        }
    }
    
    'update-frontend' {
        Write-Warning "This will update Frontend packages to latest versions (including major)"
        $packages = @(
            "react@^19.0.0",
            "react-dom@^19.0.0",
            "vite@^6.0.0",
            "@tanstack/react-query@^5.59.0",
            "@tanstack/react-query-devtools@^5.59.0",
            "zustand@^5.0.0",
            "typescript@^5.7.2",
            "vitest@^2.1.3",
            "@vitest/ui@^2.1.3",
            "@vitest/coverage-v8@^2.1.3",
            "playwright@^1.48.2",
            "@playwright/test@^1.48.2"
        )
        
        if (-not $Force) {
            $confirm = Read-Host "Continue? (y/N)"
            if ($confirm -ne 'y') {
                Write-Info "Update cancelled"
                exit 0
            }
        }
        
        $success = Update-MajorPackages -Directory $FrontendDir -Name "Frontend" -Packages $packages
        
        if ($success -and -not $SkipTests) {
            & $MyInvocation.MyCommand.Path -Action test
        }
    }
    
    'update-backend' {
        Write-Warning "This will update Backend packages to latest versions (including major)"
        $packages = @(
            "prisma@^6.0.0",
            "@prisma/client@^6.0.0",
            "typescript@^5.7.2",
            "vitest@^2.1.3",
            "@vitest/coverage-v8@^2.1.3",
            "supertest@^7.0.0"
        )
        
        if (-not $Force) {
            $confirm = Read-Host "Continue? (y/N)"
            if ($confirm -ne 'y') {
                Write-Info "Update cancelled"
                exit 0
            }
        }
        
        $success = Update-MajorPackages -Directory $BackendDir -Name "Backend" -Packages $packages
        
        if ($success) {
            Write-Step "Regenerating Prisma client..."
            Push-Location $BackendDir
            try {
                npx prisma generate
                Write-Success "Prisma client regenerated"
            } finally {
                Pop-Location
            }
        }
        
        if ($success -and -not $SkipTests) {
            & $MyInvocation.MyCommand.Path -Action test
        }
    }
    
    'update-all' {
        Write-Warning "This will update ALL packages to latest versions (MAJOR CHANGES)"
        Write-Warning "This may introduce breaking changes!"
        
        if (-not $Force) {
            $confirm = Read-Host "Are you sure? (y/N)"
            if ($confirm -ne 'y') {
                Write-Info "Update cancelled"
                exit 0
            }
        }
        
        & $MyInvocation.MyCommand.Path -Action update-frontend -Force:$Force -SkipTests
        & $MyInvocation.MyCommand.Path -Action update-backend -Force:$Force -SkipTests
        
        if (-not $SkipTests) {
            & $MyInvocation.MyCommand.Path -Action test
        }
    }
    
    'test' {
        Write-Step "Running comprehensive test suite..."
        
        $frontendTypeCheck = Test-TypeScript -Directory $FrontendDir -Name "Frontend"
        $backendTypeCheck = Test-TypeScript -Directory $BackendDir -Name "Backend"
        
        $frontendLint = Test-Linting -Directory $FrontendDir -Name "Frontend"
        $backendLint = Test-Linting -Directory $BackendDir -Name "Backend"
        
        $frontendTests = Test-Unit -Directory $FrontendDir -Name "Frontend"
        $backendTests = Test-Unit -Directory $BackendDir -Name "Backend"
        
        $frontendBuild = Test-Build -Directory $FrontendDir -Name "Frontend"
        $backendBuild = Test-Build -Directory $BackendDir -Name "Backend"
        
        Write-Host "`n╔═══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
        Write-Host "║                    TEST SUMMARY                               ║" -ForegroundColor Cyan
        Write-Host "╚═══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
        
        $results = @(
            @{Name="Frontend Type Check"; Pass=$frontendTypeCheck},
            @{Name="Backend Type Check"; Pass=$backendTypeCheck},
            @{Name="Frontend Linting"; Pass=$frontendLint},
            @{Name="Backend Linting"; Pass=$backendLint},
            @{Name="Frontend Tests"; Pass=$frontendTests},
            @{Name="Backend Tests"; Pass=$backendTests},
            @{Name="Frontend Build"; Pass=$frontendBuild},
            @{Name="Backend Build"; Pass=$backendBuild}
        )
        
        $allPassed = $true
        foreach ($result in $results) {
            $status = if ($result.Pass) { "✅ PASS" } else { "❌ FAIL"; $allPassed = $false }
            $color = if ($result.Pass) { "Green" } else { "Red" }
            Write-Host ("{0,-30} {1}" -f $result.Name, $status) -ForegroundColor $color
        }
        
        Write-Host ""
        if ($allPassed) {
            Write-Success "All tests passed! 🎉"
            exit 0
        } else {
            Write-Error "Some tests failed. Please review the errors above."
            exit 1
        }
    }
}

Write-Host "`n✨ Done!" -ForegroundColor Green
