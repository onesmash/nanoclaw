# setup.ps1 — Windows bootstrap for NanoClaw
# Equivalent to setup.sh for Windows users.
#
# If you see a script execution error, run first:
#   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

$ErrorActionPreference = 'Stop'

Write-Host "NanoClaw setup starting..."

# Check Node.js exists
$nodePath = $null
try {
    $nodePath = (Get-Command node -ErrorAction Stop).Source
} catch {
    Write-Error "Node.js not found. Please install Node.js >= 20 from https://nodejs.org and re-run this script."
    exit 1
}

# Check Node.js version >= 20
$nodeVersion = & node --version 2>&1
$nodeMajor = [int]($nodeVersion -replace '^v(\d+)\..*', '$1')
if ($nodeMajor -lt 20) {
    Write-Error "Node.js $nodeVersion found, but version 20 or higher is required. Please upgrade from https://nodejs.org"
    exit 1
}

Write-Host "Node.js $nodeVersion found at $nodePath"

# Install NSSM if not already on PATH
if (Get-Command nssm -ErrorAction SilentlyContinue) {
    Write-Host "NSSM already on PATH — skipping install"
} else {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        Write-Error "NSSM is not installed and winget is not available. Please install NSSM manually from https://nssm.cc/download and re-run this script."
        exit 1
    }
    Write-Host "Installing NSSM via winget..."
    & winget install nssm --silent --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) {
        Write-Error "winget install nssm failed. Please install NSSM manually from https://nssm.cc/download and re-run this script."
        exit 1
    }
    # Refresh PATH in current session so nssm is resolvable before npx tsx setup/index.ts
    $env:PATH = [System.Environment]::GetEnvironmentVariable('PATH', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('PATH', 'User')
    Write-Host "NSSM installed and PATH refreshed"
}

# Install npm dependencies
Write-Host "Installing npm dependencies..."
& npm install
if ($LASTEXITCODE -ne 0) {
    Write-Error "npm install failed."
    exit 1
}

# Run setup
Write-Host "Running NanoClaw setup..."
& npx tsx setup/index.ts
if ($LASTEXITCODE -ne 0) {
    Write-Error "Setup failed."
    exit 1
}
