# Remove all console.log statements from React components
# Keep console.error and console.warn

$files = @(
    "resources\js\Pages\WorkHourCreate.jsx",
    "resources\js\Pages\EmployeeAttendance.jsx",
    "resources\js\Pages\Dashboard.jsx",
    "resources\js\Pages\Portfolio\Editor.tsx"
)

foreach ($file in $files) {
    $filePath = Join-Path $PSScriptRoot $file
    
    if (Test-Path $filePath) {
        Write-Host "Processing: $file" -ForegroundColor Cyan
        
        $content = Get-Content $filePath -Raw
        
        # Count console.log statements before
        $beforeCount = ([regex]::Matches($content, "console\.log\(")).Count
        
        # Remove console.log statements (but keep console.error and console.warn)
        # Match console.log(...) including multiline
        $content = $content -replace "console\.log\([^)]*\);?(\r?\n)?", ""
        
        # Remove lines that are just whitespace after console.log removal
        $content = $content -replace "(\r?\n\s*){3,}", "`r`n`r`n"
        
        # Count after
        $afterCount = ([regex]::Matches($content, "console\.log\(")).Count
        
        # Save the file
        Set-Content -Path $filePath -Value $content -NoNewline
        
        $removed = $beforeCount - $afterCount
        Write-Host "  ✓ Removed $removed console.log statements" -ForegroundColor Green
    } else {
        Write-Host "  ✗ File not found: $file" -ForegroundColor Red
    }
}

Write-Host "`n✅ Console cleanup complete!" -ForegroundColor Green
Write-Host "Note: console.error and console.warn statements were preserved." -ForegroundColor Yellow
