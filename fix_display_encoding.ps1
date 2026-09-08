$ErrorActionPreference = "Stop"

Write-Host "Fixing corrupted UTF-8 symbols in src..." -ForegroundColor Cyan

# Build characters from Unicode code points so this repair script
# does not depend on PowerShell's own source-file encoding.
function U([int]$CodePoint) {
    return [char]::ConvertFromUtf32($CodePoint)
}

$badRupee  = (U 0x00E2) + (U 0x201A) + (U 0x00B9)   # â‚¹
$badBullet = (U 0x00E2) + (U 0x20AC) + (U 0x00A2)   # â€¢
$badArrow  = (U 0x00E2) + (U 0x2020) + (U 0x2019)   # â†’
$badCheck  = (U 0x00E2) + (U 0x0153) + (U 0x201C)   # common mojibake for ✓
$badLeft   = (U 0x00E2) + (U 0x2020) + [char]0x0090 # common mojibake for ←

$rupee  = U 0x20B9
$bullet = U 0x2022
$arrow  = U 0x2192
$check  = U 0x2713
$left   = U 0x2190

$files = Get-ChildItem -Path ".\src" -Recurse -File |
    Where-Object {
        $_.Extension -in ".ts", ".tsx", ".js", ".jsx", ".css", ".html"
    }

$changed = 0

# UTF-8 without BOM works consistently with Vite/TypeScript.
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName)

    $updated = $content
    $updated = $updated.Replace($badRupee,  $rupee)
    $updated = $updated.Replace($badBullet, $bullet)
    $updated = $updated.Replace($badArrow,  $arrow)
    $updated = $updated.Replace($badCheck,  $check)
    $updated = $updated.Replace($badLeft,   $left)

    if ($updated -ne $content) {
        [System.IO.File]::WriteAllText(
            $file.FullName,
            $updated,
            $utf8NoBom
        )

        Write-Host "Fixed: $($file.FullName)" -ForegroundColor Green
        $changed++
    }
}

Write-Host ""
Write-Host "Files repaired: $changed" -ForegroundColor Yellow
Write-Host ""

Write-Host "Checking for remaining suspicious mojibake..." -ForegroundColor Cyan

$remaining = @()

foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName)

    if (
        $content.Contains((U 0x00E2)) -or
        $content.Contains((U 0x00C3)) -or
        $content.Contains((U 0x00C2))
    ) {
        $remaining += $file.FullName
    }
}

if ($remaining.Count -gt 0) {
    Write-Host "These files may still contain corrupted characters:" -ForegroundColor Yellow
    $remaining | ForEach-Object {
        Write-Host "  $_" -ForegroundColor Yellow
    }
}
else {
    Write-Host "No common mojibake markers remain." -ForegroundColor Green
}

Write-Host ""
Write-Host "Running build..." -ForegroundColor Cyan
npm run build
