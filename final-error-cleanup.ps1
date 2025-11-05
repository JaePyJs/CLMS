#!/usr/bin/env pwsh
# Final error cleanup - prefix unused destructured params with underscore

$files = @(
    "c:\Users\jmbar\Desktop\ALL REPOS\Pia_REPOS\CLMS\Frontend\src\components\dashboard\ErrorReportingDashboard.tsx",
    "c:\Users\jmbar\Desktop\ALL REPOS\Pia_REPOS\CLMS\Frontend\src\components\dashboard\StudentManagement.tsx",
    "c:\Users\jmbar\Desktop\ALL REPOS\Pia_REPOS\CLMS\Frontend\src\components\ui\select.tsx"
)

$totalFixed = 0

foreach ($file in $files) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        $originalContent = $content
        
        # Pattern 1: ({ onOpenChange, onValueChange }) =>
        $content = $content -replace '\(\{\s*onOpenChange,\s*onValueChange\s*\}\)', '({ onOpenChange: _onOpenChange, onValueChange: _onValueChange })'
        
        # Pattern 2: onOpenChange, at start of destructuring
        $content = $content -replace '(?<=\{)\s*onOpenChange,', ' onOpenChange: _onOpenChange,'
        
        # Pattern 3: onValueChange, at start
        $content = $content -replace '(?<=\{)\s*onValueChange,', ' onValueChange: _onValueChange,'
        
        # Pattern 4: , onOpenChange } at end
        $content = $content -replace ',\s*onOpenChange\s*\}', ', onOpenChange: _onOpenChange }'
        
        # Pattern 5: , onValueChange } at end
        $content = $content -replace ',\s*onValueChange\s*\}', ', onValueChange: _onValueChange }'
        
        # Pattern 6: const mockData = 
        $content = $content -replace '\bconst mockData\s*=', 'const _mockData ='
        
        if ($content -ne $originalContent) {
            Set-Content $file -Value $content -NoNewline
            $totalFixed++
            Write-Host "✅ Fixed: $(Split-Path $file -Leaf)" -ForegroundColor Green
        }
    }
}

Write-Host "`n✨ Fixed $totalFixed files" -ForegroundColor Cyan
Write-Host "`n🧹 Running lint..." -ForegroundColor Yellow

cd "c:\Users\jmbar\Desktop\ALL REPOS\Pia_REPOS\CLMS\Frontend"
$result = npm run lint 2>&1 | Out-String
$problemLine = $result -split "`n" | Where-Object { $_ -match "(\d+) problems" }

if ($problemLine) {
    Write-Host $problemLine -ForegroundColor Cyan
}
