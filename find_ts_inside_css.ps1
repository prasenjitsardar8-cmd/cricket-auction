$ErrorActionPreference = "Stop"

Write-Host "Scanning CSS files for accidentally pasted TypeScript/TSX..." -ForegroundColor Cyan

$badFiles = @()

Get-ChildItem -Path ".\src" -Recurse -Filter "*.css" | ForEach-Object {
    $content = Get-Content -LiteralPath $_.FullName -Raw

    if (
        $content -match '(^|\r?\n)\s*import\s*\{' -or
        $content -match '(^|\r?\n)\s*import\s+["'']' -or
        $content -match '(^|\r?\n)\s*function\s+[A-Za-z_]' -or
        $content -match '(^|\r?\n)\s*export\s+default'
    ) {
        $badFiles += $_.FullName
        Write-Host "Suspicious CSS file: $($_.FullName)" -ForegroundColor Red

        $matches = Select-String -LiteralPath $_.FullName -Pattern 'import\s*\{|import\s+["'']|function\s+|export\s+default'
        foreach ($m in $matches) {
            Write-Host "  Line $($m.LineNumber): $($m.Line.Trim())" -ForegroundColor Yellow
        }
    }
}

Write-Host ""

if ($badFiles.Count -eq 0) {
    Write-Host "No TypeScript/TSX found inside CSS files." -ForegroundColor Green
}
else {
    Write-Host "Fix the file(s) shown above. A CSS file contains TypeScript/TSX content." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Running build after scan..." -ForegroundColor Cyan
npm run build
