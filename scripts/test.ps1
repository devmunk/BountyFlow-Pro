<#
.SYNOPSIS
    Runs the full contract test suite in the correct order.

.DESCRIPTION
    factory's tests deploy real bounty WASM via env.deployer(), so the
    bounty contract must be built to WASM before `cargo test` runs for the
    workspace. This mirrors exactly what CI does (.github/workflows/ci.yml).

.EXAMPLE
    ./scripts/test.ps1
#>

$ErrorActionPreference = "Stop"
$rootDir = Get-Location
$contractsDir = Join-Path $PSScriptRoot "..\contracts"
Set-Location $contractsDir

try {
    Write-Host "==> Building bounty contract to WASM (required by factory tests)" -ForegroundColor Cyan
    stellar contract build --package bounty
    if ($LASTEXITCODE -ne 0) { throw "bounty build failed" }

    Write-Host "==> Running cargo test --workspace" -ForegroundColor Cyan
    cargo test --workspace
    if ($LASTEXITCODE -ne 0) { throw "contract tests failed" }

    Write-Host "==> All contract tests passed." -ForegroundColor Green
}
finally {
    Set-Location $rootDir
}
