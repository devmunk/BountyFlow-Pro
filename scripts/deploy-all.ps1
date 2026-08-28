<#
.SYNOPSIS
    Runs the entire reproducible pipeline in order:
        build -> test -> deploy -> configure frontend

.EXAMPLE
    ./scripts/deploy-all.ps1 -IdentityName bountyflow-deployer
#>

param(
    [string]$IdentityName = "bountyflow-deployer",
    [string]$Network = "testnet"
)

$ErrorActionPreference = "Stop"
$scriptDir = $PSScriptRoot

& (Join-Path $scriptDir "build.ps1")
& (Join-Path $scriptDir "test.ps1")
& (Join-Path $scriptDir "deploy.ps1") -IdentityName $IdentityName -Network $Network
& (Join-Path $scriptDir "configure-frontend.ps1") -Network $Network

Write-Host "==> Full pipeline complete." -ForegroundColor Green
