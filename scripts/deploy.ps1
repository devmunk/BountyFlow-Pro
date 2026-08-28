<#
.SYNOPSIS
    Deploys and initializes the BountyFlow Pro contracts on Stellar Testnet.

.DESCRIPTION
    Step 2-4 of the reproducible deployment pipeline:
        build WASM -> install/deploy -> initialize -> record contract IDs

    This script is idempotent-by-output: every run writes a fresh, timestamped
    record to deployments/testnet.json AND overwrites deployments/latest.json,
    so nobody has to remember WASM hashes, contract IDs, or call order by hand.

    Requires: stellar-cli (`stellar --version`), an identity already funded
    on testnet (see -IdentityName below), and build.ps1 already run.

.PARAMETER IdentityName
    Name of a `stellar keys` identity to deploy from. Created + funded via
    friendbot automatically if it does not already exist.

.PARAMETER Network
    Soroban network alias. Defaults to "testnet".

.PARAMETER ClaimTimeoutSecs
    Not used at deploy time (it's a per-bounty parameter set by creators at
    bounty-creation time) — kept here only as a documented default for the
    frontend's .env configuration.

.EXAMPLE
    ./scripts/deploy.ps1 -IdentityName bountyflow-deployer
#>

param(
    [string]$IdentityName = "bountyflow-deployer",
    [string]$Network = "testnet",
    [int]$ClaimTimeoutSecs = 259200
)

$ErrorActionPreference = "Stop"

function Assert-StellarCli {
    $version = (stellar --version) 2>$null
    if (-not $version) {
        throw "stellar-cli not found. Install it first: https://developers.stellar.org/docs/tools/developer-tools/cli/install-cli"
    }
    Write-Host "Using $version" -ForegroundColor DarkGray
}

Assert-StellarCli

$repoRoot = Split-Path -Parent $PSScriptRoot
$deploymentsDir = Join-Path $repoRoot "deployments"
New-Item -ItemType Directory -Force -Path $deploymentsDir | Out-Null

$bountyWasm = Join-Path $repoRoot "contracts/target/wasm32v1-none/release/bounty.optimized.wasm"
$factoryWasm = Join-Path $repoRoot "contracts/target/wasm32v1-none/release/factory.optimized.wasm"

if (-not (Test-Path $bountyWasm) -or -not (Test-Path $factoryWasm)) {
    throw "Optimized WASM not found. Run ./scripts/build.ps1 first."
}

Write-Host "==> Ensuring identity '$IdentityName' exists and is funded on $Network" -ForegroundColor Cyan
$identities = stellar keys ls
if ($identities -notcontains $IdentityName) {
    stellar keys generate $IdentityName --network $Network --fund
    if ($LASTEXITCODE -ne 0) { throw "Failed to generate/fund identity $IdentityName" }
} else {
    Write-Host "    identity '$IdentityName' already exists; using it."
}
$adminAddress = (stellar keys address $IdentityName).Trim()
Write-Host "    admin address: $adminAddress"

Write-Host "==> Resolving native XLM SAC address on $Network" -ForegroundColor Cyan
$tokenAddress = (stellar contract id asset --asset native --network $Network).Trim()
Write-Host "    token (native XLM SAC): $tokenAddress"

Write-Host "==> Installing bounty.wasm" -ForegroundColor Cyan
$bountyWasmHash = (stellar contract install `
    --wasm $bountyWasm `
    --source $IdentityName `
    --network $Network).Trim()
Write-Host "    bounty wasm hash: $bountyWasmHash"

Write-Host "==> Deploying factory contract" -ForegroundColor Cyan
$factoryId = (stellar contract deploy `
    --wasm $factoryWasm `
    --source $IdentityName `
    --network $Network).Trim()
Write-Host "    factory contract id: $factoryId"

Write-Host "==> Initializing factory (admin, bounty wasm hash, token)" -ForegroundColor Cyan
stellar contract invoke `
    --id $factoryId `
    --source $IdentityName `
    --network $Network `
    -- `
    init `
    --admin $adminAddress `
    --wasm_hash $bountyWasmHash `
    --token $tokenAddress
if ($LASTEXITCODE -ne 0) { throw "factory.init invocation failed" }

$record = [ordered]@{
    network           = $Network
    deployedAt        = (Get-Date).ToUniversalTime().ToString("o")
    adminAddress      = $adminAddress
    tokenAddress      = $tokenAddress
    bountyWasmHash    = $bountyWasmHash
    factoryContractId = $factoryId
    defaultClaimTimeoutSecs = $ClaimTimeoutSecs
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$record | ConvertTo-Json | Set-Content (Join-Path $deploymentsDir "$Network-$timestamp.json")
$record | ConvertTo-Json | Set-Content (Join-Path $deploymentsDir "latest.json")

Write-Host "==> Deployment recorded at deployments/latest.json" -ForegroundColor Green
Write-Host "==> Run ./scripts/configure-frontend.ps1 next to wire up the frontend .env.local" -ForegroundColor Yellow
