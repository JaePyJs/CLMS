#!/usr/bin/env pwsh
# Smart Any-Type Replacer
# Replaces common any patterns with safer types

Write-Host "`n╔═══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Smart TypeScript 'any' Type Replacer   ║" -ForegroundColor Cyan
Write-Host "║  Target: ~500 warnings → ~200            ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════╝`n" -ForegroundColor Cyan

$frontendPath = "Frontend/src"
$filesProcessed = 0
$replacementsMade = 0

# Common patterns to replace
$patterns = @(
    # Pattern 1: error: any → error: unknown
    @{
        Pattern = '\(error:\s*any\)'
        Replacement = '(error: unknown)'
        Description = 'error: any → error: unknown'
    },
    # Pattern 2: catch (error: any) → catch (error)
    @{
        Pattern = 'catch\s*\(\s*error:\s*any\s*\)'
        Replacement = 'catch (error)'
        Description = 'catch (error: any) → catch (error)'
    },
    # Pattern 3: catch (err: any) → catch (err)
    @{
        Pattern = 'catch\s*\(\s*err:\s*any\s*\)'
        Replacement = 'catch (err)'
        Description = 'catch (err: any) → catch (err)'
    },
    # Pattern 4: catch (e: any) → catch (e)
    @{
        Pattern = 'catch\s*\(\s*e:\s*any\s*\)'
        Replacement = 'catch (e)'
        Description = 'catch (e: any) → catch (e)'
    },
    # Pattern 5: data: any → data: unknown
    @{
        Pattern = '\(data:\s*any\)'
        Replacement = '(data: unknown)'
        Description = 'data: any → data: unknown'
    },
    # Pattern 6: response: any → response: unknown
    @{
        Pattern = '\(response:\s*any\)'
        Replacement = '(response: unknown)'
        Description = 'response: any → response: unknown'
    },
    # Pattern 7: payload: any → payload: unknown
    @{
        Pattern = '\(payload:\s*any\)'
        Replacement = '(payload: unknown)'
        Description = 'payload: any → payload: unknown'
    },
    # Pattern 8: params: any → params: Record<string, unknown>
    @{
        Pattern = 'params:\s*any\s*='
        Replacement = 'params: Record<string, unknown> ='
        Description = 'params: any → params: Record<string, unknown>'
    },
    # Pattern 9: const something: any = → const something =
    @{
        Pattern = 'const\s+(\w+):\s*any\s*='
        Replacement = 'const $1 ='
        Description = 'const var: any = → const var = (inferred)'
    },
    # Pattern 10: window as any → window as Window & typeof globalThis
    @{
        Pattern = '\(window as any\)'
        Replacement = '(window as Window & typeof globalThis)'
        Description = 'window as any → proper typing'
    }
)

Write-Host "Scanning and replacing patterns...`n" -ForegroundColor Yellow

foreach ($pattern in $patterns) {
    Write-Host "Processing: $($pattern.Description)" -ForegroundColor Cyan
    $patternCount = 0
    
    Get-ChildItem -Path $frontendPath -Include "*.ts","*.tsx" -Recurse | ForEach-Object {
        $file = $_
        # Skip test files
        if ($file.Name -match "\.test\.|\.spec\.") { return }
        
        $content = Get-Content $file.FullName -Raw
        $originalContent = $content
        
        $content = $content -replace $pattern.Pattern, $pattern.Replacement
        
        if ($content -ne $originalContent) {
            $content | Out-File -FilePath $file.FullName -Encoding UTF8 -NoNewline
            $patternCount++
            $replacementsMade++
        }
    }
    
    if ($patternCount -gt 0) {
        Write-Host "  ✓ Applied to $patternCount files" -ForegroundColor Green
    } else {
        Write-Host "  - No matches found" -ForegroundColor Gray
    }
}

Write-Host "`n" + "─" * 50 -ForegroundColor Gray
Write-Host "Total replacements: $replacementsMade" -ForegroundColor Green
Write-Host "Running lint check...`n" -ForegroundColor Yellow

Push-Location Frontend
$result = npm run lint 2>&1 | Out-String
$problemLine = $result -split "`n" | Where-Object { $_ -match "problems" } | Select-Object -Last 1
Write-Host "Result: $problemLine" -ForegroundColor Cyan

# Count remaining any warnings
$anyWarnings = ($result -split "`n" | Where-Object { $_ -match "warning.*@typescript-eslint/no-explicit-any" }).Count
Write-Host "Remaining 'any' type warnings: $anyWarnings" -ForegroundColor Yellow
Pop-Location

Write-Host "`n╔═══════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  Smart Type Replacement Complete! 🎯     ║" -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════════╝`n" -ForegroundColor Green
