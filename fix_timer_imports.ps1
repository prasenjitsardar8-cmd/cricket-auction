$ErrorActionPreference = "Stop"

Write-Host "Fixing stale timer-ready imports..." -ForegroundColor Cyan

$files = Get-ChildItem -Path ".\src" -Recurse -File |
    Where-Object { $_.Extension -in ".ts", ".tsx" }

$changed = 0

foreach ($file in $files) {
    $content = Get-Content -LiteralPath $file.FullName -Raw

    $updated = $content `
        -replace 'from\s+["'']\./types\.timer-ready["'']', 'from "./types"' `
        -replace 'from\s+["'']\./database\.timer-ready["'']', 'from "./database"'

    if ($updated -ne $content) {
        Set-Content -LiteralPath $file.FullName -Value $updated -Encoding UTF8
        Write-Host "Updated: $($file.FullName)" -ForegroundColor Green
        $changed++
    }
}

Write-Host ""
Write-Host "Files updated: $changed" -ForegroundColor Yellow
Write-Host ""

if (-not (Test-Path ".\src\types.ts")) {
    throw "src\types.ts is missing."
}

if (-not (Test-Path ".\src\database.ts")) {
    throw "src\database.ts is missing."
}

Write-Host "Verified src\types.ts and src\database.ts." -ForegroundColor Green
Write-Host ""
Write-Host "Running build..." -ForegroundColor Cyan

npm run build
