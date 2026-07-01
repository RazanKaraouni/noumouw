# Run the parent app on a connected Android device.
# Uses D: for temp/build caches when C: is low on space (Flutter writes app.dill under %TEMP%).
# If install fails with INSTALL_FAILED_VERIFICATION_FAILURE on Samsung:
#   Settings > Developer options > turn OFF "Verify apps over USB"
#   Settings > Security > Auto Blocker > turn OFF "Block app installs via USB"
Set-Location $PSScriptRoot

$cacheRoot = "D:\flutter_cache"
$dirs = @(
    "$cacheRoot\temp",
    "$cacheRoot\pub",
    "$cacheRoot\gradle"
)
foreach ($dir in $dirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
}

$env:TEMP = "$cacheRoot\temp"
$env:TMP = "$cacheRoot\temp"
$env:PUB_CACHE = "$cacheRoot\pub"
$env:GRADLE_USER_HOME = "$cacheRoot\gradle"
$env:ANDROID_HOME = "D:\Android\Sdk"

Write-Host "Using D: caches (TEMP=$env:TEMP, PUB_CACHE=$env:PUB_CACHE)" -ForegroundColor Cyan
Write-Host "Tip: keep website\backend running (npm run dev) in another terminal." -ForegroundColor DarkGray

$adb = "$env:ANDROID_HOME\platform-tools\adb.exe"
if (Test-Path $adb) {
    & $adb reverse tcp:5000 tcp:5000 2>&1 | Out-Null
    Write-Host "USB port forward: phone 127.0.0.1:5000 -> PC :5000 (use THERAPISTS_API_BASE=http://127.0.0.1:5000 in app.env)" -ForegroundColor Green
} else {
    Write-Host "adb not found - skip USB forward or set ANDROID_HOME" -ForegroundColor Yellow
}

# Compile-time override so USB adb reverse (127.0.0.1:5000) matches the app even if
# dart_defines.json still has an old LAN IP from a previous Wi-Fi network.
$apiDefine = "--dart-define=THERAPISTS_API_BASE=http://127.0.0.1:5000"

if ($args.Count -gt 0) {
    flutter @args $apiDefine
} else {
    flutter run $apiDefine
}
