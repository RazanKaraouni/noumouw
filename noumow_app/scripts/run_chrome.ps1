$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
if (-not (Test-Path "dart_defines.json")) {
    Write-Host "Missing dart_defines.json. Copy dart_defines.example.json to dart_defines.json"
    Write-Host "and set SUPABASE_ANON_KEY (Project Settings > API > anon public)." -ForegroundColor Yellow
    exit 1
}
flutter run -d chrome --dart-define-from-file=dart_defines.json
