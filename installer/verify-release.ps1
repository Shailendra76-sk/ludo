[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$InstallerPath,
  [Parameter(Mandatory=$true)][string]$ManifestPath
)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path $InstallerPath)) { throw "Installer not found: $InstallerPath" }
if (-not (Test-Path $ManifestPath)) { throw "Manifest not found: $ManifestPath" }
if (-not (Get-Command signtool -ErrorAction SilentlyContinue)) { throw 'signtool is required to verify Authenticode signature' }
$manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json
$actual = (Get-FileHash $InstallerPath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actual -ne [string]$manifest.sha256.ToLowerInvariant()) { throw "SHA-256 mismatch: expected $($manifest.sha256), got $actual" }
& signtool verify /pa /all $InstallerPath
if ($LASTEXITCODE -ne 0) { throw 'Authenticode verification failed' }
[pscustomobject]@{ artifact=$InstallerPath; version=$manifest.version; sha256=$actual; signature='VERIFIED' } | ConvertTo-Json
