<#
.SYNOPSIS
    Builds the BountyFlow Pro Soroban contracts to optimized WASM.

.DESCRIPTION
    Step 1 of the reproducible deployment pipeline:
        source code -> build WASM -> deploy -> initialize -> configure frontend

    Run this any time contract Rust source changes. Building alone does NOT
    update an already-deployed contract on a live network — see deploy.ps1
    and update-contract.ps1 for that.

.EXAMPLE
    ./scripts/build.ps1
#>

$ErrorActionPreference = "Stop"

# Navigate into the contracts workspace folder relative to this script
$rootDir = Get-Location
$contractsDir = Join-Path $PSScriptRoot "..\contracts"
Set-Location $contractsDir

try {
    Write-Host "==> Building bounty contract to WASM" -ForegroundColor Cyan
    stellar contract build --package bounty
    if ($LASTEXITCODE -ne 0) { throw "bounty contract build failed" }

    Write-Host "==> Building factory contract to WASM" -ForegroundColor Cyan
    stellar contract build --package factory
    if ($LASTEXITCODE -ne 0) { throw "factory contract build failed" }

    Write-Host "==> Optimizing WASM binaries" -ForegroundColor Cyan
    stellar contract optimize --wasm target/wasm32v1-none/release/bounty.wasm
    stellar contract optimize --wasm target/wasm32v1-none/release/factory.wasm

    Write-Host "==> Build complete." -ForegroundColor Green
    Write-Host "    target/wasm32v1-none/release/bounty.optimized.wasm"
    Write-Host "    target/wasm32v1-none/release/factory.optimized.wasm"
}
finally {
    # Always restore original working directory
    Set-Location $rootDir
}
